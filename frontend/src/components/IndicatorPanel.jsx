import React from 'react';

export default function IndicatorPanel({ indicators, setIndicators, onSmaUpdate }) {
  const toggleIndicator = (key) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePeriodChange = (key, valStr) => {
    const val = parseInt(valStr, 10);
    if (!isNaN(val) && val > 0) {
      setIndicators((prev) => ({ ...prev, [key]: val }));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSmaUpdate) {
      onSmaUpdate();
    }
  };

  return (
    <div className="indicator-panel">
      <div className="indicator-item">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={indicators.rsi}
            onChange={() => toggleIndicator('rsi')}
          />
          RSI (14)
        </label>
      </div>

      <div className="indicator-item">
        <label className="checkbox-label" style={{ color: '#ffcc00' }}>
          <input
            type="checkbox"
            checked={indicators.sma1}
            onChange={() => toggleIndicator('sma1')}
          />
          SMA 1
        </label>
        <input
          type="number"
          className="period-input"
          value={indicators.sma1Period}
          onChange={(e) => handlePeriodChange('sma1Period', e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!indicators.sma1}
          min="2"
          max="500"
        />
      </div>

      <div className="indicator-item">
        <label className="checkbox-label" style={{ color: '#00bcd4' }}>
          <input
            type="checkbox"
            checked={indicators.sma2}
            onChange={() => toggleIndicator('sma2')}
          />
          SMA 2
        </label>
        <input
          type="number"
          className="period-input"
          value={indicators.sma2Period}
          onChange={(e) => handlePeriodChange('sma2Period', e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!indicators.sma2}
          min="2"
          max="500"
        />
      </div>
    </div>
  );
}
