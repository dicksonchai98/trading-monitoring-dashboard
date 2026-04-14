"""Auth routes for register, login, and refresh flows."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel

from app.config import REFRESH_COOKIE_NAME, REFRESH_TOKEN_TTL_SECONDS
from app.services.otp_service import OtpThrottleError
from app.services.token_service import TokenError
from app.state import auth_service, metrics, otp_service

router = APIRouter(prefix="/auth", tags=["auth"])


class CredentialRequest(BaseModel):
    user_id: str
    password: str


class RegisterRequest(BaseModel):
    user_id: str
    email: str
    password: str
    verification_token: str | None = None


class SendOtpRequest(BaseModel):
    email: str


class VerifyOtpRequest(BaseModel):
    email: str
    otp_code: str


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_TOKEN_TTL_SECONDS,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/",
    )


@router.post("/email/send-otp", status_code=status.HTTP_202_ACCEPTED)
def send_email_otp(payload: SendOtpRequest, request: Request) -> dict[str, str]:
    requester_ip = request.client.host if request.client else "unknown"
    try:
        otp_service.send_otp(payload.email, requester_ip=requester_ip)
    except OtpThrottleError as err:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"reason": err.reason, "retry_after_seconds": err.retry_after_seconds},
            headers={"Retry-After": str(err.retry_after_seconds)},
        ) from err
    except ValueError as err:
        reason = str(err)
        if reason == "user_exists":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=reason) from err
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason) from err
    return {"status": "accepted"}


@router.post("/email/verify-otp")
def verify_email_otp(payload: VerifyOtpRequest) -> dict[str, str]:
    try:
        verification_token = otp_service.verify_otp(payload.email, payload.otp_code)
    except ValueError as err:
        reason = str(err)
        if reason in {"expired", "locked", "invalid_email"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason) from err
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=reason) from err
    return {"verification_token": verification_token}


@router.post("/register")
def register(payload: RegisterRequest, response: Response) -> dict[str, str]:
    if not auth_service.is_valid_email(payload.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_email")
    if not auth_service.is_valid_user_id(payload.user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_user_id")
    if not auth_service.is_valid_password(payload.password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_password")
    if not payload.verification_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="verification_required",
        )
    if auth_service.email_exists(payload.email) or auth_service.user_id_exists(payload.user_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="user_exists",
        )
    try:
        otp_service.validate_verification_token(payload.verification_token, email=payload.email)
    except ValueError as err:
        reason = str(err)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason) from err
    try:
        access_token, refresh_token = auth_service.register(
            user_id=payload.user_id,
            email=payload.email,
            password=payload.password,
        )
    except ValueError as err:
        if str(err) == "user_exists":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="user_exists",
            ) from err
        raise
    try:
        otp_service.consume_verification_token(payload.verification_token, email=payload.email)
    except ValueError as err:
        auth_service.delete_user(payload.user_id)
        reason = str(err)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason) from err
    _set_refresh_cookie(response, refresh_token)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login")
def login(payload: CredentialRequest, response: Response) -> dict[str, str]:
    try:
        access_token, refresh_token = auth_service.login(payload.user_id, payload.password)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_credentials",
        ) from err
    _set_refresh_cookie(response, refresh_token)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh")
def refresh(
    request: Request,
    response: Response,
) -> dict[str, str]:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        metrics.inc("refresh_failure")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_refresh_cookie"
        )
    try:
        access_token, rotated_refresh = auth_service.refresh(refresh_token)
    except TokenError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err.reason,
        ) from err
    _set_refresh_cookie(response, rotated_refresh)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> Response:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    auth_service.logout(refresh_token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_refresh_cookie(response)
    return response
