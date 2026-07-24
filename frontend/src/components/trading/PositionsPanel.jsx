import React, { useState } from 'react';
import { Inbox } from 'lucide-react';
import TradeRow from './TradeRow';
import EquityCurve from './EquityCurve';
import TradeDistribution from './TradeDistribution';
import { calculateStats } from '../../utils/tradeCalculations';

export default function PositionsPanel({ session, closeTrade, cancelOrder, currentPrice, currentSymbol, currentBarIndex, symbolsInfo, modifyTrade, partialCloseTrade, activeAccordionId, setActiveAccordionId, activeFormType }) {
  const [activeTab, setActiveTab] = useState('open');
  const [showCloseAllConfirm, setShowCloseAllConfirm] = useState(false);

  const { openTrades, pendingOrders, trades, account } = session;

  const getPnL = (t) => {
    if (t.symbol === currentSymbol) {
      const sInfo = symbolsInfo.find(s => s.id === t.symbol);
      if (sInfo) return (t.direction === 'BUY' ? 1 : -1) * (currentPrice - t.openPrice) * t.lots * sInfo.contractSize;
    }
    return t.floatingPnL || 0;
  };

  const totalFloatingPnL = openTrades.reduce((sum, t) => sum + getPnL(t), 0);

  const handleCloseAll = () => {
    openTrades.forEach(t => {
      closeTrade(t.id, currentPrice, currentBarIndex);
    });
    setShowCloseAllConfirm(false);
  };

  return (
    <div className="positions-panel">
      <div className="positions-tabs">
        <button
          className={`tab ${activeTab === 'open' ? 'active' : ''}`}
          onClick={() => setActiveTab('open')}
        >
          Positions <span className="tab-count">{openTrades.length}</span>
        </button>
        <button
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Orders <span className="tab-count">{pendingOrders.length}</span>
        </button>
        <button
          className={`tab ${activeTab === 'journal' ? 'active' : ''}`}
          onClick={() => setActiveTab('journal')}
        >
          History <span className="tab-count">{trades.length}</span>
        </button>
        <button
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Performance
        </button>

        <div style={{ flex: 1 }} />

        {activeTab === 'open' && openTrades.length > 0 && (
          <>
            <span
              className={`tab-count ${totalFloatingPnL >= 0 ? 'profit' : 'loss'}`}
              style={{ fontWeight: 600, marginRight: 10, fontVariantNumeric: 'tabular-nums' }}
            >
              {totalFloatingPnL >= 0 ? '+' : '−'}${Math.abs(totalFloatingPnL).toFixed(2)}
            </span>
            <button
              className="btn-action danger"
              style={{ flexShrink: 0 }}
              onClick={() => setShowCloseAllConfirm(true)}
            >
              Close all
            </button>
          </>
        )}
      </div>

      <div className="positions-content">
        {activeTab === 'open' && openTrades.length === 0 && (
          <div className="empty-state">
            <Inbox size={26} />
            No open positions. Press <b>T</b> to place an order.
          </div>
        )}
        {activeTab === 'open' && openTrades.length > 0 && (
          <table className="trades-table">
            <thead>
              <tr>
                <th className="col-symbol">Symbol</th><th className="col-dir">Dir</th><th className="col-lots">Lots</th><th className="col-open-price">Open Price</th><th className="col-current-price">Current Price</th><th className="col-tp">TP</th><th className="col-sl">SL</th><th className="col-pnl">Floating P&L</th><th className="col-actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {openTrades.map(t => (
                <TradeRow 
                  key={t.id} 
                  trade={t} 
                  onClose={() => closeTrade(t.id, currentPrice, currentBarIndex)} 
                  onModify={modifyTrade}
                  onPartialClose={(tradeId, lots) => partialCloseTrade(tradeId, lots, currentPrice, currentBarIndex)}
                  isOpen 
                  currentPrice={currentPrice}
                  currentSymbol={currentSymbol}
                  symbolsInfo={symbolsInfo}
                  account={account}
                  activeAccordionId={activeAccordionId}
                  setActiveAccordionId={setActiveAccordionId}
                  activeFormType={activeFormType}
                />
              ))}
            </tbody>
          </table>
        )}
        {activeTab === 'pending' && pendingOrders.length === 0 && (
          <div className="empty-state">
            <Inbox size={26} />
            No working orders.
          </div>
        )}
        {activeTab === 'pending' && pendingOrders.length > 0 && (
          <table className="trades-table">
            <thead>
              <tr>
                <th className="col-symbol">Symbol</th><th className="col-dir">Dir</th><th className="col-lots">Lots</th><th className="col-open-price">Limit Price</th><th className="col-current-price">Current Price</th><th className="col-tp">TP</th><th className="col-sl">SL</th><th className="col-actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map(t => (
                <TradeRow 
                  key={t.id} 
                  trade={t} 
                  onCancel={() => cancelOrder(t.id)} 
                  onModify={modifyTrade}
                  isPending 
                  currentPrice={currentPrice}
                  currentSymbol={currentSymbol}
                  symbolsInfo={symbolsInfo}
                  account={account}
                  activeAccordionId={activeAccordionId}
                  setActiveAccordionId={setActiveAccordionId}
                />
              ))}
            </tbody>
          </table>
        )}
        {activeTab === 'journal' && trades.length === 0 && (
          <div className="empty-state">
            <Inbox size={26} />
            No closed trades yet.
          </div>
        )}
        {activeTab === 'journal' && trades.length > 0 && (
          <table className="trades-table">
            <thead>
              <tr>
                <th className="col-symbol">Symbol</th><th className="col-dir">Dir</th><th className="col-lots">Lots</th><th className="col-open-price">Open</th><th className="col-current-price">Close</th><th className="col-tp">TP</th><th className="col-sl">SL</th><th className="col-pnl">P&L</th><th className="col-actions">Result</th>
              </tr>
            </thead>
            <tbody>
              {trades.slice().reverse().map(t => <TradeRow key={t.id} trade={t} isClosed />)}
            </tbody>
          </table>
        )}
        {activeTab === 'stats' && account && (
          <div className="stats-dashboard">
            <div className="stats-grid">
              {(() => {
                const s = calculateStats(trades, account.startingBalance);
                return (
                  <>
                    <div className="stat-card"><h4>Net P&L</h4><p>${s.netPnL.toFixed(2)} ({s.netPnLPercent.toFixed(2)}%)</p></div>
                    <div className="stat-card"><h4>Win Rate</h4><p>{s.winRate.toFixed(1)}%</p></div>
                    <div className="stat-card"><h4>Total Trades</h4><p>{s.totalTrades}</p></div>
                    <div className="stat-card"><h4>Profit Factor</h4><p>{s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}</p></div>
                    <div className="stat-card"><h4>Max Drawdown</h4><p>${s.maxDrawdown.toFixed(2)}</p></div>
                    <div className="stat-card"><h4>Expectancy</h4><p>${s.expectancy.toFixed(2)}</p></div>
                  </>
                );
              })()}
            </div>
            <div className="charts-row">
              <EquityCurve trades={trades} startingBalance={account.startingBalance} />
              <TradeDistribution trades={trades} />
            </div>
          </div>
        )}
      </div>

      {showCloseAllConfirm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Close all positions</h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                Closing {openTrades.length} position{openTrades.length === 1 ? '' : 's'} realizes{' '}
                <b className={totalFloatingPnL >= 0 ? 'profit' : 'loss'}>
                  {totalFloatingPnL >= 0 ? '+' : '−'}${Math.abs(totalFloatingPnL).toFixed(2)}
                </b>
                .
              </p>
              <div
                className="summary-list"
                style={{
                  maxHeight: 150,
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  padding: 8,
                  fontSize: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {openTrades.map((t) => {
                  const pnl = getPnL(t);
                  return (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        {t.direction} {t.lots} {t.symbol}
                      </span>
                      <span className={pnl >= 0 ? 'profit' : 'loss'}>${pnl.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-action" onClick={() => setShowCloseAllConfirm(false)}>
                Cancel
              </button>
              <button className="btn-action danger" onClick={handleCloseAll}>
                Close all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
