import React, { useState } from 'react';
import { calculateStats, calculatePnL } from '../../utils/tradeCalculations';

const CURRENCY_SYMBOLS = { USD: '$', GBP: '£', EUR: '€' };

function Stat({ label, value, className = '', secondary = false }) {
  return (
    <div className={`stat-item ${secondary ? 'secondary-stat' : ''}`}>
      {label}
      <span className={`stat-value ${className}`}>{value}</span>
    </div>
  );
}

export default function AccountBar({ session, currentSymbol, currentPrice, symbolsInfo }) {
  const [showMore, setShowMore] = useState(false);

  const { account, openTrades, pendingOrders, trades } = session;
  if (!account) return null;

  const floatingPnL = openTrades.reduce((sum, t) => {
    if (t.symbol === currentSymbol) {
      const symbolInfo = symbolsInfo.find((s) => s.id === t.symbol);
      if (symbolInfo) {
        return sum + calculatePnL(t.openPrice, currentPrice, t.direction, t.lots, symbolInfo);
      }
    }
    return sum + (t.floatingPnL || 0);
  }, 0);

  const equity = account.currentBalance + floatingPnL;
  const usedMargin =
    openTrades.reduce((sum, t) => sum + t.margin, 0) +
    pendingOrders.reduce((sum, t) => sum + t.margin, 0);
  const freeMargin = equity - usedMargin;
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : null;

  const stats = calculateStats(trades, account.startingBalance);
  const sym = CURRENCY_SYMBOLS[account.currency] || '$';
  const money = (v) =>
    `${sym}${v.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className={`account-bar ${showMore ? 'expanded' : ''}`}>
      <Stat label="Balance" value={money(account.currentBalance)} />
      <Stat label="Equity" value={money(equity)} />
      <Stat
        label="Floating P&L"
        value={`${floatingPnL >= 0 ? '+' : '−'}${money(Math.abs(floatingPnL))}`}
        className={floatingPnL >= 0 ? 'profit' : 'loss'}
      />
      <Stat label="Margin" value={money(usedMargin)} secondary />
      <Stat label="Free" value={money(freeMargin)} secondary />
      {marginLevel !== null && (
        <Stat
          label="Margin level"
          value={`${marginLevel.toFixed(0)}%`}
          className={marginLevel < 100 ? 'loss' : ''}
          secondary
        />
      )}
      <Stat label="Leverage" value={`1:${account.leverage}`} secondary />
      <Stat label="Win rate" value={`${stats.winRate.toFixed(1)}%`} secondary />
      <Stat label="Trades" value={stats.totalTrades} secondary />

      <button className="account-bar-more-btn" onClick={() => setShowMore(!showMore)}>
        {showMore ? 'Less ▴' : 'More ▾'}
      </button>
    </div>
  );
}
