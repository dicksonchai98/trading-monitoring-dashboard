"""Structured logging helpers for batch jobs."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class JobLogContext:
    job_id: int | str | None
    job_type: str
    execution_stage: str


class JobLoggerAdapter(logging.LoggerAdapter):
    def process(self, msg: str, kwargs: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        extra = kwargs.setdefault("extra", {})
        extra.setdefault("job_id", self.extra.get("job_id"))
        extra.setdefault("job_type", self.extra.get("job_type"))
        extra.setdefault("execution_stage", self.extra.get("execution_stage"))
        extra.setdefault("elapsed_time", self.extra.get("elapsed_time"))
        extra.setdefault("error_message", self.extra.get("error_message"))
        return msg, kwargs


def get_job_logger(
    name: str,
    context: JobLogContext,
    elapsed_time: float | None = None,
    error_message: str | None = None,
) -> JobLoggerAdapter:
    base = logging.getLogger(name)
    return JobLoggerAdapter(
        base,
        {
            "job_id": context.job_id,
            "job_type": context.job_type,
            "execution_stage": context.execution_stage,
            "elapsed_time": elapsed_time,
            "error_message": error_message,
        },
    )
