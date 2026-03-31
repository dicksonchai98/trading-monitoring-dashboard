from __future__ import annotations

from app.services.sendgrid_provider import SendGridProvider


class _FakeResponse:
    def __init__(
        self, status_code: int, headers: dict[str, str] | None = None, text: str = ""
    ) -> None:
        self.status_code = status_code
        self.headers = headers or {}
        self.text = text


class _FakeHttp:
    def __init__(self, response: _FakeResponse) -> None:
        self._response = response
        self.calls: list[dict[str, object]] = []

    def post(self, url: str, *, headers: dict[str, str], json: dict[str, object]):
        self.calls.append({"url": url, "headers": headers, "json": json})
        return self._response


def test_sendgrid_provider_maps_success_response() -> None:
    fake_http = _FakeHttp(_FakeResponse(202, headers={"X-Message-Id": "sg-123"}))
    provider = SendGridProvider(
        api_key="k", from_email="noreply@example.com", http_client=fake_http
    )  # type: ignore[arg-type]

    result = provider.send(
        recipient="u@example.com",
        template_name="d-template",
        payload={"otp_code": "123456"},
    )

    assert result.accepted is True
    assert result.provider == "sendgrid"
    assert result.provider_message_id == "sg-123"
    assert fake_http.calls[0]["url"] == "https://api.sendgrid.com/v3/mail/send"
