import React, { useState } from 'react';
import { X } from 'lucide-react';
import { calculateMargin } from '../../utils/tradeCalculations';
import { getSymbolMeta } from '../../constants';

export default function TradePanel({
  session,
  symbolsInfo,
  currentSymbol,
  currentPrice,
  currentBarIndex,
  placeTrade,
  onClose,
}) {
  const [orderType, setOrderType] = useState('MARKET');
  const [direction, setDirection] = useState('BUY');
  const [lots, setLots] = useState(0.01);
  const [limitPrice, setLimitPrice] = useState('');
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');

  const symbolInfo = symbolsInfo.find((s) => s.id === currentSymbol);
  const digits = getSymbolMeta(currentSymbol).digits;

  const entryPrice =
    orderType === 'LIMIT' ? parseFloat(limitPrice) || currentPrice : currentPrice;

  const marginRequired = symbolInfo
    ? calculateMargin(
        entryPrice,
        parseFloat(lots) || 0,
        symbolInfo.contractSize,
        session.account.leverage
      )
    : 0;

  // Risk / reward straight from the TP and SL the user typed.
  const contract = symbolInfo?.contractSize || 1;
  const lotsNum = parseFloat(lots) || 0;
  const dir = direction === 'BUY' ? 1 : -1;
  const riskAmount = sl ? Math.abs(entryPrice - parseFloat(sl)) * lotsNum * contract : null;
  const rewardAmount = tp ? Math.abs(parseFloat(tp) - entryPrice) * lotsNum * contract : null;
  const rr = riskAmount && rewardAmount ? rewardAmount / riskAmount : null;

  const tpInvalid = tp && dir * (parseFloat(tp) - entryPrice) <= 0;
  const slInvalid = sl && dir * (parseFloat(sl) - entryPrice) >= 0;
  const canSubmit =
    lotsNum > 0 &&
    !tpInvalid &&
    !slInvalid &&
    (orderType === 'MARKET' || parseFloat(limitPrice) > 0);

  const handlePlaceTrade = () => {
    placeTrade({
      symbol: currentSymbol,
      direction,
      lots: parseFloat(lots),
      type: orderType,
      limitPrice: orderType === 'LIMIT' ? parseFloat(limitPrice) : null,
      tp: tp ? parseFloat(tp) : null,
      sl: sl ? parseFloat(sl) : null,
      currentPrice,
      currentBarIndex,
    });
    onClose();
  };

  const money = (v) => `$${v.toFixed(2)}`;

  return (
    <div className="trade-panel">
      <div className="trade-panel-header">
        <h3>{currentSymbol} · New order</h3>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="trade-panel-body">
        <div className="seg-group">
          <button
            className={orderType === 'MARKET' ? 'active' : ''}
            onClick={() => setOrderType('MARKET')}
          >
            Market
          </button>
          <button
            className={orderType === 'LIMIT' ? 'active' : ''}
            onClick={() => setOrderType('LIMIT')}
          >
            Limit
          </button>
        </div>

        <div className="directions mt-2">
          <button
            className={`btn-buy ${direction === 'BUY' ? 'active' : ''}`}
            onClick={() => setDirection('BUY')}
          >
            BUY
          </button>
          <button
            className={`btn-sell ${direction === 'SELL' ? 'active' : ''}`}
            onClick={() => setDirection('SELL')}
          >
            SELL
          </button>
        </div>

        {orderType === 'LIMIT' && (
          <div className="form-group mt-2">
            <label>Limit price</label>
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              step="any"
              placeholder={currentPrice.toFixed(digits)}
            />
          </div>
        )}

        <div className="form-group mt-2">
          <label>Lots</label>
          <input
            type="number"
            value={lots}
            onChange={(e) => setLots(e.target.value)}
            step="0.01"
            min="0.01"
          />
        </div>

        <div className="form-group mt-2">
          <label>Take profit</label>
          <input
            type="number"
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            step="any"
            placeholder="Optional"
          />
          {tpInvalid && (
            <div className="error-text" style={{ marginTop: 5 }}>
              TP must be {direction === 'BUY' ? 'above' : 'below'} the entry price.
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Stop loss</label>
          <input
            type="number"
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            step="any"
            placeholder="Optional"
          />
          {slInvalid && (
            <div className="error-text" style={{ marginTop: 5 }}>
              SL must be {direction === 'BUY' ? 'below' : 'above'} the entry price.
            </div>
          )}
        </div>

        <div className="trade-info">
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Entry</span>
          <span>{entryPrice.toFixed(digits)}</span>
        </div>
        <div className="trade-info" style={{ marginTop: 4 }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Margin required</span>
          <span>{money(marginRequired)}</span>
        </div>
        {riskAmount != null && (
          <div className="trade-info" style={{ marginTop: 4 }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Risk</span>
            <span className="loss">{money(riskAmount)}</span>
          </div>
        )}
        {rewardAmount != null && (
          <div className="trade-info" style={{ marginTop: 4 }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Reward</span>
            <span className="profit">{money(rewardAmount)}</span>
          </div>
        )}
        {rr != null && isFinite(rr) && (
          <div className="trade-info" style={{ marginTop: 4 }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Risk / reward</span>
            <span>1 : {rr.toFixed(2)}</span>
          </div>
        )}

        <button
          className={`btn-place-trade mt-3 ${direction.toLowerCase()}`}
          onClick={handlePlaceTrade}
          disabled={!canSubmit}
          style={!canSubmit ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          {direction} {lots} {currentSymbol}
        </button>
      </div>
    </div>
  );
}
