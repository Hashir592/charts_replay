"""
indicators.py
-------------
Technical indicator calculations.

All public functions accept a list of OHLCV candle dicts (as returned by
data.get_candles) and return a list of { time, value } dicts.

• RSI   — Wilder's smoothed RSI, period configurable (default 14).
          The first (period - 1) values are None (insufficient history).
• SMA   — Simple Moving Average, period configurable.
          The first (period - 1) values are None.
• Volume— Passthrough of the volume field; no transformation.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Type alias for readability
Candle = dict
IndicatorPoint = dict  # { time: int, value: float | None }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _closes(candles: list[Candle]) -> np.ndarray:
    return np.array([c["close"] for c in candles], dtype=float)


def _times(candles: list[Candle]) -> list[int]:
    return [c["time"] for c in candles]


# ── RSI ────────────────────────────────────────────────────────────────────────

def rsi(candles: list[Candle], period: int = 14) -> list[IndicatorPoint]:
    """
    Classic Wilder RSI.

    Algorithm:
      1. Calculate per-bar price changes (delta).
      2. Separate gains and losses.
      3. Seed the first average gain/loss with a simple mean over `period` bars.
      4. Apply Wilder's smoothing for subsequent bars:
           avg_gain = (prev_avg_gain * (period - 1) + current_gain) / period
      5. RSI = 100 - 100 / (1 + avg_gain / avg_loss)

    The first `period` entries (indices 0 … period-1) carry value=None because
    there is not enough history to compute a meaningful RSI.
    """
    if len(candles) < period + 1:
        # Not enough data — return all nulls
        return [{"time": c["time"], "value": None} for c in candles]

    closes = _closes(candles)
    times  = _times(candles)
    n      = len(closes)

    result: list[IndicatorPoint] = []

    # Pad the first `period` bars with None
    for i in range(period):
        result.append({"time": times[i], "value": None})

    # Compute deltas
    delta = np.diff(closes)  # length = n - 1

    gains  = np.where(delta > 0, delta, 0.0)
    losses = np.where(delta < 0, -delta, 0.0)

    # Seed: simple average of the first `period` gains/losses
    avg_gain = gains[:period].mean()
    avg_loss = losses[:period].mean()

    # First RSI value corresponds to index `period`
    def _rsi_value(ag: float, al: float) -> Optional[float]:
        if al == 0.0:
            return 100.0
        if ag == 0.0:
            return 0.0
        rs = ag / al
        return round(100.0 - 100.0 / (1.0 + rs), 4)

    result.append({"time": times[period], "value": _rsi_value(avg_gain, avg_loss)})

    # Wilder smoothing for the rest
    for i in range(period + 1, n):
        avg_gain = (avg_gain * (period - 1) + gains[i - 1]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i - 1]) / period
        result.append({"time": times[i], "value": _rsi_value(avg_gain, avg_loss)})

    return result


# ── SMA ────────────────────────────────────────────────────────────────────────

def sma(candles: list[Candle], period: int = 20) -> list[IndicatorPoint]:
    """
    Simple Moving Average of closing prices.

    Returns None for the first (period - 1) bars.
    """
    closes = _closes(candles)
    times  = _times(candles)
    n      = len(closes)
    result: list[IndicatorPoint] = []

    for i in range(n):
        if i < period - 1:
            result.append({"time": times[i], "value": None})
        else:
            mean_val = round(float(closes[i - period + 1 : i + 1].mean()), 8)
            result.append({"time": times[i], "value": mean_val})

    return result


# ── Volume ─────────────────────────────────────────────────────────────────────

def volume(candles: list[Candle]) -> list[IndicatorPoint]:
    """
    Passthrough volume indicator.

    Returns the raw volume for each bar as { time, value }.
    """
    return [{"time": c["time"], "value": round(c["volume"], 2)} for c in candles]
