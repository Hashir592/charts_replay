import {
  CandlestickChart,
  BarChart3,
  LineChart,
  AreaChart,
} from 'lucide-react';

/** Symbols the backend serves, with the metadata the UI needs to render them. */
export const SYMBOLS = [
  { id: 'BTCUSD', name: 'Bitcoin / U.S. Dollar', type: 'crypto', color: '#f7931a', ticker: 'BTC', digits: 2 },
  { id: 'ETHUSD', name: 'Ethereum / U.S. Dollar', type: 'crypto', color: '#627eea', ticker: 'ETH', digits: 2 },
  { id: 'XAUUSD', name: 'Gold Spot / U.S. Dollar', type: 'commodity', color: '#d4af37', ticker: 'XAU', digits: 2 },
];

export const getSymbolMeta = (id) =>
  SYMBOLS.find((s) => s.id === id) || {
    id,
    name: id,
    type: '',
    color: '#787b86',
    ticker: id.slice(0, 3),
    digits: 2,
  };

/**
 * Timeframes grouped the way TradingView's interval menu groups them.
 * `label` is the compact form shown on the toolbar (TradingView writes 1d as "D").
 */
export const TIMEFRAME_GROUPS = [
  {
    group: 'Minutes',
    items: [
      { id: '1m', label: '1m', long: '1 minute' },
      { id: '5m', label: '5m', long: '5 minutes' },
      { id: '15m', label: '15m', long: '15 minutes' },
      { id: '30m', label: '30m', long: '30 minutes' },
    ],
  },
  {
    group: 'Hours',
    items: [
      { id: '1h', label: '1h', long: '1 hour' },
      { id: '4h', label: '4h', long: '4 hours' },
    ],
  },
  {
    group: 'Days',
    items: [
      { id: '1d', label: 'D', long: '1 day' },
      { id: '1W', label: 'W', long: '1 week' },
    ],
  },
];

export const TIMEFRAMES = TIMEFRAME_GROUPS.flatMap((g) => g.items);

/** Shown directly on the toolbar; the rest live behind the caret. */
export const QUICK_TIMEFRAMES = ['15m', '1h', '4h', '1d'];

export const getTimeframeMeta = (id) =>
  TIMEFRAMES.find((t) => t.id === id) || { id, label: id, long: id };

export const CHART_TYPES = [
  { id: 'candles', label: 'Candles', icon: CandlestickChart },
  { id: 'bars', label: 'Bars', icon: BarChart3 },
  { id: 'line', label: 'Line', icon: LineChart },
  { id: 'area', label: 'Area', icon: AreaChart },
];

export const getChartTypeMeta = (id) =>
  CHART_TYPES.find((c) => c.id === id) || CHART_TYPES[0];

/** Palette used for indicator lines and their legend swatches. */
export const INDICATOR_COLORS = {
  sma1: '#f7931a',
  sma2: '#2962ff',
  rsi: '#7e57c2',
};
