import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export default function TradeDistribution({ trades }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const labels = trades.map((_, i) => i + 1);
    const data = trades.map(t => t.pnl);
    const bgColors = trades.map(t => t.pnl >= 0 ? '#26a69a' : '#ef5350');

    chartInstance.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'P&L',
          data,
          backgroundColor: bgColors,
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
  }, [trades]);

  return (
    <div className="chart-container" style={{ position: 'relative', height: '200px', width: '100%', flex: 1 }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
}
