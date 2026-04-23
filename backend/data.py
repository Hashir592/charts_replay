"""
data.py
-------
Fetches historical OHLCV candles from Yahoo Finance via yfinance.

Why yf.download() instead of Ticker.history()?
  yf.download() is more reliable against Yahoo Finance's rotating API
  endpoints.  Ticker.history() sometimes gets an empty JSON response
  ("Expecting value: line 1 column 1") when Yahoo rate-limits the
  metadata pre-flight request that Ticker makes before the actual
  download.

Multi-level column handling:
  yf.download() in yfinance ≥ 0.2.x returns a MultiIndex DataFrame
  when group_by='ticker' is used or when auto_adjust=True is set.
  We flatten to single-level before processing.

Symbol map
----------
  BTCUSD  → BTC-USD
  ETHUSD  → ETH-USD
  XAUUSD  → XAUUSD=X

Timeframe data-availability limits (Yahoo Finance free tier)
------------------------------------------------------------
  1m  — last 7 days only
  5m/15m/30m — last 60 days
  1h  — last 730 days (≈ 2 years)
  4h  — synthesised by resampling 1h bars (same 730-day limit)
  1d/1W — full history
"""

import time
import logging
from typing import Any

import yfinance as yf
import pandas as pd
import requests

from config import settings

logger = logging.getLogger(__name__)

# ── Symbol mapping ─────────────────────────────────────────────────────────────
SYMBOL_MAP: dict[str, str] = {
    "BTCUSD": "BTC-USD",
    "ETHUSD": "ETH-USD",
    "XAUUSD": "GC=F",   # Gold Futures
}

# ── Timeframe → (yf_interval, yf_period) ──────────────────────────────────────
TIMEFRAME_MAP: dict[str, tuple[str, str]] = {
    "1m":  ("1m",   "7d"),
    "5m":  ("5m",   "60d"),
    "15m": ("15m",  "60d"),
    "30m": ("30m",  "60d"),
    "1h":  ("60m",  "730d"),
    "4h":  ("60m",  "730d"),  # fetch 1h, resample to 4h in code
    "1d":  ("1d",   "5y"),
    "1W":  ("1wk",  "10y"),
}

# Timeframes that need server-side resampling
RESAMPLE_RULE: dict[str, str] = {
    "4h": "4h",
}

# ── In-memory cache ────────────────────────────────────────────────────────────
_cache: dict[str, dict[str, Any]] = {}


def _cache_key(symbol: str, timeframe: str) -> str:
    return f"{symbol}:{timeframe}"


def _is_cache_valid(entry: dict[str, Any]) -> bool:
    return (time.time() - entry["fetched_at"]) < settings.CACHE_TTL_SECONDS


# ── DataFrame helpers ──────────────────────────────────────────────────────────

def _flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    yf.download() returns a MultiIndex column header like:
      ('Open', 'BTC-USD'), ('High', 'BTC-USD'), …
    Flatten to simple names: Open, High, Low, Close, Volume.
    """
    if isinstance(df.columns, pd.MultiIndex):
        # Take only the first level (the price field name)
        df.columns = df.columns.get_level_values(0)
    return df


def _resample_ohlcv(df: pd.DataFrame, rule: str) -> pd.DataFrame:
    """Resample OHLCV from a finer timeframe into a coarser one."""
    resampled = df.resample(rule, label="left", closed="left").agg(
        {
            "Open":   "first",
            "High":   "max",
            "Low":    "min",
            "Close":  "last",
            "Volume": "sum",
        }
    )
    return resampled.dropna(subset=["Open", "Close"])


def _df_to_candles(df: pd.DataFrame) -> list[dict]:
    """
    Convert DatetimeIndex OHLCV DataFrame → list of candle dicts,
    sorted oldest → newest.
    """
    df = df.sort_index()
    candles: list[dict] = []
    for ts, row in df.iterrows():
        unix_ts = int(ts.timestamp()) if hasattr(ts, "timestamp") else int(ts)
        candles.append(
            {
                "time":   unix_ts,
                "open":   round(float(row["Open"]),   8),
                "high":   round(float(row["High"]),   8),
                "low":    round(float(row["Low"]),    8),
                "close":  round(float(row["Close"]),  8),
                "volume": round(float(row["Volume"]), 2),
            }
        )
    return candles


# ── Fetcher ────────────────────────────────────────────────────────────────────

def _fetch_from_yahoo(yf_ticker: str, yf_interval: str, yf_period: str) -> pd.DataFrame:
    """
    Download OHLCV data from Yahoo Finance using yf.download().

    Returns a DataFrame with columns: Open, High, Low, Close, Volume
    and a DatetimeIndex.

    Retries once on empty result (Yahoo occasionally returns nothing on
    the first hit due to a session cookie race-condition).
    """
    common_kwargs = dict(
        tickers=yf_ticker,
        interval=yf_interval,
        period=yf_period,
        auto_adjust=True,   # adjusts for splits/dividends; removes Adj Close
        progress=False,     # suppress tqdm progress bar in server logs
    )

    for attempt in (1, 2):
        logger.info(
            "yf.download attempt %d — ticker=%s interval=%s period=%s",
            attempt, yf_ticker, yf_interval, yf_period,
        )
        df = yf.download(**common_kwargs)

        if df is not None and not df.empty:
            break

        if attempt == 1:
            logger.warning(
                "Empty result on attempt 1 for %s — waiting 2 s then retrying",
                yf_ticker,
            )
            time.sleep(2)

    return df


def get_candles(symbol: str, timeframe: str) -> list[dict]:
    """
    Return OHLCV candle list for the given symbol/timeframe.

    Raises ValueError on unknown inputs or empty Yahoo Finance results.
    """
    if symbol not in SYMBOL_MAP:
        raise ValueError(
            f"Unknown symbol '{symbol}'. Valid: {list(SYMBOL_MAP)}"
        )
    if timeframe not in TIMEFRAME_MAP:
        raise ValueError(
            f"Unknown timeframe '{timeframe}'. Valid: {list(TIMEFRAME_MAP)}"
        )

    key = _cache_key(symbol, timeframe)
    if key in _cache and _is_cache_valid(_cache[key]):
        logger.debug("Cache hit — %s", key)
        return _cache[key]["data"]

    yf_ticker              = SYMBOL_MAP[symbol]
    yf_interval, yf_period = TIMEFRAME_MAP[timeframe]

    try:
        df = _fetch_from_yahoo(yf_ticker, yf_interval, yf_period)
    except Exception as exc:
        logger.exception("yf.download raised for %s / %s", symbol, timeframe)
        raise ValueError(f"Yahoo Finance fetch error: {exc}") from exc

    if df is None or df.empty:
        raise ValueError(
            f"No data returned by Yahoo Finance for {symbol} ({yf_ticker}) "
            f"at timeframe {timeframe} (interval={yf_interval}, period={yf_period}). "
            "Note: 1m data is only available for the last 7 days."
        )

    # Flatten MultiIndex columns produced by yf.download()
    df = _flatten_columns(df)

    # Keep only standard OHLCV columns
    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()

    # Resample if needed (4h synthesised from 1h bars)
    if timeframe in RESAMPLE_RULE:
        df = _resample_ohlcv(df, RESAMPLE_RULE[timeframe])

    if df.empty:
        raise ValueError(
            f"No candles remaining after processing {symbol} {timeframe}."
        )

    candles = _df_to_candles(df)
    _cache[key] = {"data": candles, "fetched_at": time.time()}
    logger.info("Cached %d candles for %s", len(candles), key)
    return candles
