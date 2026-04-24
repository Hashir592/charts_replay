import React, { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries, BarSeries } from 'lightweight-charts';
import DrawingOverlay from './DrawingOverlay';

export default function Chart({ 
  data, indicatorsData, config, chartType, crosshairEnabled,
  drawings, setDrawings, activeTool, setActiveTool, selectedDrawingId, setSelectedDrawingId
}) {
  const chartContainerRef = useRef(null);
  const rsiContainerRef = useRef(null);
  
  const mainChartRef = useRef(null);
  const rsiChartRef = useRef(null);
  
  const seriesRefs = useRef({
    candle: null,
    bar: null,
    line: null,
    volume: null,
    sma1: null,
    sma2: null,
    rsi: null,
  });
  
  const firstCandleTimeRef = useRef(null);

  const [legend, setLegend] = useState({ open: 0, high: 0, low: 0, close: 0, vol: 0 });

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // --- Main Chart ---
    const mainChart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#131722' },
        textColor: '#D1D4DC',
      },
      grid: {
        vertLines: { color: '#2B2B43' },
        horzLines: { color: '#2B2B43' },
      },
      crosshair: {
        mode: crosshairEnabled ? CrosshairMode.Normal : CrosshairMode.Hidden,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightBarStaysOnScroll: true,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
      },
    });
    mainChartRef.current = mainChart;

    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      visible: chartType === 'candles'
    });
    seriesRefs.current.candle = candleSeries;
    
    const barSeries = mainChart.addSeries(BarSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      visible: chartType === 'bars'
    });
    seriesRefs.current.bar = barSeries;
    
    const lineSeries = mainChart.addSeries(LineSeries, {
      color: '#2962FF',
      lineWidth: 2,
      visible: chartType === 'line'
    });
    seriesRefs.current.line = lineSeries;

    const volumeSeries = mainChart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    // Position volume at the bottom 20% of the main chart
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    seriesRefs.current.volume = volumeSeries;

    // --- Syncing Charts (Moved to RSI initialization) ---

    // --- Legend Update ---
    mainChart.subscribeCrosshairMove((param) => {
      if (param.time && param.seriesData.size > 0) {
        const candleData = param.seriesData.get(candleSeries);
        const volumeData = param.seriesData.get(volumeSeries);
        if (candleData) {
          setLegend({
            open: candleData.open,
            high: candleData.high,
            low: candleData.low,
            close: candleData.close,
            vol: volumeData ? volumeData.value : 0,
          });
        }
      }
    });

    // --- Resize handling ---
    const handleResize = () => {
      if (chartContainerRef.current && mainChartRef.current) {
        mainChartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
      if (rsiContainerRef.current && rsiChartRef.current) {
        rsiChartRef.current.applyOptions({ width: rsiContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mainChartRef.current) {
        mainChartRef.current.remove();
        mainChartRef.current = null;
      }
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
      }
    };
  }, []);

  // --- Data Updates ---
  useEffect(() => {
    if (!mainChartRef.current || !data.candles || data.candles.length === 0) return;

    // Remove duplicates and sort by time (lightweight-charts requires strict ordering)
    const uniqueCandlesMap = new Map();
    data.candles.forEach(c => uniqueCandlesMap.set(c.time, c));
    const candles = Array.from(uniqueCandlesMap.values()).sort((a, b) => a.time - b.time);
    
    seriesRefs.current.candle.setData(candles);
    seriesRefs.current.bar.setData(candles);
    const lineData = candles.map(c => ({ time: c.time, value: c.close }));
    seriesRefs.current.line.setData(lineData);

    const volData = candles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
    }));
    seriesRefs.current.volume.setData(volData);
    
    // Only fit content if the dataset completely changed (different symbol/timeframe)
    const firstCandleTime = candles[0]?.time;
    if (firstCandleTime !== firstCandleTimeRef.current) {
      // Policy A: always go to latest candle and autoscale price
      mainChartRef.current.timeScale().scrollToRealTime();
      if (rsiChartRef.current) rsiChartRef.current.timeScale().scrollToRealTime();
      
      // Force autoscale on the main price scale
      mainChartRef.current.priceScale('right').applyOptions({ autoScale: true });
      
      firstCandleTimeRef.current = firstCandleTime;
    }

    // Reset legend to latest candle
    const last = candles[candles.length - 1];
    if (last) {
      setLegend({
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
        vol: last.volume,
      });
    }

  }, [data]);

  // --- Crosshair & Chart Type Updates ---
  useEffect(() => {
    if (mainChartRef.current) {
      mainChartRef.current.applyOptions({
        crosshair: { mode: crosshairEnabled ? CrosshairMode.Normal : CrosshairMode.Hidden }
      });
      if (seriesRefs.current.candle) seriesRefs.current.candle.applyOptions({ visible: chartType === 'candles' });
      if (seriesRefs.current.bar) seriesRefs.current.bar.applyOptions({ visible: chartType === 'bars' });
      if (seriesRefs.current.line) seriesRefs.current.line.applyOptions({ visible: chartType === 'line' });
    }
  }, [chartType, crosshairEnabled]);

  // --- Indicators Overlay Updates ---
  useEffect(() => {
    if (!mainChartRef.current) return;

    // SMA 1
    if (config.sma1 && indicatorsData.sma1) {
      if (!seriesRefs.current.sma1) {
        seriesRefs.current.sma1 = mainChartRef.current.addSeries(LineSeries, {
          color: '#ffcc00',
          lineWidth: 2,
        });
      }
      const uniqueSma1Map = new Map();
      indicatorsData.sma1.forEach(d => {
        if (d.value !== null && !isNaN(d.value)) uniqueSma1Map.set(d.time, d);
      });
      seriesRefs.current.sma1.setData(Array.from(uniqueSma1Map.values()).sort((a, b) => a.time - b.time));
    } else {
      if (seriesRefs.current.sma1) {
        mainChartRef.current.removeSeries(seriesRefs.current.sma1);
        seriesRefs.current.sma1 = null;
      }
    }

    // SMA 2
    if (config.sma2 && indicatorsData.sma2) {
      if (!seriesRefs.current.sma2) {
        seriesRefs.current.sma2 = mainChartRef.current.addSeries(LineSeries, {
          color: '#00bcd4',
          lineWidth: 2,
        });
      }
      const uniqueSma2Map = new Map();
      indicatorsData.sma2.forEach(d => {
        if (d.value !== null && !isNaN(d.value)) uniqueSma2Map.set(d.time, d);
      });
      seriesRefs.current.sma2.setData(Array.from(uniqueSma2Map.values()).sort((a, b) => a.time - b.time));
    } else {
      if (seriesRefs.current.sma2) {
        mainChartRef.current.removeSeries(seriesRefs.current.sma2);
        seriesRefs.current.sma2 = null;
      }
    }

    // RSI
    if (config.rsi && indicatorsData.rsi) {
      rsiContainerRef.current.style.display = 'block';
      
      if (!rsiChartRef.current) {
        rsiChartRef.current = createChart(rsiContainerRef.current, {
          layout: { background: { color: '#131722' }, textColor: '#D1D4DC' },
          grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
          },
          handleScale: {
            mouseWheel: true,
            pinch: true,
          },
          timeScale: { 
            timeVisible: true,
            rightBarStaysOnScroll: true,
            fixRightEdge: false,
          },
        });
        
        seriesRefs.current.rsi = rsiChartRef.current.addSeries(LineSeries, { color: '#00bcd4', lineWidth: 2 });
        seriesRefs.current.rsi.createPriceLine({ price: 70, color: '#ef5350', lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
        seriesRefs.current.rsi.createPriceLine({ price: 30, color: '#26a69a', lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
        
        let isSyncing = false;
        mainChartRef.current.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (isSyncing || !range || !rsiChartRef.current) return;
          isSyncing = true;
          rsiChartRef.current.timeScale().setVisibleLogicalRange(range);
          isSyncing = false;
        });
        rsiChartRef.current.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (isSyncing || !range || !mainChartRef.current) return;
          isSyncing = true;
          mainChartRef.current.timeScale().setVisibleLogicalRange(range);
          isSyncing = false;
        });
        
        rsiChartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }

      // Deduplicate and sort
      const uniqueRsiMap = new Map();
      indicatorsData.rsi.forEach(d => {
        if (d.value !== null && !isNaN(d.value)) uniqueRsiMap.set(d.time, d);
      });
      const validRsi = Array.from(uniqueRsiMap.values()).sort((a, b) => a.time - b.time);
      
      seriesRefs.current.rsi.setData(validRsi);
      // We don't fitContent here either, because RSI is synced with the main chart's timeScale.
    } else {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
        seriesRefs.current.rsi = null;
      }
      rsiContainerRef.current.style.display = 'none';
    }

  }, [config, indicatorsData]);

  return (
    <div className="chart-wrapper">
      <div className="legend">
        <span>O: {legend.open}</span>
        <span>H: {legend.high}</span>
        <span>L: {legend.low}</span>
        <span>C: {legend.close}</span>
        <span>V: {legend.vol}</span>
      </div>
      <div ref={chartContainerRef} className="main-chart">
        <DrawingOverlay 
          mainChart={mainChartRef.current}
          candleSeries={seriesRefs.current.candle}
          drawings={drawings}
          setDrawings={setDrawings}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          selectedDrawingId={selectedDrawingId}
          setSelectedDrawingId={setSelectedDrawingId}
          data={data}
        />
      </div>
      <div ref={rsiContainerRef} className="rsi-chart" style={{ display: 'none' }} />
    </div>
  );
}
