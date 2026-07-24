export const calculateMargin = (price, lots, contractSize, leverage) => {
  return (price * lots * contractSize) / leverage;
};

export const calculatePnL = (entryPrice, currentPrice, direction, lots, symbolInfo) => {
  if (!symbolInfo) return 0;
  const multiplier = direction === 'BUY' ? 1 : -1;
  return (currentPrice - entryPrice) * multiplier * lots * symbolInfo.contractSize;
};

export const calculateStats = (closedTrades, startingBalance) => {
  let netPnL = 0;
  let wins = 0;
  let totalTrades = closedTrades.length;
  let grossProfit = 0;
  let grossLoss = 0;
  let maxDrawdown = 0;
  let peakEquity = startingBalance;
  let currentEquity = startingBalance;
  let bestTrade = 0;
  let worstTrade = 0;
  
  closedTrades.forEach(t => {
    netPnL += t.pnl;
    currentEquity += t.pnl;
    
    if (t.pnl > 0) {
      wins++;
      grossProfit += t.pnl;
      if (t.pnl > bestTrade) bestTrade = t.pnl;
    } else {
      grossLoss += Math.abs(t.pnl);
      if (t.pnl < worstTrade) worstTrade = t.pnl;
    }
    
    if (currentEquity > peakEquity) peakEquity = currentEquity;
    const drawdown = peakEquity - currentEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });
  
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? Infinity : 0);
  const avgWinner = wins > 0 ? grossProfit / wins : 0;
  const avgLoser = (totalTrades - wins) > 0 ? grossLoss / (totalTrades - wins) : 0;
  const expectancy = (winRate/100 * avgWinner) - ((1 - winRate/100) * avgLoser);
  
  let totalRR = 0;
  let rrCount = 0;
  closedTrades.forEach(t => {
    if (t.rrAchieved !== undefined && t.rrAchieved !== null) {
      totalRR += t.rrAchieved;
      rrCount++;
    }
  });
  const avgRR = rrCount > 0 ? totalRR / rrCount : 0;

  return {
    netPnL,
    netPnLPercent: (netPnL / startingBalance) * 100,
    winRate,
    totalTrades,
    profitFactor,
    maxDrawdown,
    maxDrawdownPercent: (maxDrawdown / startingBalance) * 100,
    avgRR,
    bestTrade,
    worstTrade,
    avgWinner,
    avgLoser,
    expectancy,
    equityCurve: closedTrades.map(t => {
      // Need a running total for the chart
      return t.pnl; 
    })
  };
};
