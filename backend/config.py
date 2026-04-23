"""
config.py
---------
Centralised environment variable management.
All configurable values are read here — nothing is hard-coded elsewhere.

Load order:
  1. .env file (local development)
  2. Real environment variables (production / Render.com)
"""

import os
from dotenv import load_dotenv

# Load .env only when it exists (ignored on Render where vars are injected)
load_dotenv()


class Settings:
    # ── Server ────────────────────────────────────────────────────────────────
    # Render.com injects PORT automatically; default 8000 for local dev.
    PORT: int = int(os.getenv("PORT", "8000"))

    # Bind to all interfaces so Render (and Docker) can reach the process.
    HOST: str = os.getenv("HOST", "0.0.0.0")

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins.
    # Set to your Vercel URL in production, e.g.:
    #   FRONTEND_URL=https://my-app.vercel.app
    # Default "*" keeps local dev zero-friction.
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "*")

    @property
    def allowed_origins(self) -> list[str]:
        """Return a list of allowed CORS origins."""
        raw = self.FRONTEND_URL.strip()
        if raw == "*":
            return ["*"]
        # Support multiple origins separated by commas
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    # ── Cache ─────────────────────────────────────────────────────────────────
    # How long (seconds) to keep fetched OHLCV data in the in-memory cache.
    CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "300"))

    # ── App metadata ──────────────────────────────────────────────────────────
    APP_TITLE: str = "TradingView Replay API"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = (
        "Historical OHLCV data and technical indicators for BTC, ETH, and Gold."
    )

    # ── Environment tag ───────────────────────────────────────────────────────
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")


# Singleton — import this everywhere
settings = Settings()
