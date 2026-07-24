import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export default function EquityCurve({ trades, startingBalance }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    let currentEquity = startingBalance;
    const labels = [0];
    const data = [startingBalance];

    trades.forEach((t, i) => {
      currentEquity += t.pnl;
      labels.push(i + 1);
      data.push(currentEquity);
    });

    const isProfit = currentEquity >= startingBalance;

    chartInstance.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Equity',
          data,
          borderColor: isProfit ? '#26a69a' : '#ef5350',
          backgroundColor: isProfit ? 'rgba(38, 166, 154, 0.1)' : 'rgba(239, 83, 80, 0.1)',
          fill: true,
          tension: 0.1,
          pointRadius: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { display: false },
          y: { 
            grid: { color: '#2B2B43' }
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, [trades, startingBalance]);

  return (
    <div className="chart-container" style={{ position: 'relative', height: '200px', width: '100%', flex: 1 }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
}
