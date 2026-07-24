import React, { useEffect, useState } from 'react';
import { Clock, PanelBottom, Maximize2 } from 'lucide-react';
import { getSymbolMeta, getTimeframeMeta } from '../constants';

/** The thin strip TradingView keeps pinned to the bottom of the workspace. */
export default function StatusBar({
  symbol,
  timeframe,
  isReplayMode,
  isLoading,
  error,
  barCount,
  showPositions,
  onTogglePositions,
  onFitContent,
}) {
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const status = error
    ? { text: 'Disconnected', off: true }
    : isLoading
    ? { text: 'Loading', off: true }
    : { text: 'Data loaded', off: false };

  return (
    <div className="status-bar">
      <div className="status-item">
        <span className={`status-dot ${status.off ? 'off' : ''}`} />
        {status.text}
      </div>

      <div className="status-item">
        {symbol} · {getSymbolMeta(symbol).name}
      </div>

      <div className="status-item">{getTimeframeMeta(timeframe).long}</div>

      {barCount > 0 && <div className="status-item">{barCount.toLocaleString()} bars</div>}

      {isReplayMode && (
        <div className="status-item" style={{ color: 'var(--warn-color)' }}>
          Replay active
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div className="status-item clickable" onClick={onFitContent} title="Fit chart to data">
        <Maximize2 size={12} />
        Fit
      </div>

      <div
        className="status-item clickable"
        onClick={onTogglePositions}
        title="Toggle positions panel (P)"
      >
        <PanelBottom size={12} />
        {showPositions ? 'Hide panel' : 'Show panel'}
      </div>

      <div className="status-item">
        <Clock size={12} />
        {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  );
}
