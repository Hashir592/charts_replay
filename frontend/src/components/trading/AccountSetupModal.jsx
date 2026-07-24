import React, { useState } from 'react';

const BALANCE_PRESETS = [1000, 5000, 10000, 25000, 100000];
const LEVERAGE_PRESETS = [1, 2, 5, 10, 20, 50, 100];

export default function AccountSetupModal({ onSave }) {
  const [balance, setBalance] = useState(10000);
  const [currency, setCurrency] = useState('USD');
  const [leverage, setLeverage] = useState(100);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(balance, currency, leverage);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h2>Set up your account</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Starting balance</label>
              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(Number(e.target.value))}
                min="100"
                step="100"
              />
              <div className="chip-row" style={{ marginTop: 8 }}>
                {BALANCE_PRESETS.map((b) => (
                  <button
                    type="button"
                    key={b}
                    className={`chip ${Number(balance) === b ? 'active' : ''}`}
                    onClick={() => setBalance(b)}
                  >
                    {b.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Currency</label>
              <div className="chip-row">
                {['USD', 'GBP', 'EUR'].map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`chip ${currency === c ? 'active' : ''}`}
                    onClick={() => setCurrency(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Leverage</label>
              <div className="chip-row">
                {LEVERAGE_PRESETS.map((l) => (
                  <button
                    type="button"
                    key={l}
                    className={`chip ${Number(leverage) === l ? 'active' : ''}`}
                    onClick={() => setLeverage(l)}
                  >
                    1:{l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="submit" className="btn btn-primary">
              Start trading
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
