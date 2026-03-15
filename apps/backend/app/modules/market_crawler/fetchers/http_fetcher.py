"""HTTP fetcher for crawler sources."""

from __future__ import annotations

from datetime import date, datetime, timezone

import httpx

from app.modules.market_crawler.domain.contracts import FetchedPayload


class HttpFetcher:
    def __init__(self, timeout_seconds: float = 20.0) -> None:
        self._timeout = timeout_seconds

    def fetch(self, endpoint_template: str, target_date: date | None = None) -> FetchedPayload:
        url = self._format_endpoint(endpoint_template, target_date)
        response = httpx.get(url, timeout=self._timeout)
        if response.status_code >= 400:
            raise RuntimeError(f"http {response.status_code}")
        content_type = response.headers.get("content-type", "application/octet-stream")
        return FetchedPayload(
            content=response.content,
            content_type=content_type,
            fetched_at=datetime.now(tz=timezone.utc),
            source_url=url,
        )

    @staticmethod
    def _format_endpoint(template: str, target_date: date | None) -> str:
        if target_date is None:
            return template
        if "{date}" in template:
            return template.format(date=target_date.isoformat())
        if "{target_date}" in template:
            return template.format(target_date=target_date.isoformat())
        return template
