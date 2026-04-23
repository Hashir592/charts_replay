import React, { useState } from 'react';
import { Settings } from 'lucide-react';

const SYMBOLS = ['BTCUSD', 'ETHUSD', 'XAUUSD'];
const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1W'];

export default function TopBar({ 
  symbol, setSymbol, 
  timeframe, setTimeframe, 
  isLoading, isReplayMode, startReplay,
  chartType, setChartType,
  crosshairEnabled, setCrosshairEnabled
}) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="top-bar">
      <div className="brand">TradingView Clone</div>
      
      {isReplayMode && <div className="replay-badge">REPLAY MODE</div>}
      
      <div className="selector-group">
        {SYMBOLS.map((s) => (
          <button
            key={s}
            className={`selector-btn ${symbol === s ? 'active' : ''}`}
            onClick={() => setSymbol(s)}
            disabled={isLoading}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="selector-group">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            className={`selector-btn ${timeframe === tf ? 'active' : ''}`}
            onClick={() => setTimeframe(tf)}
            disabled={isLoading}
          >
            {tf}
          </button>
        ))}
      </div>
      
      {!isReplayMode && (
        <button 
          className="selector-btn replay-toggle"
          onClick={startReplay}
          disabled={isLoading}
        >
          ⏪ Replay
        </button>
      )}
      
      {isLoading && <div className="loading-spinner">Loading...</div>}

      <div style={{ position: 'relative', marginLeft: 'auto' }}>
        <button 
          className="selector-btn"
          onClick={() => setShowSettings(!showSettings)}
          title="Chart Settings"
        >
          <Settings size={18} />
        </button>
        
        {showSettings && (
          <div className="settings-dropdown">
            <div className="settings-row">
              <label>Chart Type</label>
              <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
                <option value="candles">Candles</option>
                <option value="bars">Bars</option>
                <option value="line">Line</option>
              </select>
            </div>
            <div className="settings-row">
              <label>
                <input 
                  type="checkbox" 
                  checked={crosshairEnabled} 
                  onChange={(e) => setCrosshairEnabled(e.target.checked)} 
                />
                Enable Crosshair
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
