import { calculateMargin, calculatePnL } from '../utils/tradeCalculations';

let sharedAudioCtx = null;

const playSound = (isProfit) => {
  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Browser might suspend audio context if not interacted with
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }

    const oscillator = sharedAudioCtx.createOscillator();
    const gainNode = sharedAudioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(sharedAudioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = isProfit ? 800 : 300;
    gainNode.gain.setValueAtTime(0.1, sharedAudioCtx.currentTime);
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.00001, sharedAudioCtx.currentTime + 0.5);
    oscillator.stop(sharedAudioCtx.currentTime + 0.5);
  } catch (e) {
    console.warn('Audio play failed:', e);
  }
};

export default function useTradingEngine(session, symbolsInfo, addToast) {
  const { 
    account, setAccount, 
    trades, setTrades, 
    openTrades, setOpenTrades, 
    pendingOrders, setPendingOrders 
  } = session;

  const placeTrade = (tradeDef) => {
    const symbolInfo = symbolsInfo.find(s => s.id === tradeDef.symbol);
    if (!symbolInfo) {
      if (addToast) addToast(`Symbol info not found for ${tradeDef.symbol}`, 'error');
      return false;
    }

    const reqPrice = tradeDef.type === 'LIMIT' ? tradeDef.limitPrice : tradeDef.currentPrice;
    if (!reqPrice) {
      if (addToast) addToast(`Invalid price for trade entry.`, 'error');
      return false;
    }

    const marginRequired = calculateMargin(
      reqPrice, 
      tradeDef.lots, 
      symbolInfo.contractSize, 
      account.leverage
    );

    const floatingPnL = openTrades.reduce((sum, t) => {
      if (t.symbol === tradeDef.symbol) {
        return sum + calculatePnL(t.openPrice, tradeDef.currentPrice, t.direction, t.lots, symbolInfo);
      }
      return sum + (t.floatingPnL || 0);
    }, 0);
    const equity = account.currentBalance + floatingPnL;
    const usedMargin = openTrades.reduce((sum, t) => sum + t.margin, 0) + pendingOrders.reduce((sum, t) => sum + t.margin, 0);
    const freeMargin = equity - usedMargin;

    if (marginRequired > freeMargin) {
      if (addToast) addToast(`Insufficient margin. Free margin: $${freeMargin.toFixed(2)}, required: $${marginRequired.toFixed(2)}`, 'error');
      return false;
    }

    const tradeObj = {
      id: Date.now().toString(),
      symbol: tradeDef.symbol,
      direction: tradeDef.direction,
      lots: tradeDef.lots,
      tp: tradeDef.tp || null,
      sl: tradeDef.sl || null,
      margin: marginRequired,
      openBarIndex: tradeDef.type === 'MARKET' ? tradeDef.currentBarIndex : null,
      openPrice: tradeDef.type === 'MARKET' ? tradeDef.currentPrice : null
    };

    if (tradeDef.type === 'LIMIT') {
      tradeObj.limitPrice = tradeDef.limitPrice;
      tradeObj.pending = true;
      setPendingOrders(prev => [...prev, tradeObj]);
      if (addToast) addToast(`${tradeDef.symbol} ${tradeDef.direction} LIMIT placed at ${tradeDef.limitPrice}`, 'info');
    } else {
      setOpenTrades(prev => [...prev, tradeObj]);
      if (addToast) addToast(`${tradeDef.symbol} ${tradeDef.direction} MARKET opened at ${tradeDef.currentPrice}`, 'success');
    }

    return true;
  };

  const closeTrade = (tradeId, closePrice, closeBarIndex) => {
    const trade = openTrades.find(t => t.id === tradeId);
    if (!trade) return;

    const symbolInfo = symbolsInfo.find(s => s.id === trade.symbol);
    const pnl = calculatePnL(trade.openPrice, closePrice, trade.direction, trade.lots, symbolInfo);
    
    let rrAchieved = null;
    if (trade.sl) {
      const riskPerLot = Math.abs(trade.openPrice - trade.sl);
      const profitPerLot = (closePrice - trade.openPrice) * (trade.direction === 'BUY' ? 1 : -1);
      if (riskPerLot > 0) {
        rrAchieved = profitPerLot / riskPerLot;
      }
    }

    const closedTrade = {
      ...trade,
      closePrice,
      closeBarIndex,
      pnl,
      pnlPercent: (pnl / trade.margin) * 100,
      rrAchieved,
      duration: closeBarIndex - trade.openBarIndex
    };

    setOpenTrades(prev => prev.filter(t => t.id !== tradeId));
    setTrades(prev => [...prev, closedTrade]);
    
    setAccount(prev => ({
      ...prev,
      currentBalance: prev.currentBalance + pnl
    }));

    if (addToast) {
      const type = pnl >= 0 ? 'success' : 'error';
      const sign = pnl >= 0 ? '+' : '';
      addToast(`${trade.symbol} ${trade.direction} closed at ${closePrice} (${sign}$${pnl.toFixed(2)})`, type);
      
      // Play sound if possible
      playSound(pnl >= 0);
    }
  };

  const cancelPendingOrder = (orderId) => {
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    if (addToast) addToast(`Pending order cancelled`, 'info');
  };

  const modifyTrade = (tradeId, modifications) => {
    setOpenTrades(prev => prev.map(t => t.id === tradeId ? { ...t, ...modifications } : t));
    setPendingOrders(prev => prev.map(t => t.id === tradeId ? { ...t, ...modifications } : t));
  };

  const partialCloseTrade = (tradeId, lotsToClose, closePrice, closeBarIndex) => {
    const trade = openTrades.find(t => t.id === tradeId);
    if (!trade) return;

    if (lotsToClose >= trade.lots) {
      closeTrade(tradeId, closePrice, closeBarIndex);
      return;
    }

    const symbolInfo = symbolsInfo.find(s => s.id === trade.symbol);
    const pnl = calculatePnL(trade.openPrice, closePrice, trade.direction, lotsToClose, symbolInfo);
    
    const remainingLots = trade.lots - lotsToClose;
    const newMargin = calculateMargin(trade.openPrice, remainingLots, symbolInfo.contractSize, account.leverage);

    setOpenTrades(prev => prev.map(t => {
      if (t.id === tradeId) {
        return {
          ...t,
          lots: remainingLots,
          margin: newMargin
        };
      }
      return t;
    }));

    const closedPortion = {
      ...trade,
      id: Date.now().toString() + "-partial",
      lots: lotsToClose,
      closePrice,
      closeBarIndex,
      pnl,
      pnlPercent: trade.margin > 0 ? (pnl / trade.margin) * 100 : 0,
      duration: closeBarIndex - trade.openBarIndex,
      isPartial: true
    };

    setTrades(prev => [...prev, closedPortion]);
    
    setAccount(prev => ({
      ...prev,
      currentBalance: prev.currentBalance + pnl
    }));

    if (addToast) {
      const type = pnl >= 0 ? 'success' : 'error';
      const sign = pnl >= 0 ? '+' : '';
      addToast(`Partial close — ${lotsToClose} lots ${trade.symbol} ${trade.direction} closed at ${closePrice} (${sign}$${pnl.toFixed(2)})`, type);
    }
  };

  return { placeTrade, closeTrade, cancelPendingOrder, modifyTrade, partialCloseTrade };
}
