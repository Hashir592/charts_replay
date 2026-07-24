import React, { useState, useEffect, useRef } from 'react';
import { calculatePnL, calculateMargin } from '../../utils/tradeCalculations';

export default function TradeRow({ 
  trade, 
  isOpen, 
  isPending, 
  isClosed, 
  onClose, 
  onModify, 
  onPartialClose, 
  onCancel, 
  currentPrice, 
  currentSymbol,
  symbolsInfo, 
  account,
  activeAccordionId,
  setActiveAccordionId,
  activeFormType
}) {
  const [localFormState, setLocalFormState] = useState(null);
  
  // States for forms
  const [tp, setTp] = useState(trade.tp || '');
  const [sl, setSl] = useState(trade.sl || '');
  const [lotsToClose, setLotsToClose] = useState(trade.lots);
  
  const [limitPrice, setLimitPrice] = useState(trade.limitPrice || '');
  const [pendingLots, setPendingLots] = useState(trade.lots || 0.01);

  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef(null);

  const isFormOpen = activeAccordionId === trade.id;
  const formState = isFormOpen ? (activeFormType || localFormState) : null;

  useEffect(() => {
    if (!isFormOpen) {
      setLocalFormState(null);
    }
  }, [isFormOpen]);

  const toggleForm = (formType) => {
    if (isFormOpen && formState === formType) {
      setActiveAccordionId(null, null);
      setLocalFormState(null);
    } else {
      setActiveAccordionId(trade.id, formType);
      setLocalFormState(formType);
      // reset states
      setTp(trade.tp || '');
      setSl(trade.sl || '');
      setLotsToClose(trade.lots);
      setLimitPrice(trade.limitPrice || '');
      setPendingLots(trade.lots || 0.01);
    }
  };

  const symbolInfo = symbolsInfo ? symbolsInfo.find(s => s.id === trade.symbol) : null;

  // Modifying Open Trade
  const handleModify = () => {
    const newTp = tp ? parseFloat(tp) : null;
    const newSl = sl ? parseFloat(sl) : null;
    
    if (trade.direction === 'BUY') {
      if (newTp && newTp <= currentPrice) return;
      if (newSl && newSl >= currentPrice) return;
    } else {
      if (newTp && newTp >= currentPrice) return;
      if (newSl && newSl <= currentPrice) return;
    }

    onModify(trade.id, { tp: newTp, sl: newSl });
    setActiveAccordionId(null, null);
  };

  const handleBreakEven = () => {
    if (!trade.openPrice) return;
    onModify(trade.id, { sl: trade.openPrice });
  };

  const handlePartialClose = () => {
    const lots = parseFloat(lotsToClose);
    if (lots > 0 && lots <= trade.lots) {
      onPartialClose(trade.id, lots);
      setActiveAccordionId(null, null);
    }
  };

  const handleEditPending = () => {
    const newLimit = parseFloat(limitPrice);
    if (!newLimit) return;

    if (trade.direction === 'BUY' && newLimit >= currentPrice) return;
    if (trade.direction === 'SELL' && newLimit <= currentPrice) return;

    const newMargin = symbolInfo && account ? calculateMargin(newLimit, parseFloat(pendingLots), symbolInfo.contractSize, account.leverage) : trade.margin;

    onModify(trade.id, {
      limitPrice: newLimit,
      lots: parseFloat(pendingLots),
      tp: tp ? parseFloat(tp) : null,
      sl: sl ? parseFloat(sl) : null,
      margin: newMargin
    });
    setActiveAccordionId(null, null);
  };


  const floatingPnL = (isOpen && trade.symbol === currentSymbol && symbolInfo)
    ? calculatePnL(trade.openPrice, currentPrice, trade.direction, trade.lots, symbolInfo)
    : (trade.floatingPnL || 0);

  const pnlClass = floatingPnL >= 0 ? 'profit' : 'loss';
  const closedPnlClass = trade.pnl >= 0 ? 'profit' : 'loss';

  const isModifyInvalid = () => {
    const newTp = tp ? parseFloat(tp) : null;
    const newSl = sl ? parseFloat(sl) : null;
    if (trade.direction === 'BUY') {
      if (newTp && newTp <= currentPrice) return true;
      if (newSl && newSl >= currentPrice) return true;
    } else {
      if (newTp && newTp >= currentPrice) return true;
      if (newSl && newSl <= currentPrice) return true;
    }
    return false;
  };

  const isPendingEditInvalid = () => {
    const newLimit = parseFloat(limitPrice);
    if (!newLimit) return true;
    if (trade.direction === 'BUY' && newLimit >= currentPrice) return true;
    if (trade.direction === 'SELL' && newLimit <= currentPrice) return true;
    return false;
  };

  const partialPnL = symbolInfo && lotsToClose > 0 
    ? calculatePnL(trade.openPrice, currentPrice, trade.direction, parseFloat(lotsToClose), symbolInfo)
    : 0;

  return (
    <>
      <tr 
        className={isOpen ? `row-${pnlClass}` : ''}
        onMouseEnter={(e) => {
          if (!isFormOpen && isOpen) setShowTooltip(true);
        }}
        onMouseLeave={() => setShowTooltip(false)}
        style={{ position: 'relative' }}
      >
        <td className="col-symbol">
          <span className="mobile-label">Symbol</span>
          <span className="value">{trade.symbol}</span>
        </td>
        <td className={`col-dir ${trade.direction === 'BUY' ? 'profit' : 'loss'}`}>
          <span className="mobile-label">Dir</span>
          <span className={`badge ${trade.direction === 'BUY' ? 'profit' : 'loss'}`}>{trade.direction}</span>
        </td>
        <td className="col-lots">
          <span className="mobile-label">Lots</span>
          <span className="value">{trade.lots.toFixed(2)}</span>
        </td>
        
        {isPending && (
          <>
            <td className="col-open-price">
              <span className="mobile-label">Limit</span>
              <span className="value">{trade.limitPrice}</span>
            </td>
            <td className="col-current-price">
              <span className="mobile-label">Curr</span>
              <span className="value">{currentPrice}</span>
            </td>
            <td className="col-tp">
              <span className="mobile-label">TP</span>
              <span className="value">{trade.tp || '-'}</span>
            </td>
            <td className="col-sl">
              <span className="mobile-label">SL</span>
              <span className="value">{trade.sl || '-'}</span>
            </td>
            <td className="col-actions actions-cell">
              <button onClick={() => toggleForm('editPending')} className="btn-action">Edit</button>
              <button onClick={() => toggleForm('cancelPending')} className="btn-action danger">&times; Cancel</button>
            </td>
          </>
        )}

        {isOpen && (
          <>
            <td className="col-open-price">
              <span className="mobile-label">Open</span>
              <span className="value" title={trade.openPrice}>{trade.openPrice}</span>
            </td>
            <td className="col-current-price">
              <span className="mobile-label">Curr</span>
              <span className="value">{currentPrice}</span>
            </td>
            <td className="col-tp">
              <span className="mobile-label">TP</span>
              <span className="value">{trade.tp || '-'}</span>
            </td>
            <td className="col-sl">
              <span className="mobile-label">SL</span>
              <span className="value">{trade.sl || '-'}</span>
            </td>
            <td className={`col-pnl ${pnlClass}`}>
              <span className="mobile-label">P&L</span>
              <span className="value">${floatingPnL.toFixed(2)}</span>
            </td>
            <td className="col-actions actions-cell">
              <button onClick={() => toggleForm('modify')} className="btn-action">Modify</button>
              <button onClick={handleBreakEven} className="btn-action" disabled={trade.sl === trade.openPrice}>B/E</button>
              <button onClick={() => toggleForm('partial')} className="btn-action">Partial</button>
              <button onClick={() => toggleForm('close')} className="btn-action danger">&times; Close</button>

              {showTooltip && (
                <div className="trade-tooltip" ref={tooltipRef}>
                  <div className="tooltip-header">
                    <span className={`badge ${trade.direction === 'BUY' ? 'profit' : 'loss'}`}>{trade.direction}</span>
                    <span>{trade.symbol}</span>
                  </div>
                  <div className="tooltip-body">
                    <p>Open: {trade.openPrice} | Curr: {currentPrice}</p>
                    <p>Lots: {trade.lots} | Margin: ${trade.margin?.toFixed(2)}</p>
                    <p className={pnlClass}>P&L: ${floatingPnL.toFixed(2)}</p>
                    {trade.tp && <p className="profit">TP: {trade.tp}</p>}
                    {trade.sl && <p className="loss">SL: {trade.sl}</p>}
                    <p>Duration: {trade.duration || 0} bars</p>
                  </div>
                </div>
              )}
            </td>
          </>
        )}

        {isClosed && (
          <>
            <td className="col-open-price">
              <span className="mobile-label">Open</span>
              <span className="value">{trade.openPrice}</span>
            </td>
            <td className="col-current-price">
              <span className="mobile-label">Close</span>
              <span className="value">{trade.closePrice}</span>
            </td>
            <td className="col-tp">
              <span className="mobile-label">TP</span>
              <span className="value">{trade.tp || '-'}</span>
            </td>
            <td className="col-sl">
              <span className="mobile-label">SL</span>
              <span className="value">{trade.sl || '-'}</span>
            </td>
            <td className={`col-pnl ${closedPnlClass}`}>
              <span className="mobile-label">P&L</span>
              <span className="value">${trade.pnl?.toFixed(2)}</span>
            </td>
            <td className="col-actions">
              <span className="mobile-label">Result</span>
              <span className={`badge ${closedPnlClass}`}>
                {trade.isPartial ? 'PARTIAL' : (trade.pnl >= 0 ? 'WIN' : 'LOSS')}
              </span>
            </td>
          </>
        )}
      </tr>

      {/* Accordion Forms */}
      {isFormOpen && formState === 'modify' && isOpen && (
        <tr className="accordion-row">
          <td colSpan="9">
            <div className="inline-form">
              <h4>Modify {trade.symbol} {trade.direction}</h4>
              <div className="form-row">
                <label>TP Price: <input type="number" value={tp} onChange={e => setTp(e.target.value)} step="any" /></label>
                <label>SL Price: <input type="number" value={sl} onChange={e => setSl(e.target.value)} step="any" /></label>
              </div>
              {isModifyInvalid() && <div className="error-text">Invalid TP/SL for current price.</div>}
              <div className="form-actions">
                <button onClick={handleModify} disabled={isModifyInvalid()} className="btn-action primary">Update</button>
                <button onClick={() => toggleForm(null)} className="btn-action">Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {isFormOpen && formState === 'partial' && isOpen && (
        <tr className="accordion-row">
          <td colSpan="9">
            <div className="inline-form">
              <h4>Partial Close (Max {trade.lots})</h4>
              <div className="form-row">
                <label>Lots: <input type="number" value={lotsToClose} onChange={e => setLotsToClose(e.target.value)} step="0.01" min="0.01" max={trade.lots} /></label>
                <span>P&L on close: <b className={partialPnL >= 0 ? 'profit' : 'loss'}>${partialPnL.toFixed(2)}</b></span>
              </div>
              <div className="form-actions">
                <button onClick={handlePartialClose} className="btn-action primary" disabled={lotsToClose <= 0 || lotsToClose > trade.lots}>Close {lotsToClose} lots</button>
                <button onClick={() => toggleForm(null)} className="btn-action">Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {isFormOpen && formState === 'close' && isOpen && (
        <tr className="accordion-row">
          <td colSpan="9">
            <div className="inline-form confirm-form">
              <span>Close {trade.symbol} {trade.direction} {trade.lots} lots at {currentPrice} for <b className={pnlClass}>${floatingPnL.toFixed(2)}</b> — Confirm?</span>
              <div className="form-actions">
                <button onClick={onClose} className="btn-action primary">Confirm</button>
                <button onClick={() => toggleForm(null)} className="btn-action">Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {isFormOpen && formState === 'editPending' && isPending && (
        <tr className="accordion-row">
          <td colSpan="9">
            <div className="inline-form">
              <h4>Edit {trade.symbol} {trade.direction} Limit</h4>
              <div className="form-row">
                <label>Limit: <input type="number" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} step="any" /></label>
                <label>Lots: <input type="number" value={pendingLots} onChange={e => setPendingLots(e.target.value)} step="0.01" min="0.01" /></label>
                <label>TP: <input type="number" value={tp} onChange={e => setTp(e.target.value)} step="any" /></label>
                <label>SL: <input type="number" value={sl} onChange={e => setSl(e.target.value)} step="any" /></label>
              </div>
              {isPendingEditInvalid() && <div className="error-text">Limit price invalid for direction.</div>}
              <div className="form-actions">
                <button onClick={handleEditPending} disabled={isPendingEditInvalid()} className="btn-action primary">Update</button>
                <button onClick={() => toggleForm(null)} className="btn-action">Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {isFormOpen && formState === 'cancelPending' && isPending && (
        <tr className="accordion-row">
          <td colSpan="9">
            <div className="inline-form confirm-form">
              <span>Cancel pending {trade.direction} limit at {trade.limitPrice}?</span>
              <div className="form-actions">
                <button onClick={onCancel} className="btn-action danger">Confirm</button>
                <button onClick={() => toggleForm(null)} className="btn-action">Keep</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
