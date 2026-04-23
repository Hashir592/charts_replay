"""
main.py
-------
FastAPI application entry point.

Routes
------
  GET /health                                     → Render health check
  GET /candles?symbol=&timeframe=                 → OHLCV candle list
  GET /indicators/rsi?symbol=&timeframe=&period=  → RSI values
  GET /indicators/sma?symbol=&timeframe=&period=  → SMA values
  GET /indicators/volume?symbol=&timeframe=       → Volume values

All success responses:  { "data": [...], "error": null }
All error responses:    { "data": null,  "error": "message" }

Run locally:
  uvicorn main:app --reload
"""

import logging
from contextlib import asynccontextmanager
from typing import Any, Optional

import uvicorn
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import data as data_module
import indicators as ind_module
from config import settings

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Starting %s v%s [env=%s, port=%s]",
        settings.APP_TITLE,
        settings.APP_VERSION,
        settings.ENVIRONMENT,
        settings.PORT,
    )
    yield
    logger.info("Shutting down %s", settings.APP_TITLE)


# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description=settings.APP_DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Origins are read from the FRONTEND_URL env var (see config.py).
# In production set FRONTEND_URL=https://your-app.vercel.app on Render.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


# ── Pydantic response models ───────────────────────────────────────────────────
class APIResponse(BaseModel):
    """
    Consistent envelope for every response.

      Success: { data: [...], error: null }
      Error:   { data: null,  error: "human-readable message" }
    """
    data: Optional[Any] = None
    error: Optional[str] = None


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content=APIResponse(data=None, error="Internal server error").model_dump(),
    )


# ── Helpers ───────────────────────────────────────────────────────────────────
VALID_SYMBOLS = list(data_module.SYMBOL_MAP.keys())
VALID_TIMEFRAMES = list(data_module.TIMEFRAME_MAP.keys())


def _error(message: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=APIResponse(data=None, error=message).model_dump(),
    )


def _ok(data: Any) -> JSONResponse:
    return JSONResponse(
        status_code=200,
        content=APIResponse(data=data, error=None).model_dump(),
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get(
    "/health",
    summary="Health check",
    description="Used by Render.com to verify the service is running.",
    tags=["Meta"],
)
async def health() -> dict:
    return {"status": "ok"}


@app.get(
    "/candles",
    summary="OHLCV candle data",
    description=(
        "Returns historical OHLCV candles for the given symbol and timeframe. "
        "Note: 1m data is limited to the last 7 days by Yahoo Finance."
    ),
    tags=["Market Data"],
    response_model=APIResponse,
)
async def get_candles(
    symbol: str = Query(
        ...,
        description=f"Trading symbol. One of: {VALID_SYMBOLS}",
        examples=["BTCUSD"],
    ),
    timeframe: str = Query(
        ...,
        description=f"Candle timeframe. One of: {VALID_TIMEFRAMES}",
        examples=["1h"],
    ),
):
    symbol = symbol.upper()
    if symbol not in VALID_SYMBOLS:
        return _error(f"Invalid symbol '{symbol}'. Valid: {VALID_SYMBOLS}")
    if timeframe not in VALID_TIMEFRAMES:
        return _error(f"Invalid timeframe '{timeframe}'. Valid: {VALID_TIMEFRAMES}")

    try:
        candles = data_module.get_candles(symbol, timeframe)
    except ValueError as exc:
        return _error(str(exc))

    return _ok(candles)


@app.get(
    "/indicators/rsi",
    summary="Relative Strength Index (RSI)",
    description=(
        "Wilder's RSI using closing prices. "
        "The first (period-1) values are null due to insufficient history."
    ),
    tags=["Indicators"],
    response_model=APIResponse,
)
async def get_rsi(
    symbol: str = Query(..., description=f"One of: {VALID_SYMBOLS}", examples=["BTCUSD"]),
    timeframe: str = Query(..., description=f"One of: {VALID_TIMEFRAMES}", examples=["1h"]),
    period: int = Query(14, ge=2, le=200, description="RSI look-back period (default 14)"),
):
    symbol = symbol.upper()
    if symbol not in VALID_SYMBOLS:
        return _error(f"Invalid symbol '{symbol}'. Valid: {VALID_SYMBOLS}")
    if timeframe not in VALID_TIMEFRAMES:
        return _error(f"Invalid timeframe '{timeframe}'. Valid: {VALID_TIMEFRAMES}")

    try:
        candles = data_module.get_candles(symbol, timeframe)
    except ValueError as exc:
        return _error(str(exc))

    result = ind_module.rsi(candles, period=period)
    return _ok(result)


@app.get(
    "/indicators/sma",
    summary="Simple Moving Average (SMA)",
    description=(
        "SMA of closing prices over `period` bars. "
        "The first (period-1) values are null."
    ),
    tags=["Indicators"],
    response_model=APIResponse,
)
async def get_sma(
    symbol: str = Query(..., description=f"One of: {VALID_SYMBOLS}", examples=["BTCUSD"]),
    timeframe: str = Query(..., description=f"One of: {VALID_TIMEFRAMES}", examples=["1h"]),
    period: int = Query(20, ge=2, le=500, description="SMA look-back period (default 20)"),
):
    symbol = symbol.upper()
    if symbol not in VALID_SYMBOLS:
        return _error(f"Invalid symbol '{symbol}'. Valid: {VALID_SYMBOLS}")
    if timeframe not in VALID_TIMEFRAMES:
        return _error(f"Invalid timeframe '{timeframe}'. Valid: {VALID_TIMEFRAMES}")

    try:
        candles = data_module.get_candles(symbol, timeframe)
    except ValueError as exc:
        return _error(str(exc))

    result = ind_module.sma(candles, period=period)
    return _ok(result)


@app.get(
    "/indicators/volume",
    summary="Volume",
    description="Raw trading volume for each candle as { time, value }.",
    tags=["Indicators"],
    response_model=APIResponse,
)
async def get_volume(
    symbol: str = Query(..., description=f"One of: {VALID_SYMBOLS}", examples=["BTCUSD"]),
    timeframe: str = Query(..., description=f"One of: {VALID_TIMEFRAMES}", examples=["1h"]),
):
    symbol = symbol.upper()
    if symbol not in VALID_SYMBOLS:
        return _error(f"Invalid symbol '{symbol}'. Valid: {VALID_SYMBOLS}")
    if timeframe not in VALID_TIMEFRAMES:
        return _error(f"Invalid timeframe '{timeframe}'. Valid: {VALID_TIMEFRAMES}")

    try:
        candles = data_module.get_candles(symbol, timeframe)
    except ValueError as exc:
        return _error(str(exc))

    result = ind_module.volume(candles)
    return _ok(result)


# ── Dev entrypoint ────────────────────────────────────────────────────────────
# Render uses the start command in render.yaml; this block is for local dev only.
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
