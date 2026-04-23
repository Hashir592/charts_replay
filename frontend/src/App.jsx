import React, { useState, useEffect, useCallback } from 'react';
import TopBar from './components/TopBar';
import IndicatorPanel from './components/IndicatorPanel';
import Chart from './components/Chart';
import ReplayControls from './components/ReplayControls';
import DrawingToolbar from './components/DrawingToolbar';
import useReplay from './hooks/useReplay';
import { fetchCandles, fetchVolume, fetchRSI, fetchSMA } from './api';

export default function App() {
  const [symbol, setSymbol] = useState('BTCUSD');
  const [timeframe, setTimeframe] = useState('1d');
  const [chartType, setChartType] = useState('candles');
  const [crosshairEnabled, setCrosshairEnabled] = useState(true);
  
  const [activeTool, setActiveTool] = useState('cursor');
  const [allDrawings, setAllDrawings] = useState({}); // { 'BTCUSD_1d': [] }
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [data, setData] = useState({ candles: [], volume: [] });
  const [indicatorsData, setIndicatorsData] = useState({ rsi: null, sma1: null, sma2: null });
  
  const [indicatorsConfig, setIndicatorsConfig] = useState({
    rsi: true,
    sma1: false,
    sma1Period: 20,
    sma2: false,
    sma2Period: 50,
  });

  const replay = useReplay(data.candles.length);
  const drawingKey = `${symbol}_${timeframe}`;
  const drawings = allDrawings[drawingKey] || [];
  
  const setDrawings = (newDrawings) => {
    setAllDrawings(prev => ({ ...prev, [drawingKey]: typeof newDrawings === 'function' ? newDrawings(prev[drawingKey] || []) : newDrawings }));
  };

  const clearDrawings = () => {
    if (window.confirm("Are you sure you want to clear all drawings on this chart?")) {
      setDrawings([]);
    }
  };

  const handleSmaUpdate = useCallback(() => {
    setIndicatorsConfig(prev => ({ ...prev })); // trigger effect
  }, []);

  // Derived data for chart (slices data if in replay mode)
  const displayData = replay.isReplayMode 
    ? {
        candles: data.candles.slice(0, replay.replayIndex + 1),
        volume: data.volume.slice(0, replay.replayIndex + 1),
      }
    : data;
    
  const displayIndicators = replay.isReplayMode
    ? {
        rsi: indicatorsData.rsi ? indicatorsData.rsi.slice(0, replay.replayIndex + 1) : null,
        sma1: indicatorsData.sma1 ? indicatorsData.sma1.slice(0, replay.replayIndex + 1) : null,
        sma2: indicatorsData.sma2 ? indicatorsData.sma2.slice(0, replay.replayIndex + 1) : null,
      }
    : indicatorsData;

  // Document title
  useEffect(() => {
    document.title = `ChartReplay — ${symbol}`;
  }, [symbol]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.key === ' ') {
        e.preventDefault();
        if (replay.isReplayMode) replay.togglePlay();
      } else if (e.key === 'ArrowRight') {
        if (replay.isReplayMode && !replay.isPlaying) replay.stepForward();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [replay]);

  // Fetch base chart data
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [candles, volume] = await Promise.all([
          fetchCandles(symbol, timeframe),
          fetchVolume(symbol, timeframe),
        ]);
        if (active) setData({ candles, volume });
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [symbol, timeframe]);

  // Fetch indicators data based on config
  useEffect(() => {
    let active = true;
    const loadIndicators = async () => {
      const newInds = { rsi: null, sma1: null, sma2: null };
      try {
        if (indicatorsConfig.rsi) {
          newInds.rsi = await fetchRSI(symbol, timeframe, 14); 
        }
        if (indicatorsConfig.sma1) {
          newInds.sma1 = await fetchSMA(symbol, timeframe, indicatorsConfig.sma1Period);
        }
        if (indicatorsConfig.sma2) {
          newInds.sma2 = await fetchSMA(symbol, timeframe, indicatorsConfig.sma2Period);
        }
        if (active) setIndicatorsData(newInds);
      } catch (err) {
        console.error("Failed to load indicators", err);
      }
    };
    
    // Only load if base data exists (prevents race condition errors)
    if (data.candles.length > 0) {
      loadIndicators();
    }
    
    return () => { active = false; };
  }, [symbol, timeframe, indicatorsConfig, data.candles]);

  return (
    <div className="app-container">
      <div className="header-section">
        <TopBar
          symbol={symbol}
          setSymbol={setSymbol}
          timeframe={timeframe}
          setTimeframe={setTimeframe}
          isLoading={isLoading}
          isReplayMode={replay.isReplayMode}
          startReplay={replay.startReplay}
          chartType={chartType}
          setChartType={setChartType}
          crosshairEnabled={crosshairEnabled}
          setCrosshairEnabled={setCrosshairEnabled}
        />
        <IndicatorPanel
          indicators={indicatorsConfig}
          setIndicators={setIndicatorsConfig}
          onSmaUpdate={handleSmaUpdate}
        />
      </div>

      <div className="main-layout">
        <DrawingToolbar 
          activeTool={activeTool} 
          setActiveTool={setActiveTool} 
          clearDrawings={clearDrawings} 
        />

      {replay.isReplayMode && (
        <ReplayControls
          isPlaying={replay.isPlaying}
          togglePlay={replay.togglePlay}
          stepForward={replay.stepForward}
          replaySpeed={replay.replaySpeed}
          setReplaySpeed={replay.setReplaySpeed}
          exitReplay={replay.exitReplay}
          currentIndex={replay.replayIndex}
          totalCount={data.candles.length}
          setReplayIndex={replay.setReplayIndex}
        />
      )}

      <div className="content-section">
        {error ? (
          <div className="error-banner">Error: {error}</div>
        ) : (
          <Chart
            data={displayData}
            indicatorsData={displayIndicators}
            config={indicatorsConfig}
            chartType={chartType}
            crosshairEnabled={crosshairEnabled}
            drawings={drawings}
            setDrawings={setDrawings}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            selectedDrawingId={selectedDrawingId}
            setSelectedDrawingId={setSelectedDrawingId}
          />
        )}
      </div>
      </div>
      
      <div className="watermark">Data: Yahoo Finance</div>
    </div>
  );
}
