import React, { useRef } from 'react';
import { X } from 'lucide-react';
import useClickOutside from '../hooks/useClickOutside';
import { INDICATOR_COLORS } from '../constants';

function Toggle({ checked, onChange }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  );
}

function Row({ color, name, desc, checked, onToggle, period, onPeriod }) {
  return (
    <div className="indicator-row">
      <span className="indicator-swatch" style={{ background: color }} />
      <span>
        <div className="indicator-name">{name}</div>
        <div className="indicator-desc">{desc}</div>
      </span>
      <span className="spacer" />
      {onPeriod && (
        <input
          type="number"
          className="period-input"
          value={period}
          min="2"
          max="500"
          disabled={!checked}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v > 0) onPeriod(v);
          }}
        />
      )}
      <Toggle checked={checked} onChange={onToggle} />
    </div>
  );
}

export default function IndicatorsDialog({ indicators, setIndicators, onClose }) {
  const boxRef = useRef(null);
  useClickOutside(boxRef, onClose);

  const set = (patch) => setIndicators((prev) => ({ ...prev, ...patch }));

  return (
    <div className="modal-overlay">
      <div className="modal-box indicators-dialog" ref={boxRef}>
        <div className="modal-header">
          <h3>Indicators</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: 8 }}>
          <Row
            color={INDICATOR_COLORS.sma1}
            name="Moving Average"
            desc={`Simple, ${indicators.sma1Period} periods`}
            checked={indicators.sma1}
            onToggle={(v) => set({ sma1: v })}
            period={indicators.sma1Period}
            onPeriod={(v) => set({ sma1Period: v })}
          />
          <Row
            color={INDICATOR_COLORS.sma2}
            name="Moving Average"
            desc={`Simple, ${indicators.sma2Period} periods`}
            checked={indicators.sma2}
            onToggle={(v) => set({ sma2: v })}
            period={indicators.sma2Period}
            onPeriod={(v) => set({ sma2Period: v })}
          />
          <Row
            color={INDICATOR_COLORS.rsi}
            name="Relative Strength Index"
            desc="14 periods · separate pane"
            checked={indicators.rsi}
            onToggle={(v) => set({ rsi: v })}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
