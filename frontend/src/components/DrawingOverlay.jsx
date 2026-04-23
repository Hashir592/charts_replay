import React, { useRef, useEffect, useState } from 'react';
import { TOOL_CONFIGS, renderDrawing, isPointNearDrawing } from '../utils/drawingEngine';

export default function DrawingOverlay({ 
  mainChart, 
  candleSeries, 
  drawings, 
  setDrawings, 
  activeTool, 
  setActiveTool,
  selectedDrawingId,
  setSelectedDrawingId
}) {
  const canvasRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [tempPoints, setTempPoints] = useState([]);
  const [mousePos, setMousePos] = useState(null);

  useEffect(() => {
    if (!mainChart || !candleSeries) return;
    
    // Sync canvas size
    const resizeCanvas = () => {
      const container = canvasRef.current.parentElement;
      canvasRef.current.width = container.clientWidth;
      canvasRef.current.height = container.clientHeight;
      draw();
    };
    
    const timeScale = mainChart.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(draw);
    window.addEventListener('resize', resizeCanvas);
    
    setTimeout(resizeCanvas, 100);
    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(draw);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [mainChart, candleSeries, drawings, tempPoints, mousePos, activeTool, hoveredId, selectedDrawingId]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !mainChart || !candleSeries) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const coordSys = {
      width: canvas.width,
      height: canvas.height,
      timeToCoordinate: (t) => mainChart.timeScale().timeToCoordinate(t),
      priceToCoordinate: (p) => candleSeries.priceToCoordinate(p)
    };

    // Render all saved drawings
    drawings.forEach(d => {
      renderDrawing(ctx, d, coordSys, d.id === selectedDrawingId, d.id === hoveredId);
    });

    // Render active temporary drawing
    if (activeTool !== 'cursor' && tempPoints.length > 0 && mousePos) {
      const tempDrawing = {
        type: activeTool,
        points: [...tempPoints, { time: mousePos.time, price: mousePos.price }],
        settings: {} // default temp settings
      };
      renderDrawing(ctx, tempDrawing, coordSys, false, false);
    }
  };

  const getChartCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const time = mainChart.timeScale().coordinateToTime(x);
    const price = candleSeries.coordinateToPrice(y);
    return { x, y, time, price };
  };

  const handleMouseMove = (e) => {
    const coords = getChartCoords(e);
    if (!coords.time || coords.price === null) return;
    setMousePos(coords);

    if (activeTool === 'cursor') {
      const coordSys = {
        timeToCoordinate: (t) => mainChart.timeScale().timeToCoordinate(t),
        priceToCoordinate: (p) => candleSeries.priceToCoordinate(p)
      };
      const found = drawings.find(d => isPointNearDrawing(coords.x, coords.y, d, coordSys));
      setHoveredId(found ? found.id : null);
    }
  };

  const handleClick = (e) => {
    const coords = getChartCoords(e);
    if (!coords.time || coords.price === null) return;

    if (activeTool === 'cursor') {
      if (hoveredId) setSelectedDrawingId(hoveredId);
      else setSelectedDrawingId(null);
      return;
    }

    const config = TOOL_CONFIGS[activeTool];
    const newPoints = [...tempPoints, { time: coords.time, price: coords.price }];
    
    if (newPoints.length === config.points || (activeTool === 'path' && e.detail === 2)) {
      // Finish drawing
      const newDrawing = {
        id: Date.now().toString(),
        type: activeTool,
        points: newPoints,
        settings: {} 
      };
      setDrawings([...drawings, newDrawing]);
      setTempPoints([]);
      if (activeTool !== 'path') {
        setActiveTool('cursor');
      }
    } else {
      setTempPoints(newPoints);
    }
  };

  const handleDoubleClick = (e) => {
    if (activeTool === 'path' && tempPoints.length > 0) {
      const newDrawing = {
        id: Date.now().toString(),
        type: activeTool,
        points: tempPoints,
        settings: {}
      };
      setDrawings([...drawings, newDrawing]);
      setTempPoints([]);
      setActiveTool('cursor');
    }
  };

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveTool('cursor');
        setTempPoints([]);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDrawingId) {
          setDrawings(prev => prev.filter(d => d.id !== selectedDrawingId));
          setSelectedDrawingId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDrawingId, activeTool, setDrawings, setActiveTool, setSelectedDrawingId]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: activeTool === 'cursor' && !hoveredId ? 'none' : 'auto',
        zIndex: 10
      }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseLeave={() => setMousePos(null)}
    />
  );
}
