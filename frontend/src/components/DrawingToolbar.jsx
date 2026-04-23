import React from 'react';
import { 
  MousePointer2, 
  Minus, 
  TrendingUp, 
  Activity, 
  TrendingDown, 
  AlignJustify,
  Triangle,
  Square,
  ArrowUpToLine,
  ArrowDownToLine,
  Pencil,
  Trash2
} from 'lucide-react';

export default function DrawingToolbar({ activeTool, setActiveTool, clearDrawings }) {
  const ToolButton = ({ tool, icon: Icon, title }) => (
    <button 
      className={`tool-btn ${activeTool === tool ? 'active' : ''}`}
      onClick={() => setActiveTool(tool)}
      title={title}
    >
      <Icon size={18} />
    </button>
  );

  return (
    <div className="drawing-toolbar">
      <div className="tool-section">
        <ToolButton tool="cursor" icon={MousePointer2} title="Cursor" />
      </div>
      
      <div className="tool-divider" />
      <div className="tool-section">
        <ToolButton tool="horizontal_line" icon={Minus} title="Horizontal Line" />
        <ToolButton tool="trend_line" icon={TrendingUp} title="Trend Line" />
      </div>

      <div className="tool-divider" />
      <div className="tool-section">
        <ToolButton tool="fib_retracement" icon={Activity} title="Fib Retracement" />
        <ToolButton tool="fib_extension" icon={TrendingDown} title="Fib Extension" />
        <ToolButton tool="fib_channel" icon={AlignJustify} title="Fib Channel" />
      </div>

      <div className="tool-divider" />
      <div className="tool-section">
        <ToolButton tool="triangle" icon={Triangle} title="Triangle" />
        <ToolButton tool="rectangle" icon={Square} title="Rectangle" />
      </div>

      <div className="tool-divider" />
      <div className="tool-section">
        <ToolButton tool="long_position" icon={ArrowUpToLine} title="Long Position" />
        <ToolButton tool="short_position" icon={ArrowDownToLine} title="Short Position" />
      </div>

      <div className="tool-divider" />
      <div className="tool-section">
        <ToolButton tool="path" icon={Pencil} title="Path" />
      </div>

      <div className="tool-spacer" />
      <div className="tool-section">
        <button className="tool-btn danger" onClick={clearDrawings} title="Clear All Drawings">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
