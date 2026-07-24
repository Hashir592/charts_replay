import React, { useState } from 'react';
import { CandlestickChart } from 'lucide-react';

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username || !pin) {
      setError('Username and PIN are required.');
      return;
    }
    if (pin.length !== 4 || isNaN(pin)) {
      setError('PIN must be 4 digits.');
      return;
    }
    const res = onLogin(username, pin, isNew);
    if (!res.success) setError(res.message);
  };

  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-brand">
          <span className="login-logo">
            <CandlestickChart size={24} />
          </span>
          <h2>ChartReplay</h2>
          <p>Paper trading on historical charts</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              placeholder="trader123"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>4-digit PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.trim().slice(0, 4))}
              placeholder="••••"
              maxLength={4}
              inputMode="numeric"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            {isNew ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="login-hint">
          {isNew ? 'Already have an account?' : "Don't have an account?"}
          <button
            type="button"
            onClick={() => {
              setIsNew(!isNew);
              setError('');
            }}
          >
            {isNew ? 'Sign in' : 'Create one'}
          </button>
        </div>
      </div>
    </div>
  );
}
