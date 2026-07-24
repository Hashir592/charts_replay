import React from 'react';
import {
  MousePointer2,
  Minus,
  TrendingUp,
  ArrowRight,
  MoveUpRight,
  Activity,
  TrendingDown,
  AlignJustify,
  Triangle,
  Square,
  ArrowUpToLine,
  ArrowDownToLine,
  Pencil,
  Trash2,
} from 'lucide-react';

/**
 * Groups mirror TradingView's left rail: cursor, lines, Fibonacci, geometric
 * shapes, projection tools, freehand — then the destructive action pinned to
 * the bottom.
 */
const GROUPS = [
  [{ tool: 'cursor', icon: MousePointer2, title: 'Cursor', shortcut: 'Esc' }],
  [
    { tool: 'trend_line', icon: TrendingUp, title: 'Trend line', shortcut: 'Alt+T' },
    { tool: 'horizontal_line', icon: Minus, title: 'Horizontal line', shortcut: 'Alt+H' },
    { tool: 'ray', icon: ArrowRight, title: 'Ray' },
    { tool: 'extended_line', icon: MoveUpRight, title: 'Extended line' },
  ],
  [
    { tool: 'fib_retracement', icon: Activity, title: 'Fib retracement', shortcut: 'Alt+F' },
    { tool: 'fib_extension', icon: TrendingDown, title: 'Fib extension' },
    { tool: 'fib_channel', icon: AlignJustify, title: 'Fib channel' },
  ],
  [
    { tool: 'rectangle', icon: Square, title: 'Rectangle', shortcut: 'Alt+R' },
    { tool: 'triangle', icon: Triangle, title: 'Triangle' },
  ],
  [
    { tool: 'long_position', icon: ArrowUpToLine, title: 'Long position' },
    { tool: 'short_position', icon: ArrowDownToLine, title: 'Short position' },
  ],
  [{ tool: 'path', icon: Pencil, title: 'Brush' }],
];

function ToolButton({ tool, icon: Icon, title, shortcut, activeTool, setActiveTool }) {
  return (
    <button
      className={`tool-btn ${activeTool === tool ? 'active' : ''}`}
      onClick={() => setActiveTool(tool)}
      aria-label={title}
    >
      <Icon size={18} />
      <span className="tool-tip">
        {title}
        {shortcut && <kbd>{shortcut}</kbd>}
      </span>
    </button>
  );
}

export default function DrawingToolbar({ activeTool, setActiveTool, clearDrawings }) {
  return (
    <div className="drawing-toolbar">
      {GROUPS.map((group, i) => (
        <React.Fragment key={group[0].tool}>
          {i > 0 && <div className="tool-divider" />}
          <div className="tool-section">
            {group.map((t) => (
              <ToolButton
                key={t.tool}
                {...t}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
              />
            ))}
          </div>
        </React.Fragment>
      ))}

      <div className="tool-spacer" />
      <div className="tool-divider" />
      <div className="tool-section">
        <button
          className="tool-btn danger"
          onClick={clearDrawings}
          aria-label="Remove drawings"
        >
          <Trash2 size={18} />
          <span className="tool-tip">Remove drawings</span>
        </button>
      </div>
    </div>
  );
}
