"""Realtime routes with public and protected SSE endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.deps import Principal, require_user_or_admin

router = APIRouter(prefix="/realtime", tags=["realtime"])


def _sse_message(event: str, data: str) -> bytes:
    return f"event: {event}\ndata: {data}\n\n".encode()


@router.get("/strength")
def strength() -> StreamingResponse:
    def stream():
        yield _sse_message("strength", '{"value":"public"}')

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.get("/weighted")
def weighted(_: Principal = Depends(require_user_or_admin)) -> StreamingResponse:
    def stream():
        yield _sse_message("weighted", '{"value":"protected"}')

    return StreamingResponse(stream(), media_type="text/event-stream")
