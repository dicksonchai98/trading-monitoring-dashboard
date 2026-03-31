from __future__ import annotations

from app import config


def test_otp_email_defaults() -> None:
    assert config.OTP_TTL_SECONDS == 300
    assert config.OTP_RESEND_COOLDOWN_SECONDS == 60
    assert config.SENDGRID_API_KEY == ""
    assert config.SENDGRID_OTP_TEMPLATE_ID == "otp_verification"
    assert config.OTP_CHANNEL == "email"
