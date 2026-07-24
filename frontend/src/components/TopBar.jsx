import React, { useState, useRef, useMemo, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  ChevronDown,
  Settings,
  Rewind,
  Check,
  Camera,
  LogOut,
  RotateCcw,
  Crosshair,
  Wallet,
  List,
} from 'lucide-react';
import useClickOutside from '../hooks/useClickOutside';
import {
  SYMBOLS,
  getSymbolMeta,
  TIMEFRAME_GROUPS,
  QUICK_TIMEFRAMES,
  getTimeframeMeta,
  CHART_TYPES,
  getChartTypeMeta,
} from '../constants';

/**
 * Toolbar dropdown. Rendered through a portal with fixed positioning: the
 * toolbar is a horizontal scroll container, so an in-flow popup would be
 * clipped, and focusing something inside it scrolls the toolbar out of view.
 */
function Dropdown({ open, onClose, anchorRef, align = 'left', children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const place = () => {
      const r = anchorRef.current.getBoundingClientRect();
      // Hang menus off the bottom edge of the toolbar, not the button, so they
      // all line up regardless of each button's height.
      const bar = anchorRef.current.closest('.top-bar');
      const top = (bar ? bar.getBoundingClientRect().bottom : r.bottom) + 3;
      setPos(
        align === 'right'
          ? { top, right: Math.max(4, window.innerWidth - r.right) }
          : { top, left: Math.max(4, r.left) }
      );
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, align, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (anchorRef.current?.contains(e.target)) return; // let the button toggle
      onClose();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;

  return createPortal(
    <div ref={ref} className="popup" style={{ position: 'fixed', ...pos }}>
      {children}
    </div>,
    document.body
  );
}

/** A toolbar button plus the menu it owns, keyed into a single open-menu slot. */
function MenuButton({
  name,
  openMenu,
  setOpenMenu,
  className,
  title,
  align,
  menu,
  children,
}) {
  const anchorRef = useRef(null);
  const open = openMenu === name;
  const close = () => setOpenMenu(null);
  return (
    <>
      <button
        ref={anchorRef}
        className={className}
        title={title}
        onClick={() => setOpenMenu(open ? null : name)}
      >
        {children}
      </button>
      <Dropdown open={open} onClose={close} anchorRef={anchorRef} align={align}>
        {typeof menu === 'function' ? menu(close) : menu}
      </Dropdown>
    </>
  );
}

function SymbolSearch({ onPick, onClose }) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SYMBOLS;
    return SYMBOLS.filter(
      (s) => s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="symbol-search">
      <div className="symbol-search-field">
        <Search size={16} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) {
              onPick(results[0].id);
              onClose();
            }
          }}
          placeholder="Search symbol"
        />
      </div>
      {results.length === 0 ? (
        <div className="symbol-empty">No symbols match “{query}”</div>
      ) : (
        results.map((s) => (
          <button
            key={s.id}
            className="symbol-result"
            onClick={() => {
              onPick(s.id);
              onClose();
            }}
          >
            <span className="symbol-result-badge" style={{ background: s.color }}>
              {s.ticker}
            </span>
            <span>
              <div className="symbol-result-id">{s.id}</div>
              <div className="symbol-result-name">{s.name}</div>
            </span>
            <span className="symbol-result-type">{s.type}</span>
          </button>
        ))
      )}
    </div>
  );
}

