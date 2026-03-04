"""Auth routes for register, login, and refresh flows."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel

from app.config import REFRESH_COOKIE_NAME, REFRESH_TOKEN_TTL_SECONDS
from app.services.token_service import TokenError
from app.state import auth_service, metrics

router = APIRouter(prefix="/auth", tags=["auth"])


class CredentialRequest(BaseModel):
    username: str
    password: str


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


@router.post("/register")
def register(payload: CredentialRequest, response: Response) -> dict[str, str]:
    try:
        access_token, refresh_token = auth_service.register(payload.username, payload.password)
    except ValueError as err:
        if str(err) == "user_exists":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="user_exists",
            ) from err
        raise
    _set_refresh_cookie(response, refresh_token)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login")
def login(payload: CredentialRequest, response: Response) -> dict[str, str]:
    try:
        access_token, refresh_token = auth_service.login(payload.username, payload.password)
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
