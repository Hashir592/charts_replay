import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import TopBar from './components/TopBar';
import IndicatorsDialog from './components/IndicatorsDialog';
import Chart from './components/Chart';
import ReplayControls from './components/ReplayControls';
import DrawingToolbar from './components/DrawingToolbar';
import StatusBar from './components/StatusBar';
import ChartErrorBoundary from './components/ChartErrorBoundary';
import ChartSkeleton from './components/ChartSkeleton';
import useReplay from './hooks/useReplay';
import { fetchCandles, fetchVolume, fetchRSI, fetchSMA, fetchSymbols } from './api';

import LoginScreen from './components/trading/LoginScreen';
import AccountSetupModal from './components/trading/AccountSetupModal';
import AccountBar from './components/trading/AccountBar';
import TradePanel from './components/trading/TradePanel';
import PositionsPanel from './components/trading/PositionsPanel';
import ToastStack from './components/trading/ToastStack';
import useSession from './hooks/useSession';
import useTradingEngine from './hooks/useTradingEngine';
import useReplayTrading from './hooks/useReplayTrading';

/** Alt+<key> shortcuts for drawing tools, matching TradingView's bindings. */
const TOOL_SHORTCUTS = {
  t: 'trend_line',
  h: 'horizontal_line',
  f: 'fib_retracement',
  r: 'rectangle',
};

