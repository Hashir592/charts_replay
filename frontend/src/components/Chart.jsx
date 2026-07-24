import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CrosshairMode,
  LineStyle,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  BarSeries,
  AreaSeries,
} from 'lightweight-charts';
import { Settings2, X } from 'lucide-react';
import DrawingOverlay from './DrawingOverlay';
import { getSymbolMeta, getTimeframeMeta, INDICATOR_COLORS } from '../constants';

/* Palette — kept in sync with index.css so the canvas matches the DOM chrome. */
const C = {
  bg: '#131722',
  text: '#b2b5be',
  grid: 'rgba(240, 243, 250, 0.06)',
  border: '#2a2e39',
  crosshair: '#758696',
  crosshairLabel: '#363a45',
  up: '#089981',
  down: '#f23645',
  volUp: 'rgba(8, 153, 129, 0.5)',
  volDown: 'rgba(242, 54, 69, 0.5)',
  accent: '#2962ff',
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, 'Segoe UI', Helvetica, Arial, sans-serif";

/* Shared price-scale width so the price pane and the RSI pane stay aligned. */
const PRICE_SCALE_WIDTH = 64;

/** Options shared by the price pane and the RSI pane. */
const baseChartOptions = () => ({
  layout: {
    background: { type: ColorType.Solid, color: C.bg },
    textColor: C.text,
    fontSize: 12,
    fontFamily: FONT,
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: C.grid },
    horzLines: { color: C.grid },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: {
      color: C.crosshair,
      width: 1,
      style: LineStyle.LargeDashed,
      labelBackgroundColor: C.crosshairLabel,
    },
    horzLine: {
      color: C.crosshair,
      width: 1,
      style: LineStyle.LargeDashed,
      labelBackgroundColor: C.crosshairLabel,
    },
  },
  rightPriceScale: {
    borderColor: C.border,
    borderVisible: true,
    entireTextOnly: false,
  },
  timeScale: {
    borderColor: C.border,
    timeVisible: true,
    secondsVisible: false,
    rightBarStaysOnScroll: true,
    lockVisibleTimeRangeOnResize: true,
  },
});

