import { useEffect, useRef } from 'react';
import { calculatePnL } from '../utils/tradeCalculations';

export default function useReplayTrading(session, symbolsInfo, replayIndex, currentCandle, closeTrade, addToast, currentSymbol) {
  const { openTrades, pendingOrders, setOpenTrades, setPendingOrders } = session;
  const prevIndexRef = useRef(replayIndex);

  useEffect(() => {
    if (!currentCandle || replayIndex === prevIndexRef.current) return;
    prevIndexRef.current = replayIndex;

    const price = currentCandle.close;
    const high = currentCandle.high;
    const low = currentCandle.low;

    // 1. Process Pending Orders (only for current symbol)
    let triggeredOrders = [];
    let remainingOrders = [];
    let ordersChanged = false;

    pendingOrders.forEach(order => {
      if (order.symbol !== currentSymbol) {
        remainingOrders.push(order);
        return;
      }

      let activated = false;
      let activationPrice = order.limitPrice;

      if (order.direction === 'BUY' && low <= order.limitPrice) {
        activated = true;
      } else if (order.direction === 'SELL' && high >= order.limitPrice) {
        activated = true;
      }

      if (activated) {
        ordersChanged = true;
        triggeredOrders.push({
          ...order,
          pending: false,
          openPrice: activationPrice,
          openBarIndex: replayIndex,
          floatingPnL: 0
        });
        if (addToast) addToast(`LIMIT triggered: ${order.symbol} ${order.direction} at ${activationPrice}`, 'success');
      } else {
        remainingOrders.push(order);
      }
    });

    if (ordersChanged) {
      setPendingOrders(remainingOrders);
      if (triggeredOrders.length > 0) {
        setOpenTrades(prev => [...prev, ...triggeredOrders]);
      }
    }

    // 2. Process Open Trades for SL/TP (only for current symbol)
    const tradesToClose = [];
    
    openTrades.forEach(trade => {
      if (trade.symbol !== currentSymbol) return;
      
      let hitSL = false;
      let hitTP = false;
      let closePrice = null;

      if (trade.direction === 'BUY') {
        if (trade.sl !== null && low <= trade.sl) { hitSL = true; closePrice = trade.sl; }
        if (trade.tp !== null && high >= trade.tp) { hitTP = true; closePrice = trade.tp; }
      } else {
        if (trade.sl !== null && high >= trade.sl) { hitSL = true; closePrice = trade.sl; }
        if (trade.tp !== null && low <= trade.tp) { hitTP = true; closePrice = trade.tp; }
      }

      if (hitSL || hitTP) {
        if (hitSL) closePrice = trade.sl;
        else closePrice = trade.tp;
        tradesToClose.push({ id: trade.id, closePrice });
      }
    });

    // Execute closes safely outside the loop
    tradesToClose.forEach(({ id, closePrice }) => {
      closeTrade(id, closePrice, replayIndex);
    });

  }, [replayIndex, currentCandle, pendingOrders, openTrades, symbolsInfo, currentSymbol, closeTrade, addToast, setOpenTrades, setPendingOrders]); 
}