export default function App() {
  const session = useSession();

  const [symbol, setSymbol] = useState('BTCUSD');
  const [timeframe, setTimeframe] = useState('1d');
  const [chartType, setChartType] = useState('candles');
  const [crosshairEnabled, setCrosshairEnabled] = useState(true);

  const [activeTool, setActiveTool] = useState('cursor');
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [data, setData] = useState({ candles: [], volume: [] });
  const [indicatorsData, setIndicatorsData] = useState({
    rsi: null,
    sma1: null,
    sma2: null,
  });
  const [symbolsInfo, setSymbolsInfo] = useState([]);

  const [indicatorsConfig, setIndicatorsConfig] = useState({
    rsi: false,
    sma1: true,
    sma1Period: 20,
    sma2: false,
    sma2Period: 50,
  });
  const [showIndicators, setShowIndicators] = useState(false);

  const [showTradePanel, setShowTradePanel] = useState(false);
  const [showPositions, setShowPositions] = useState(true);
  const [activeAccordionId, setActiveAccordionId] = useState(null);
  const [activeFormType, setActiveFormType] = useState(null);
  const [toasts, setToasts] = useState([]);

  const chartApiRef = useRef(null);

  // Resizable bottom panel
  const [panelHeight, setPanelHeight] = useState(
    () => parseInt(localStorage.getItem('positionsPanelHeight')) || 200,
  );
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const applyHeight = (clientY) => {
      const windowHeight = window.innerHeight;
      const newHeight = windowHeight - clientY;
      const maxH = windowHeight * 0.7;
      const clamped = Math.max(36, Math.min(newHeight, maxH));
      setPanelHeight(clamped);
      setIsPanelCollapsed(clamped <= 36);
    };

    const handleGlobalMouseMove = (e) => {
      if (isDraggingRef.current) applyHeight(e.clientY);
    };
    const handleTouchMove = (e) => {
      if (isDraggingRef.current) applyHeight(e.touches[0].clientY);
    };
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        if (panelHeight > 36) localStorage.setItem('positionsPanelHeight', panelHeight);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [panelHeight]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
  };

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const replay = useReplay(data.candles.length);

  const { placeTrade, closeTrade, cancelPendingOrder, modifyTrade, partialCloseTrade } =
    useTradingEngine(session, symbolsInfo, addToast);

  // Memoised so the sliced objects keep a stable identity between renders.
  // Without this, every render hands Chart/DrawingOverlay a brand-new `data`
  // object during replay, re-running their data effects on each render.
  const displayData = useMemo(
    () =>
      replay.isReplayMode
        ? {
            candles: data.candles.slice(0, replay.replayIndex + 1),
            volume: data.volume.slice(0, replay.replayIndex + 1),
          }
        : data,
    [data, replay.isReplayMode, replay.replayIndex],
  );

  const displayIndicators = useMemo(
    () =>
      replay.isReplayMode
        ? {
            rsi: indicatorsData.rsi
              ? indicatorsData.rsi.slice(0, replay.replayIndex + 1)
              : null,
            sma1: indicatorsData.sma1
              ? indicatorsData.sma1.slice(0, replay.replayIndex + 1)
              : null,
            sma2: indicatorsData.sma2
              ? indicatorsData.sma2.slice(0, replay.replayIndex + 1)
              : null,
          }
        : indicatorsData,
    [indicatorsData, replay.isReplayMode, replay.replayIndex],
  );

  const currentCandle =
    displayData.candles.length > 0
      ? displayData.candles[displayData.candles.length - 1]
      : null;
  const currentPrice = currentCandle ? currentCandle.close : 0;

  const prevCandle =
    displayData.candles.length > 1
      ? displayData.candles[displayData.candles.length - 2]
      : null;
  const priceInfo = currentCandle
    ? {
        price: currentPrice,
        change: prevCandle ? currentPrice - prevCandle.close : 0,
        changePct: prevCandle
          ? ((currentPrice - prevCandle.close) / prevCandle.close) * 100
          : 0,
      }
    : null;

  useReplayTrading(
    session,
    symbolsInfo,
    replay.replayIndex,
    currentCandle,
    closeTrade,
    addToast,
    symbol,
  );

  const drawingKey = `${symbol}_${timeframe}`;
  const drawings = session.drawingsMap[drawingKey] || [];

  const setDrawings = useCallback(
    (newDrawings) => {
      session.setDrawingsMap((prev) => ({
        ...prev,
        [drawingKey]:
          typeof newDrawings === 'function'
            ? newDrawings(prev[drawingKey] || [])
            : newDrawings,
      }));
    },
    [drawingKey, session],
  );

  const clearDrawings = useCallback(() => {
    if (drawings.length === 0) return;
    if (window.confirm('Remove all drawings on this chart?')) setDrawings([]);
  }, [setDrawings, drawings.length]);

  /* ── Keyboard shortcuts ──────────────────────────────────────────────── */
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.altKey) {
        const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          setActiveTool(tool);
          return;
        }
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (replay.isReplayMode) replay.togglePlay();
      } else if (e.key === 'ArrowRight') {
        if (replay.isReplayMode && !replay.isPlaying) replay.stepForward();
      } else if (e.key === 't' || e.key === 'T') {
        setShowTradePanel((prev) => !prev);
      } else if (e.key === 'p' || e.key === 'P') {
        setShowPositions((prev) => !prev);
      } else if (e.key === '/') {
        e.preventDefault();
        setShowIndicators(true);
      } else if (e.key === 'Escape') {
        setActiveTool('cursor');
        setShowTradePanel(false);
        setShowIndicators(false);
        setActiveAccordionId(null);
        setActiveFormType(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [replay]);

  /* ── Data loading ────────────────────────────────────────────────────── */
  useEffect(() => {
    fetchSymbols()
      .then((res) => {
        if (res && res.symbols) setSymbolsInfo(res.symbols);
      })
      .catch(console.error);
  }, []);

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
    if (session.username && session.account) loadData();
    return () => {
      active = false;
    };
  }, [symbol, timeframe, session.username, session.account]);

  useEffect(() => {
    let active = true;
    const loadIndicators = async () => {
      const newInds = { rsi: null, sma1: null, sma2: null };
      try {
        if (indicatorsConfig.rsi) newInds.rsi = await fetchRSI(symbol, timeframe, 14);
        if (indicatorsConfig.sma1)
          newInds.sma1 = await fetchSMA(symbol, timeframe, indicatorsConfig.sma1Period);
        if (indicatorsConfig.sma2)
          newInds.sma2 = await fetchSMA(symbol, timeframe, indicatorsConfig.sma2Period);
        if (active) setIndicatorsData(newInds);
      } catch (err) {
        console.error('Failed to load indicators', err);
      }
    };

    if (data.candles.length > 0) loadIndicators();
    return () => {
      active = false;
    };
  }, [symbol, timeframe, indicatorsConfig, data.candles]);

  if (!session.username) return <LoginScreen onLogin={session.login} />;
  if (!session.account) return <AccountSetupModal onSave={session.setupAccount} />;

  return (
    <div className="app-container">
      <ToastStack toasts={toasts} removeToast={removeToast} />

      <TopBar
        symbol={symbol}
        setSymbol={setSymbol}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        isLoading={isLoading}
        isReplayMode={replay.isReplayMode}
        startReplay={replay.startReplay}
        exitReplay={replay.exitReplay}
        chartType={chartType}
        setChartType={setChartType}
        crosshairEnabled={crosshairEnabled}
        setCrosshairEnabled={setCrosshairEnabled}
        session={session}
        onTradeClick={() => setShowTradePanel((prev) => !prev)}
        onPositionsClick={() => setShowPositions((prev) => !prev)}
        onIndicatorsClick={() => setShowIndicators(true)}
        onScreenshot={() => chartApiRef.current?.screenshot()}
        priceInfo={priceInfo}
      />

      <AccountBar
        session={session}
        currentSymbol={symbol}
        currentPrice={currentPrice}
        symbolsInfo={symbolsInfo}
      />

      <div className="main-layout">
        <DrawingToolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          clearDrawings={clearDrawings}
        />

        <div className="content-section">
          {error ? (
            <div className="error-banner">
              Could not load {symbol} · {timeframe}
              <div
                style={{
                  marginTop: 8,
                  color: 'var(--text-muted)',
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            </div>
          ) : (
            <ChartErrorBoundary
              resetKey={drawingKey}
              onClearDrawings={() => setDrawings([])}
            >
              <Chart
                data={displayData}
                indicatorsData={displayIndicators}
                config={indicatorsConfig}
                setConfig={setIndicatorsConfig}
                chartType={chartType}
                crosshairEnabled={crosshairEnabled}
                drawings={drawings}
                setDrawings={setDrawings}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                selectedDrawingId={selectedDrawingId}
                setSelectedDrawingId={setSelectedDrawingId}
                openTrades={session.openTrades}
                modifyTrade={modifyTrade}
                closeTrade={closeTrade}
                addToast={addToast}
                symbolsInfo={symbolsInfo}
                currentBarIndex={replay.replayIndex}
                symbol={symbol}
                timeframe={timeframe}
                onIndicatorsClick={() => setShowIndicators(true)}
                chartApiRef={chartApiRef}
                setActiveAccordionId={(id, formType) => {
                  setShowPositions(true);
                  setActiveAccordionId(id);
                  if (formType) setActiveFormType(formType);
                }}
              />
            </ChartErrorBoundary>
          )}

          {isLoading && !error && (
            <ChartSkeleton label={`Loading ${symbol} · ${timeframe}`} />
          )}

          {replay.isReplayMode && !error && (
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
        </div>

        {showTradePanel && (
          <div className="trade-panel-wrapper">
            <TradePanel
              session={session}
              symbolsInfo={symbolsInfo}
              currentSymbol={symbol}
              currentPrice={currentPrice}
              currentBarIndex={replay.replayIndex}
              placeTrade={placeTrade}
              onClose={() => setShowTradePanel(false)}
            />
          </div>
        )}
      </div>

      {showPositions && (
        <div
          className={`bottom-panel-container ${isPanelCollapsed ? 'collapsed' : ''}`}
          style={{ height: `${panelHeight}px` }}
        >
          <div
            className="panel-drag-handle"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          />
          <div className="positions-panel-wrapper">
            <PositionsPanel
              session={session}
              closeTrade={closeTrade}
              cancelOrder={cancelPendingOrder}
              modifyTrade={modifyTrade}
              partialCloseTrade={partialCloseTrade}
              symbolsInfo={symbolsInfo}
              currentSymbol={symbol}
              currentPrice={currentPrice}
              currentBarIndex={replay.replayIndex}
              activeAccordionId={activeAccordionId}
              setActiveAccordionId={(id, formType) => {
                setActiveAccordionId(id);
                setActiveFormType(formType);
              }}
              activeFormType={activeFormType}
              isCollapsed={isPanelCollapsed}
            />
          </div>
        </div>
      )}

      <StatusBar
        symbol={symbol}
        timeframe={timeframe}
        isReplayMode={replay.isReplayMode}
        isLoading={isLoading}
        error={error}
        barCount={displayData.candles.length}
        showPositions={showPositions}
        onTogglePositions={() => setShowPositions((prev) => !prev)}
        onFitContent={() => chartApiRef.current?.fitContent()}
      />

      {showIndicators && (
        <IndicatorsDialog
          indicators={indicatorsConfig}
          setIndicators={setIndicatorsConfig}
          onClose={() => setShowIndicators(false)}
        />
      )}
    </div>
  );
}
