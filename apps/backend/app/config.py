"""Static runtime configuration for the backend MVP."""

ACCESS_TOKEN_TTL_SECONDS = 60 * 60
REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
JWT_SECRET = "dev-secret-change-me"
REFRESH_COOKIE_NAME = "refresh_token"