export default function TopBar({
  symbol,
  setSymbol,
  timeframe,
  setTimeframe,
  isLoading,
  isReplayMode,
  startReplay,
  exitReplay,
  chartType,
  setChartType,
  crosshairEnabled,
  setCrosshairEnabled,
  session,
  onTradeClick,
  onPositionsClick,
  onIndicatorsClick,
  onScreenshot,
  priceInfo,
}) {
  const [openMenu, setOpenMenu] = useState(null);

  const tfMeta = getTimeframeMeta(timeframe);
  const chartMeta = getChartTypeMeta(chartType);
  const ChartIcon = chartMeta.icon;
  const symbolMeta = getSymbolMeta(symbol);

  const up = (priceInfo?.change ?? 0) >= 0;

  return (
    <div className="top-bar">
      {/* ── Symbol ─────────────────────────────────────────────── */}
      <MenuButton
        name="symbol"
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        className="tb-btn tb-symbol"
        title="Symbol search"
        menu={(closeMenu) => <SymbolSearch onPick={setSymbol} onClose={closeMenu} />}
      >
        <Search size={15} className="symbol-icon" />
        {symbol}
      </MenuButton>

      <div className="tb-divider" />

      {/* ── Interval ───────────────────────────────────────────── */}
      {QUICK_TIMEFRAMES.map((id) => {
        const t = getTimeframeMeta(id);
        return (
          <button
            key={id}
            className={`tb-btn tb-tf ${timeframe === id ? 'active' : ''}`}
            onClick={() => setTimeframe(id)}
            disabled={isLoading}
            title={t.long}
          >
            {t.label}
          </button>
        );
      })}
      <MenuButton
        name="tf"
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        className={`tb-btn icon-only ${
          QUICK_TIMEFRAMES.includes(timeframe) ? '' : 'active'
        }`}
        title="More intervals"
        menu={(closeMenu) =>
          TIMEFRAME_GROUPS.map((g) => (
            <div key={g.group}>
              <div className="popup-label">{g.group}</div>
              {g.items.map((t) => (
                <button
                  key={t.id}
                  className={`popup-item ${timeframe === t.id ? 'active' : ''}`}
                  onClick={() => {
                    setTimeframe(t.id);
                    closeMenu();
                  }}
                >
                  {t.long}
                  {timeframe === t.id && <Check size={14} className="item-check" />}
                </button>
              ))}
            </div>
          ))
        }
      >
        {QUICK_TIMEFRAMES.includes(timeframe) ? (
          <ChevronDown size={14} className="caret" />
        ) : (
          <span style={{ fontWeight: 600 }}>{tfMeta.label}</span>
        )}
      </MenuButton>

      <div className="tb-divider" />

      {/* ── Chart type ─────────────────────────────────────────── */}
      <MenuButton
        name="chartType"
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        className="tb-btn"
        title="Chart style"
        menu={(closeMenu) =>
          CHART_TYPES.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                className={`popup-item ${chartType === c.id ? 'active' : ''}`}
                onClick={() => {
                  setChartType(c.id);
                  closeMenu();
                }}
              >
                <Icon size={16} />
                {c.label}
                {chartType === c.id && <Check size={14} className="item-check" />}
              </button>
            );
          })
        }
      >
        <ChartIcon size={17} />
        <ChevronDown size={13} className="caret" />
      </MenuButton>

      <div className="tb-divider" />

      {/* ── Indicators & replay ────────────────────────────────── */}
      <button className="tb-btn" onClick={onIndicatorsClick} title="Indicators">
        <span style={{ fontSize: 15, fontStyle: 'italic', fontWeight: 600 }}>fx</span>
        Indicators
      </button>

      <button
        className={`tb-btn btn-replay ${isReplayMode ? 'active' : ''}`}
        onClick={isReplayMode ? exitReplay : startReplay}
        disabled={isLoading}
        title={isReplayMode ? 'Exit bar replay' : 'Bar replay'}
      >
        <Rewind size={16} />
        Replay
      </button>

      <div className="tb-divider" />

      {/* ── Trading ────────────────────────────────────────────── */}
      <button className="tb-btn btn-accent" onClick={onTradeClick} title="New order (T)">
        <Wallet size={15} />
        Trade
      </button>
      <button className="tb-btn" onClick={onPositionsClick} title="Positions (P)">
        <List size={15} />
        Positions
      </button>

      <div className="tb-spacer" />

      {/* ── Last price ─────────────────────────────────────────── */}
      {priceInfo?.price > 0 && (
        <div className="tb-live-price">
          <span className="price-value" style={{ color: up ? 'var(--up-color)' : 'var(--down-color)' }}>
            {priceInfo.price.toLocaleString(undefined, {
              minimumFractionDigits: symbolMeta.digits,
              maximumFractionDigits: symbolMeta.digits,
            })}
          </span>
          <span className="price-change" style={{ color: up ? 'var(--up-color)' : 'var(--down-color)' }}>
            {up ? '+' : ''}
            {priceInfo.change.toFixed(symbolMeta.digits)} ({up ? '+' : ''}
            {priceInfo.changePct.toFixed(2)}%)
          </span>
        </div>
      )}

      {isLoading && <div className="tb-loading" />}

      {/* ── Chart settings ─────────────────────────────────────── */}
      <button className="tb-btn icon-only" onClick={onScreenshot} title="Take a snapshot">
        <Camera size={16} />
      </button>

      <MenuButton
        name="settings"
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        className="tb-btn icon-only"
        title="Chart settings"
        align="right"
        menu={
          <>
            <div className="popup-label">Chart</div>
            <button
              className="popup-item"
              onClick={() => setCrosshairEnabled(!crosshairEnabled)}
            >
              <Crosshair size={15} />
              Crosshair
              {crosshairEnabled && <Check size={14} className="item-check" />}
            </button>
          </>
        }
      >
        <Settings size={16} />
      </MenuButton>

      <div className="tb-divider" />

      {/* ── Account ────────────────────────────────────────────── */}
      <MenuButton
        name="user"
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        className="tb-btn tb-user"
        align="right"
        menu={(closeMenu) => (
          <>
            <div className="popup-label">{session?.username}</div>
            <button
              className="popup-item"
              onClick={() => {
                session?.resetAccount();
                closeMenu();
              }}
            >
              <RotateCcw size={15} />
              Reset account
            </button>
            <div className="popup-divider" />
            <button
              className="popup-item danger"
              onClick={() => {
                session?.logout();
                closeMenu();
              }}
            >
              <LogOut size={15} />
              Sign out
            </button>
          </>
        )}
      >
        <span className="tb-avatar">{session?.username?.[0] || '?'}</span>
        {session?.username}
        <ChevronDown size={13} className="caret" />
      </MenuButton>
    </div>
  );
}