export default function Chart({
  data,
  indicatorsData,
  config,
  setConfig,
  chartType,
  crosshairEnabled,
  drawings,
  setDrawings,
  activeTool,
  setActiveTool,
  selectedDrawingId,
  setSelectedDrawingId,
  openTrades,
  modifyTrade,
  closeTrade,
  addToast,
  symbolsInfo,
  currentBarIndex,
  setActiveAccordionId,
  symbol,
  timeframe,
  onIndicatorsClick,
  chartApiRef,
}) {
  const chartContainerRef = useRef(null);
  const rsiContainerRef = useRef(null);

  const mainChartRef = useRef(null);
  const rsiChartRef = useRef(null);

  const seriesRefs = useRef({
    candle: null,
    bar: null,
    line: null,
    area: null,
    volume: null,
    sma1: null,
    sma2: null,
    rsi: null,
  });

  const firstCandleTimeRef = useRef(null);
  const tradeLinesRef = useRef({});
  const candleIndexRef = useRef(new Map());

  // `hovered` is null when the crosshair is off the chart — the legend then
  // falls back to the most recent bar, which is what TradingView does.
  const [hovered, setHovered] = useState(null);
  const [lastBar, setLastBar] = useState(null);
  const [rsiValue, setRsiValue] = useState(null);

  const [contextMenu, setContextMenu] = useState(null);
  const dragStateRef = useRef({
    isDragging: false,
    tradeId: null,
    type: null,
    priceLine: null,
    startPrice: 0,
  });

  const [tradeLabels, setTradeLabels] = useState([]);

  const symbolMeta = getSymbolMeta(symbol);
  const tfMeta = getTimeframeMeta(timeframe);
  const digits = symbolMeta.digits;

  const fmt = useCallback(
    (v) =>
      v == null || isNaN(v)
        ? '—'
        : v.toLocaleString(undefined, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
          }),
    [digits]
  );

  const fmtVol = (v) => {
    if (v == null || isNaN(v)) return '—';
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
    return v.toFixed(0);
  };

  /* ── Chart construction (once) ───────────────────────────────────────── */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const mainChart = createChart(chartContainerRef.current, {
      ...baseChartOptions(),
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      timeScale: {
        ...baseChartOptions().timeScale,
        rightOffset: 8,
        barSpacing: 8,
        minBarSpacing: 0.4,
      },
      rightPriceScale: {
        ...baseChartOptions().rightPriceScale,
        scaleMargins: { top: 0.08, bottom: 0.22 },
        // Pin the price-scale width so the RSI pane below lines up with the
        // price pane. Without this, "51,219.13" and "45.32" reserve different
        // widths and the two time axes drift apart horizontally.
        minimumWidth: PRICE_SCALE_WIDTH,
      },
    });
    mainChartRef.current = mainChart;

    const priceFormat = { type: 'price', precision: digits, minMove: 1 / 10 ** digits };

    seriesRefs.current.candle = mainChart.addSeries(CandlestickSeries, {
      upColor: C.up,
      downColor: C.down,
      borderVisible: false,
      wickUpColor: C.up,
      wickDownColor: C.down,
      priceLineStyle: LineStyle.Dashed,
      priceLineWidth: 1,
      priceFormat,
      visible: chartType === 'candles',
    });

    seriesRefs.current.bar = mainChart.addSeries(BarSeries, {
      upColor: C.up,
      downColor: C.down,
      thinBars: false,
      priceFormat,
      visible: chartType === 'bars',
    });

    seriesRefs.current.line = mainChart.addSeries(LineSeries, {
      color: C.accent,
      lineWidth: 2,
      priceFormat,
      visible: chartType === 'line',
    });

    seriesRefs.current.area = mainChart.addSeries(AreaSeries, {
      lineColor: C.accent,
      topColor: 'rgba(41, 98, 255, 0.28)',
      bottomColor: 'rgba(41, 98, 255, 0.01)',
      lineWidth: 2,
      priceFormat,
      visible: chartType === 'area',
    });

    const volumeSeries = mainChart.addSeries(HistogramSeries, {
      color: C.volUp,
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.86, bottom: 0 },
    });
    seriesRefs.current.volume = volumeSeries;

    mainChart.subscribeCrosshairMove((param) => {
      if (!param.time || param.seriesData.size === 0) {
        setHovered(null);
        return;
      }
      const candleData = param.seriesData.get(seriesRefs.current.candle);
      const volumeData = param.seriesData.get(volumeSeries);
      if (!candleData) {
        setHovered(null);
        return;
      }
      const idx = candleIndexRef.current.get(param.time);
      setHovered({
        ...candleData,
        vol: volumeData ? volumeData.value : null,
        index: idx,
      });
    });

    // ResizeObserver keeps the canvas correct when side/bottom panels resize,
    // which a window `resize` listener alone would miss.
    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current && mainChartRef.current) {
        const { clientWidth, clientHeight } = chartContainerRef.current;
        mainChartRef.current.resize(clientWidth, clientHeight);
      }
      if (rsiContainerRef.current && rsiChartRef.current) {
        const { clientWidth, clientHeight } = rsiContainerRef.current;
        rsiChartRef.current.resize(clientWidth, clientHeight);
      }
    });
    ro.observe(chartContainerRef.current);
    if (rsiContainerRef.current) ro.observe(rsiContainerRef.current);

    return () => {
      ro.disconnect();
      if (mainChartRef.current) {
        mainChartRef.current.remove();
        mainChartRef.current = null;
      }
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Expose a screenshot handle to the toolbar's camera button. */
  useEffect(() => {
    if (!chartApiRef) return;
    chartApiRef.current = {
      screenshot: () => {
        if (!mainChartRef.current) return;
        const canvas = mainChartRef.current.takeScreenshot();
        const link = document.createElement('a');
        link.download = `${symbol}_${timeframe}_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      },
      fitContent: () => mainChartRef.current?.timeScale().fitContent(),
      scrollToRealtime: () => mainChartRef.current?.timeScale().scrollToRealTime(),
    };
  }, [chartApiRef, symbol, timeframe]);

  /* Price precision follows the symbol. */
  useEffect(() => {
    const priceFormat = { type: 'price', precision: digits, minMove: 1 / 10 ** digits };
    ['candle', 'bar', 'line', 'area'].forEach((k) => {
      seriesRefs.current[k]?.applyOptions({ priceFormat });
    });
  }, [digits]);

  /* ── Data ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mainChartRef.current || !data.candles || data.candles.length === 0) return;

    const uniqueCandlesMap = new Map();
    data.candles.forEach((c) => uniqueCandlesMap.set(c.time, c));
    const candles = Array.from(uniqueCandlesMap.values()).sort((a, b) => a.time - b.time);

    const idxMap = new Map();
    candles.forEach((c, i) => idxMap.set(c.time, i));
    candleIndexRef.current = idxMap;

    seriesRefs.current.candle.setData(candles);
    seriesRefs.current.bar.setData(candles);
    const lineData = candles.map((c) => ({ time: c.time, value: c.close }));
    seriesRefs.current.line.setData(lineData);
    seriesRefs.current.area.setData(lineData);

    seriesRefs.current.volume.setData(
      candles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? C.volUp : C.volDown,
      }))
    );

    const firstCandleTime = candles[0]?.time;
    if (firstCandleTime !== firstCandleTimeRef.current) {
      mainChartRef.current.timeScale().scrollToRealTime();
      if (rsiChartRef.current) rsiChartRef.current.timeScale().scrollToRealTime();
      mainChartRef.current.priceScale('right').applyOptions({ autoScale: true });
      firstCandleTimeRef.current = firstCandleTime;
    }

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    if (last) setLastBar({ ...last, vol: last.volume, prevClose: prev?.close });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  /* ── Chart type / crosshair toggles ──────────────────────────────────── */
  useEffect(() => {
    if (!mainChartRef.current) return;
    mainChartRef.current.applyOptions({
      crosshair: { mode: crosshairEnabled ? CrosshairMode.Normal : CrosshairMode.Hidden },
    });
    seriesRefs.current.candle?.applyOptions({ visible: chartType === 'candles' });
    seriesRefs.current.bar?.applyOptions({ visible: chartType === 'bars' });
    seriesRefs.current.line?.applyOptions({ visible: chartType === 'line' });
    seriesRefs.current.area?.applyOptions({ visible: chartType === 'area' });
  }, [chartType, crosshairEnabled]);

  /* ── Indicators ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mainChartRef.current) return;

    const applyOverlay = (key, color) => {
      if (config[key] && indicatorsData[key]) {
        if (!seriesRefs.current[key]) {
          seriesRefs.current[key] = mainChartRef.current.addSeries(LineSeries, {
            color,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
        }
        const map = new Map();
        indicatorsData[key].forEach((d) => {
          if (d.value !== null && !isNaN(d.value)) map.set(d.time, d);
        });
        seriesRefs.current[key].setData(
          Array.from(map.values()).sort((a, b) => a.time - b.time)
        );
      } else if (seriesRefs.current[key]) {
        mainChartRef.current.removeSeries(seriesRefs.current[key]);
        seriesRefs.current[key] = null;
      }
    };

    applyOverlay('sma1', INDICATOR_COLORS.sma1);
    applyOverlay('sma2', INDICATOR_COLORS.sma2);

    // RSI lives in its own pane below the price chart.
    if (config.rsi && indicatorsData.rsi) {
      rsiContainerRef.current.style.display = 'block';

      if (!rsiChartRef.current) {
        rsiChartRef.current = createChart(rsiContainerRef.current, {
          ...baseChartOptions(),
          handleScroll: { mouseWheel: true, pressedMouseMove: true },
          handleScale: { mouseWheel: true, pinch: true },
          rightPriceScale: {
            ...baseChartOptions().rightPriceScale,
            scaleMargins: { top: 0.15, bottom: 0.15 },
            minimumWidth: PRICE_SCALE_WIDTH,
          },
        });

        seriesRefs.current.rsi = rsiChartRef.current.addSeries(LineSeries, {
          color: INDICATOR_COLORS.rsi,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: 0, maxValue: 100 },
          }),
        });
        seriesRefs.current.rsi.createPriceLine({
          price: 70,
          color: 'rgba(120, 123, 134, 0.5)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
        });
        seriesRefs.current.rsi.createPriceLine({
          price: 30,
          color: 'rgba(120, 123, 134, 0.5)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
        });

        rsiChartRef.current.subscribeCrosshairMove((param) => {
          const d = param.seriesData?.get(seriesRefs.current.rsi);
          setRsiValue(d && d.value != null ? d.value : null);
          // Mirror the RSI crosshair onto the price pane so both panes track
          // the same bar when the pointer is over the RSI.
          if (param.time != null && seriesRefs.current.candle) {
            mainChartRef.current?.setCrosshairPosition(NaN, param.time, seriesRefs.current.candle);
          } else {
            mainChartRef.current?.clearCrosshairPosition();
          }
        });

        // ...and the price crosshair onto the RSI pane.
        mainChartRef.current.subscribeCrosshairMove((param) => {
          if (!rsiChartRef.current || !seriesRefs.current.rsi) return;
          if (param.time != null) {
            rsiChartRef.current.setCrosshairPosition(NaN, param.time, seriesRefs.current.rsi);
          } else {
            rsiChartRef.current.clearCrosshairPosition();
          }
        });

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

      // Keep the RSI series index-aligned with the candles: emit one point per
      // bar, using whitespace ({ time } only) for the leading nulls instead of
      // dropping them. The panes are synced by logical index, so a shorter RSI
      // array would shift the whole plot left and make RSI "lag" the price by
      // `period` bars — and drift backwards as bars stream in during replay.
      const map = new Map();
      indicatorsData.rsi.forEach((d) => {
        map.set(d.time, d.value != null && !isNaN(d.value) ? { time: d.time, value: d.value } : { time: d.time });
      });
      const rsiData = Array.from(map.values()).sort((a, b) => a.time - b.time);
      seriesRefs.current.rsi.setData(rsiData);
      let lastRsi = null;
      for (let i = rsiData.length - 1; i >= 0; i--) {
        if (rsiData[i].value != null) {
          lastRsi = rsiData[i].value;
          break;
        }
      }
      setRsiValue(lastRsi);

      // Align the RSI pane to wherever the price pane is currently scrolled.
      // The range subscription only fires on future moves, so the first paint
      // (and every symbol/timeframe switch) needs this explicit nudge.
      const range = mainChartRef.current?.timeScale().getVisibleLogicalRange();
      if (range) rsiChartRef.current.timeScale().setVisibleLogicalRange(range);
    } else {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
        seriesRefs.current.rsi = null;
      }
      if (rsiContainerRef.current) rsiContainerRef.current.style.display = 'none';
    }
  }, [config, indicatorsData]);

  /* ── Trade levels ────────────────────────────────────────────────────── */
  const updateLabels = useCallback(() => {
    if (!seriesRefs.current.candle || !openTrades) return;
    const candleSeries = seriesRefs.current.candle;

    const newLabels = [];
    openTrades.forEach((trade) => {
      ['entry', 'tp', 'sl'].forEach((type) => {
        let price = null;
        let text = '';
        let color = '';
        let isDraggable = false;

        if (type === 'entry') {
          price = trade.openPrice;
          text = `${trade.direction} ${trade.lots}`;
          color = trade.direction === 'BUY' ? C.up : C.down;
        } else if (type === 'tp' && trade.tp) {
          price = trade.tp;
          text = 'TP';
          color = C.up;
          isDraggable = true;
        } else if (type === 'sl' && trade.sl) {
          price = trade.sl;
          text = 'SL';
          color = C.down;
          isDraggable = true;
        }

        if (price !== null) {
          try {
            const y = candleSeries.priceToCoordinate(price);
            if (y !== null) {
              newLabels.push({
                id: `${trade.id}-${type}`,
                tradeId: trade.id,
                type,
                price,
                text,
                color,
                y,
                isDraggable,
              });
            }
          } catch {
            /* price scale not ready yet */
          }
        }
      });
    });
    setTradeLabels(newLabels);
  }, [openTrades]);

  useEffect(() => {
    if (!seriesRefs.current.candle) return;
    const candleSeries = seriesRefs.current.candle;

    Object.values(tradeLinesRef.current).forEach((lineObj) => {
      ['entry', 'tp', 'sl'].forEach((k) => {
        if (lineObj[k]) {
          try {
            candleSeries.removePriceLine(lineObj[k]);
          } catch {
            /* already gone */
          }
        }
      });
    });
    tradeLinesRef.current = {};

    if (!openTrades) {
      setTradeLabels([]);
      return;
    }

    openTrades.forEach((trade) => {
      const lineObj = {};
      try {
        lineObj.entry = candleSeries.createPriceLine({
          price: trade.openPrice,
          color: trade.direction === 'BUY' ? C.up : C.down,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
        });
        if (trade.tp) {
          lineObj.tp = candleSeries.createPriceLine({
            price: trade.tp,
            color: C.up,
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
          });
        }
        if (trade.sl) {
          lineObj.sl = candleSeries.createPriceLine({
            price: trade.sl,
            color: C.down,
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
          });
        }
      } catch {
        /* chart empty */
      }
      tradeLinesRef.current[trade.id] = lineObj;
    });

    updateLabels();
  }, [openTrades, updateLabels]);

  useEffect(() => {
    if (!mainChartRef.current) return;
    const timeScale = mainChartRef.current.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(updateLabels);
    return () => timeScale.unsubscribeVisibleLogicalRangeChange(updateLabels);
  }, [updateLabels]);

  /* Keep the labels glued to their prices while data streams in. */
  useEffect(() => {
    updateLabels();
  }, [data, updateLabels]);

  /* ── Dragging TP/SL ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const container = chartContainerRef.current;

    const handleMouseMove = (e) => {
      if (!dragStateRef.current.isDragging) return;
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const newPrice = seriesRefs.current.candle.coordinateToPrice(y);
      if (newPrice !== null) {
        dragStateRef.current.priceLine.applyOptions({ price: newPrice, lineWidth: 2 });
        updateLabels();
      }
    };

    const handleMouseUp = (e) => {
      if (!dragStateRef.current.isDragging) return;
      const { tradeId, type, priceLine, startPrice } = dragStateRef.current;
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const newPrice = seriesRefs.current.candle.coordinateToPrice(y);

      mainChartRef.current.applyOptions({ handleScroll: { pressedMouseMove: true } });

      if (!data.candles || data.candles.length === 0) {
        priceLine.applyOptions({ price: startPrice, lineWidth: 1 });
      } else {
        const currentPrice = data.candles[data.candles.length - 1].close;
        const trade = openTrades.find((t) => t.id === tradeId);
        let valid = true;

        if (trade) {
          if (trade.direction === 'BUY') {
            if (type === 'tp' && newPrice <= currentPrice) valid = false;
            if (type === 'sl' && newPrice >= currentPrice) valid = false;
          } else {
            if (type === 'tp' && newPrice >= currentPrice) valid = false;
            if (type === 'sl' && newPrice <= currentPrice) valid = false;
          }
        } else {
          valid = false;
        }

        if (valid) {
          modifyTrade?.(tradeId, { [type]: newPrice });
          addToast?.(`${type.toUpperCase()} moved to ${fmt(newPrice)}`, 'success');
        } else {
          priceLine.applyOptions({ price: startPrice, lineWidth: 1 });
          addToast?.(`Invalid ${type.toUpperCase()} level`, 'error');
        }
      }

      dragStateRef.current = {
        isDragging: false,
        tradeId: null,
        type: null,
        priceLine: null,
        startPrice: 0,
      };
      document.body.style.cursor = '';
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const foundLabel = tradeLabels.find((l) => Math.abs(l.y - y) < 12);
      setContextMenu(foundLabel ? { x: e.clientX, y: e.clientY, ...foundLabel } : null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [openTrades, data.candles, modifyTrade, addToast, tradeLabels, updateLabels, fmt]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    const handleEscape = (e) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  /* ── Legend values ───────────────────────────────────────────────────── */
  const bar = hovered || lastBar;
  let prevClose = lastBar?.prevClose;
  if (hovered && hovered.index != null && hovered.index > 0) {
    prevClose = data.candles[hovered.index - 1]?.close;
  }
  const change = bar && prevClose != null ? bar.close - prevClose : null;
  const changePct = change != null && prevClose ? (change / prevClose) * 100 : null;
  const barUp = bar ? bar.close >= bar.open : true;
  const barColor = barUp ? 'var(--up-color)' : 'var(--down-color)';

  const smaValueAt = (key) => {
    const series = indicatorsData?.[key];
    if (!series || !series.length) return null;
    if (hovered && bar) {
      const point = series.find((d) => d.time === bar.time);
      return point?.value ?? null;
    }
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].value != null && !isNaN(series[i].value)) return series[i].value;
    }
    return null;
  };

  const overlayLegend = [
    config.sma1 && {
      key: 'sma1',
      label: `SMA ${config.sma1Period}`,
      color: INDICATOR_COLORS.sma1,
      value: smaValueAt('sma1'),
    },
    config.sma2 && {
      key: 'sma2',
      label: `SMA ${config.sma2Period}`,
      color: INDICATOR_COLORS.sma2,
      value: smaValueAt('sma2'),
    },
  ].filter(Boolean);

  const removeIndicator = (key) => setConfig?.((prev) => ({ ...prev, [key]: false }));

  return (
    <div className="chart-wrapper">
      <div ref={chartContainerRef} className="main-chart">
        {/* Faint ticker behind the candles, as on TradingView */}
        <div className="chart-watermark">
          <div className="wm-symbol">{symbol}</div>
          <div className="wm-sub">{tfMeta.long} · Yahoo Finance</div>
        </div>

        <div className="chart-legend">
          <div className="legend-row">
            <span className="legend-title">{symbol}</span>
            <span className="legend-meta">
              {tfMeta.label} · Yahoo
            </span>
          </div>

          {bar && (
            <div className="legend-row">
              <span className="legend-ohlc" style={{ color: barColor }}>
                <span>
                  <b>O</b>
                  {fmt(bar.open)}
                </span>
                <span>
                  <b>H</b>
                  {fmt(bar.high)}
                </span>
                <span>
                  <b>L</b>
                  {fmt(bar.low)}
                </span>
                <span>
                  <b>C</b>
                  {fmt(bar.close)}
                </span>
              </span>
              {change != null && (
                <span className="legend-change" style={{ color: barColor }}>
                  {change >= 0 ? '+' : ''}
                  {change.toFixed(digits)} ({change >= 0 ? '+' : ''}
                  {changePct.toFixed(2)}%)
                </span>
              )}
            </div>
          )}

          {bar?.vol != null && (
            <div className="legend-row">
              <span className="legend-indicator">
                Vol&nbsp;
                <span style={{ color: barColor }}>{fmtVol(bar.vol)}</span>
              </span>
            </div>
          )}

          {overlayLegend.map((ind) => (
            <div className="legend-row" key={ind.key}>
              <span className="legend-indicator">
                <span className="legend-dot" style={{ background: ind.color }} />
                {ind.label}
                <span style={{ color: ind.color }}>
                  &nbsp;{ind.value != null ? fmt(ind.value) : 'n/a'}
                </span>
              </span>
              <span className="legend-actions">
                <button
                  className="legend-action"
                  title="Settings"
                  onClick={onIndicatorsClick}
                >
                  <Settings2 size={13} />
                </button>
                <button
                  className="legend-action"
                  title="Remove"
                  onClick={() => removeIndicator(ind.key)}
                >
                  <X size={13} />
                </button>
              </span>
            </div>
          ))}
        </div>

        {tradeLabels.map((label) => (
          <div
            key={label.id}
            className="trade-line-label"
            style={{
              top: `${label.y}px`,
              left: '12px',
              backgroundColor: label.color,
              cursor: label.isDraggable ? 'ns-resize' : 'pointer',
            }}
            onMouseDown={(e) => {
              if (e.button !== 0 || !label.isDraggable) return;
              e.stopPropagation();
              const priceLine = tradeLinesRef.current[label.tradeId]?.[label.type];
              if (priceLine) {
                dragStateRef.current = {
                  isDragging: true,
                  tradeId: label.tradeId,
                  type: label.type,
                  priceLine,
                  startPrice: label.price,
                };
                mainChartRef.current.applyOptions({
                  handleScroll: { pressedMouseMove: false },
                });
                document.body.style.cursor = 'ns-resize';
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, ...label });
            }}
          >
            <span>{label.text}</span>
            <button
              className="label-close"
              title={label.type === 'entry' ? 'Close trade' : `Remove ${label.type}`}
              onClick={(e) => {
                e.stopPropagation();
                if (label.type === 'entry') {
                  setActiveAccordionId(label.tradeId, 'close');
                } else {
                  modifyTrade(label.tradeId, { [label.type]: null });
                }
              }}
            >
              &times;
            </button>
          </div>
        ))}

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

      <div ref={rsiContainerRef} className="rsi-chart" style={{ display: 'none' }}>
        <div className="chart-legend">
          <div className="legend-row">
            <span className="legend-indicator">
              <span className="legend-dot" style={{ background: INDICATOR_COLORS.rsi }} />
              RSI 14
              <span style={{ color: INDICATOR_COLORS.rsi }}>
                &nbsp;{rsiValue != null ? rsiValue.toFixed(2) : '—'}
              </span>
            </span>
            <span className="legend-actions">
              <button className="legend-action" title="Settings" onClick={onIndicatorsClick}>
                <Settings2 size={13} />
              </button>
              <button
                className="legend-action"
                title="Remove"
                onClick={() => removeIndicator('rsi')}
              >
                <X size={13} />
              </button>
            </span>
          </div>
        </div>
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.type !== 'entry' && (
            <button
              className="cm-item"
              onClick={(e) => {
                e.stopPropagation();
                setActiveAccordionId(contextMenu.tradeId, 'modify');
                setContextMenu(null);
              }}
            >
              Modify TP/SL
            </button>
          )}
          {contextMenu.type === 'tp' && (
            <button
              className="cm-item danger"
              onClick={(e) => {
                e.stopPropagation();
                modifyTrade(contextMenu.tradeId, { tp: null });
                setContextMenu(null);
              }}
            >
              Remove take profit
            </button>
          )}
          {contextMenu.type === 'sl' && (
            <button
              className="cm-item danger"
              onClick={(e) => {
                e.stopPropagation();
                modifyTrade(contextMenu.tradeId, { sl: null });
                setContextMenu(null);
              }}
            >
              Remove stop loss
            </button>
          )}
          <button
            className="cm-item danger"
            onClick={(e) => {
              e.stopPropagation();
              setActiveAccordionId(contextMenu.tradeId, 'close');
              setContextMenu(null);
            }}
          >
            Close trade
          </button>
        </div>
      )}
    </div>
  );
}
