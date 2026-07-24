import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TOOL_CONFIGS, renderDrawing, isPointNearDrawing, createDefaultSettings } from '../utils/drawingEngine';

/**
 * Helper: find the Lightweight Charts canvas inside the container.
 * We must skip our own overlay canvas (identified by data-overlay attribute).
 * LW Charts creates one or more <canvas> elements; we want the first one that ISN'T ours.
 */
function findLWCanvas(container) {
  if (!container) return null;
  const allCanvases = container.querySelectorAll('canvas');
  for (const c of allCanvases) {
    if (!c.dataset.overlay) return c;
  }
  return null;
}

export default function DrawingOverlay({ 
  mainChart, 
  candleSeries, 
  drawings, 
  setDrawings, 
  activeTool, 
  setActiveTool,
  selectedDrawingId,
  setSelectedDrawingId,
  data
}) {
  const canvasRef = useRef(null);
  const drawRef = useRef(null);
  const rafRef = useRef(null);
  
  const [hoveredId, setHoveredId] = useState(null);
  const [tempPoints, setTempPoints] = useState([]);
  
  // State Machine: IDLE | HOVERING | SELECTED | DRAGGING_HANDLE | DRAGGING_OBJECT | PLACING
  const [interactionState, setInteractionState] = useState('IDLE');
  const [dragContext, setDragContext] = useState(null);

  // Stable ref for latest state — event handlers read from this instead of stale closures
  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = { interactionState, activeTool, tempPoints, drawings, selectedDrawingId, dragContext, hoveredId };
  }, [interactionState, activeTool, tempPoints, drawings, selectedDrawingId, dragContext, hoveredId]);

  // rAF-batched draw scheduler for pointer handlers (avoid 200+ draws/sec during fast mouse moves)
  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawRef.current?.();
    });
  }, []);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // ─── Coordinate system: returns CSS-pixel dimensions ───
  const getCoordSys = useCallback(() => {
    if (!canvasRef.current || !mainChart || !candleSeries) return null;
    const dpr = window.devicePixelRatio || 1;
    return {
      width:  canvasRef.current.width  / dpr,
      height: canvasRef.current.height / dpr,
      timeToCoordinate:    (t) => mainChart.timeScale().timeToCoordinate(t),
      logicalToCoordinate: (l) => mainChart.timeScale().logicalToCoordinate(l),
      priceToCoordinate:   (p) => candleSeries.priceToCoordinate(p)
    };
  }, [mainChart, candleSeries]);

  // ─── draw() reads ALL state from stateRef — never from React closure ───
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mainChart || !candleSeries) return;

    const {
      drawings: currentDrawings, tempPoints: currentTempPoints, activeTool: currentActiveTool,
      selectedDrawingId: currentSelectedId, hoveredId: currentHoveredId, mouseCoords
    } = stateRef.current;

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const coordSys = getCoordSys();
    if (!coordSys) return;

    (currentDrawings || []).forEach(d => {
      renderDrawing(ctx, d, coordSys, d.id === currentSelectedId, d.id === currentHoveredId);
    });

    if (currentActiveTool !== 'cursor' && currentTempPoints && currentTempPoints.length > 0 && mouseCoords) {
      const tempDrawing = {
        type: currentActiveTool,
        points: [...currentTempPoints, {
          time: mouseCoords.time,
          logical: mouseCoords.logical,
          price: mouseCoords.price
        }],
        settings: createDefaultSettings(currentActiveTool)
      };
      renderDrawing(ctx, tempDrawing, coordSys, false, false);
    }
  }, [mainChart, candleSeries, getCoordSys]);

  // Always keep drawRef pointing to latest draw
  drawRef.current = draw;

  // ─── Sync logical indexes when data changes ───
  useEffect(() => {
    if (!mainChart || !data || !data.candles || data.candles.length === 0 || drawings.length === 0) return;

    const timeScale = mainChart.timeScale();
    let changed = false;
    const newDrawings = drawings.map(d => {
      const newPoints = d.points.map(p => {
        // A point dropped past the last bar has no time — coordinateToTime()
        // returns null out there, so it stays anchored by `logical` alone.
        // timeToCoordinate(null) throws inside Lightweight Charts, and an
        // exception here unmounts the whole app; the drawing is persisted, so
        // every reload would crash again. Skip those points instead.
        if (p.time == null) return p;

        let coord = null;
        try {
          coord = timeScale.timeToCoordinate(p.time);
        } catch {
          // Malformed timestamp from an older save — leave the point alone.
          return p;
        }
        if (coord === null) return p;

        const logical = timeScale.coordinateToLogical(coord);
        if (logical !== null && p.logical !== logical) {
          changed = true;
          return { ...p, logical };
        }
        return p;
      });
      return { ...d, points: newPoints };
    });

    if (changed) {
      setDrawings(newDrawings);
    }
    drawRef.current?.();
  }, [data, mainChart]);

  // ─── Subscribe to scroll/resize — minimal deps, runs only when chart instance changes ───
  useEffect(() => {
    if (!mainChart || !candleSeries) return;
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    const resizeCanvas = () => {
      if (!canvasRef.current) return;
      const dpr = window.devicePixelRatio || 1;
      const lwCanvas = findLWCanvas(container);
      if (lwCanvas) {
        const lr = lwCanvas.getBoundingClientRect();
        const cr = container.getBoundingClientRect();
        canvasRef.current.style.left   = (lr.left - cr.left) + 'px';
        canvasRef.current.style.top    = (lr.top  - cr.top)  + 'px';
        canvasRef.current.style.width  = lr.width  + 'px';
        canvasRef.current.style.height = lr.height + 'px';
        canvasRef.current.width  = lr.width  * dpr;
        canvasRef.current.height = lr.height * dpr;
      } else {
        canvasRef.current.style.left   = '0px';
        canvasRef.current.style.top    = '0px';
        canvasRef.current.style.width  = container.clientWidth  + 'px';
        canvasRef.current.style.height = container.clientHeight + 'px';
        canvasRef.current.width  = container.clientWidth  * dpr;
        canvasRef.current.height = container.clientHeight * dpr;
      }
      drawRef.current?.();
    };
    
    const timeScale = mainChart.timeScale();
    const onRangeChange = () => drawRef.current?.();
    timeScale.subscribeVisibleLogicalRangeChange(onRangeChange);
    window.addEventListener('resize', resizeCanvas);
    
    // LW Charts needs time to mount its canvas; retry resize a few times
    setTimeout(resizeCanvas, 50);
    setTimeout(resizeCanvas, 200);
    setTimeout(resizeCanvas, 500);

    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(onRangeChange);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [mainChart, candleSeries]);

  // ─── Redraw when any visual state changes ───
  useEffect(() => {
    drawRef.current?.();
  }, [drawings, tempPoints, selectedDrawingId, hoveredId, activeTool, interactionState]);

  // ─── Sync tool state → interaction state ───
  useEffect(() => {
    if (activeTool !== 'cursor') {
      if (interactionState !== 'PLACING') {
        setInteractionState('PLACING');
        setSelectedDrawingId(null);
      }
    } else {
      if (interactionState === 'PLACING') {
        setInteractionState(selectedDrawingId ? 'SELECTED' : 'IDLE');
      }
    }
  }, [activeTool]);

  // ─── Event interception (capture phase on container) ───
  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (!container || !mainChart || !candleSeries) return;

    /**
     * CRITICAL FIX: getCoords must use the LW Charts canvas rect (not our overlay, not the container).
     * container.querySelector('canvas') would find our overlay canvas first in DOM order.
     * We use findLWCanvas() which skips data-overlay canvases.
     */
    const getCoords = (e) => {
      const lwCanvas = findLWCanvas(container);
      const rect = lwCanvas
        ? lwCanvas.getBoundingClientRect()
        : container.getBoundingClientRect();

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const timeScale = mainChart.timeScale();
      return {
        x, y,
        time:    timeScale.coordinateToTime(x),
        logical: timeScale.coordinateToLogical(x),
        price:   candleSeries.coordinateToPrice(y)
      };
    };

    const hitTest = (coords, currentDrawings) => {
      if (!coords || coords.price === null) return null;
      const coordSys = getCoordSys();
      if (!coordSys) return null;
      
      for (let i = currentDrawings.length - 1; i >= 0; i--) {
        const d = currentDrawings[i];
        const res = isPointNearDrawing(coords.x, coords.y, d, coordSys);
        if (res.hit) return { drawing: d, handleIndex: res.handleIndex };
      }
      return null;
    };

    const handlePointerDown = (e) => {
      // Don't intercept clicks on the settings panel UI
      if (e.target.closest('[data-settings-panel]')) return;

      const state = stateRef.current;
      const coords = getCoords(e);
      
      // Guard: need at least one valid axis
      if (coords.logical == null && coords.price == null) return;

      // PLACING mode — also handle the React state sync gap where activeTool
      // updates before interactionState catches up via useEffect
      const isPlacing = state.interactionState === 'PLACING' ||
                        (state.activeTool !== 'cursor' && TOOL_CONFIGS[state.activeTool]);

      if (isPlacing) {
        // For placing we need price + at least logical for x-axis (time can be null in future)
        if (coords.price == null || coords.logical == null) return;
        
        e.stopPropagation();
        e.preventDefault();

        const tool = state.activeTool;

        // Path: double-click finishes with existing points (don't add the dblclick point)
        if (tool === 'path' && e.detail === 2) {
          if (state.tempPoints.length > 1) {
            const newDrawing = {
              id: Date.now().toString(),
              type: 'path',
              points: state.tempPoints,
              settings: createDefaultSettings('path')
            };
            setDrawings([...state.drawings, newDrawing]);
          }
          setTempPoints([]);
          return;
        }

        const config = TOOL_CONFIGS[tool];
        if (!config) return;
        
        const newPoints = [...state.tempPoints, { time: coords.time, logical: coords.logical, price: coords.price }];
        
        if (newPoints.length === config.points) {
          // Tool complete — commit drawing
          const newDrawing = {
            id: Date.now().toString(),
            type: tool,
            points: newPoints,
            settings: createDefaultSettings(tool) 
          };
          setDrawings([...state.drawings, newDrawing]);
          setTempPoints([]);
          if (tool !== 'path') setActiveTool('cursor');
        } else {
          // Still need more points — accumulate
          setTempPoints(newPoints);
        }
        return;
      }

      // ─── Not placing — TradingView-style select-then-drag model ───
      const hit = hitTest(coords, state.drawings);
      if (hit) {
        if (hit.drawing.id === state.selectedDrawingId) {
          // Already selected → start drag, block chart pan
          e.stopPropagation();
          e.preventDefault();
          setDragContext({
            drawingId: hit.drawing.id,
            handleIndex: hit.handleIndex,
            startMouse: coords,
            startPoints: JSON.parse(JSON.stringify(hit.drawing.points)),
            startSettings: JSON.parse(JSON.stringify(hit.drawing.settings || {}))
          });
          setInteractionState(hit.handleIndex >= 0 ? 'DRAGGING_HANDLE' : 'DRAGGING_OBJECT');
        } else {
          // Different drawing → just select it, let chart still pan
          setSelectedDrawingId(hit.drawing.id);
          setInteractionState('SELECTED');
        }
      } else {
        // Clicked empty space — deselect and let LW Charts handle pan
        if (state.selectedDrawingId) setSelectedDrawingId(null);
        if (state.interactionState !== 'IDLE') setInteractionState('IDLE');
      }
    };

    const handlePointerMove = (e) => {
      // Don't intercept moves on the settings panel UI
      if (e.target.closest('[data-settings-panel]')) return;

      const state = stateRef.current;
      const coords = getCoords(e);
      if (coords.logical == null && coords.price == null) return;
      
      stateRef.current.mouseCoords = coords;

      if (state.interactionState === 'DRAGGING_HANDLE' || state.interactionState === 'DRAGGING_OBJECT') {
        if (coords.price == null) return; // need at least price for dragging
        e.stopPropagation();
        e.preventDefault();
        
        const dc = state.dragContext;
        if (!dc) return;
        const drawing = state.drawings.find(d => d.id === dc.drawingId);
        if (!drawing) return;

        // ─── Special drag logic for long/short position ───
        if (drawing.type === 'long_position' || drawing.type === 'short_position') {
          const isLong = drawing.type === 'long_position';
          const startEntry = dc.startSettings.entryPrice ?? drawing.points[0].price;
          const startTP = dc.startSettings.targetPrice ?? (isLong ? startEntry * 1.04 : startEntry * 0.96);
          const startSL = dc.startSettings.stopPrice ?? (isLong ? startEntry * 0.98 : startEntry * 1.02);
          const deltaPrice = coords.price - dc.startMouse.price;

          const newSettings = { ...dc.startSettings };
          if (dc.handleIndex === 1) {
            // Drag TP only
            newSettings.targetPrice = startTP + deltaPrice;
          } else if (dc.handleIndex === 2) {
            // Drag SL only
            newSettings.stopPrice = startSL + deltaPrice;
          } else {
            // Drag entry or body — move all 3
            newSettings.entryPrice = startEntry + deltaPrice;
            newSettings.targetPrice = startTP + deltaPrice;
            newSettings.stopPrice = startSL + deltaPrice;
          }

          // Also update the anchor point's price for body drag
          let newPoints = dc.startPoints;
          if (dc.handleIndex <= 0) {
            const deltaLogical = (dc.startMouse.logical != null && coords.logical != null)
              ? (coords.logical - dc.startMouse.logical) : 0;
            newPoints = dc.startPoints.map(p => {
              const baseLogical = p.logical ?? 0;
              const newLogical = baseLogical + deltaLogical;
              const timeScale = mainChart.timeScale();
              const coordX = timeScale.logicalToCoordinate(newLogical);
              let newTime = p.time;
              if (coordX !== null) {
                const t = timeScale.coordinateToTime(coordX);
                if (t !== null) newTime = t;
              }
              return { ...p, logical: newLogical, price: p.price + deltaPrice, time: newTime };
            });
          }

          setDrawings(prev => prev.map(d => d.id === drawing.id ? { ...d, points: newPoints, settings: newSettings } : d));
          scheduleDraw();
          return;
        }

        // ─── Generic drag logic for all other tools ───
        const newSettings = { ...dc.startSettings };

        const newPoints = dc.startPoints.map((p, i) => {
          if (state.interactionState === 'DRAGGING_HANDLE') {
            if (i === dc.handleIndex) {
              return { ...p, time: coords.time, logical: coords.logical, price: coords.price };
            }
            return p;
          } else {
            const deltaLogical = (dc.startMouse.logical != null && coords.logical != null)
              ? (coords.logical - dc.startMouse.logical) : 0;
            const deltaPrice = coords.price - dc.startMouse.price;

            const baseLogical = p.logical ?? 0;
            const newLogical = baseLogical + deltaLogical;
            const timeScale = mainChart.timeScale();
            const coordX = timeScale.logicalToCoordinate(newLogical);
            let newTime = p.time;
            if (coordX !== null) {
              const t = timeScale.coordinateToTime(coordX);
              if (t !== null) newTime = t;
            }
            return { ...p, logical: newLogical, price: p.price + deltaPrice, time: newTime };
          }
        });

        setDrawings(prev => prev.map(d => d.id === drawing.id ? { ...d, points: newPoints, settings: newSettings } : d));
        scheduleDraw();
        return;
      }

      // Hover detection (only in idle/hovering/selected states)
      if (state.interactionState === 'IDLE' || state.interactionState === 'HOVERING' || state.interactionState === 'SELECTED') {
        const hit = hitTest(coords, state.drawings);
        if (hit && state.interactionState !== 'SELECTED') {
          if (state.hoveredId !== hit.drawing.id) setHoveredId(hit.drawing.id);
          if (state.interactionState === 'IDLE') setInteractionState('HOVERING');
        } else if (!hit) {
          if (state.hoveredId !== null) setHoveredId(null);
          if (state.interactionState === 'HOVERING') setInteractionState('IDLE');
        }
      }
      
      // Preview ghost line while placing
      if (state.interactionState === 'PLACING') {
        scheduleDraw();
      }
    };

    const handlePointerUp = (e) => {
      const state = stateRef.current;
      if (state.interactionState === 'DRAGGING_HANDLE' || state.interactionState === 'DRAGGING_OBJECT') {
        e.stopPropagation();
        e.preventDefault();
        setInteractionState('SELECTED');
        setDragContext(null);
      }
    };

    // Capture phase: we see events before LW Charts does
    container.addEventListener('pointerdown', handlePointerDown, { capture: true });
    container.addEventListener('pointermove', handlePointerMove, { capture: true });
    container.addEventListener('pointerup', handlePointerUp, { capture: true });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      container.removeEventListener('pointermove', handlePointerMove, { capture: true });
      container.removeEventListener('pointerup', handlePointerUp, { capture: true });
    };
  }, [mainChart, candleSeries, setDrawings, setActiveTool, setSelectedDrawingId, getCoordSys, scheduleDraw]);


  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      
      if (e.key === 'Escape') {
        if (activeTool !== 'cursor') {
          setActiveTool('cursor');
          setTempPoints([]);
        }
        setSelectedDrawingId(null);
        setInteractionState('IDLE');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDrawingId) {
          setDrawings(prev => prev.filter(d => d.id !== selectedDrawingId));
          setSelectedDrawingId(null);
          setInteractionState('IDLE');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDrawingId, activeTool, setDrawings, setActiveTool, setSelectedDrawingId]);


  // ─── Settings panel helpers ───
  const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);
  
  const updateSetting = (key, value) => {
    setDrawings(prev => prev.map(d => d.id === selectedDrawingId ? { ...d, settings: { ...d.settings, [key]: value } } : d));
  };

  const updateFibLevel = (level, checked) => {
    setDrawings(prev => prev.map(d => {
      if (d.id === selectedDrawingId) {
        const vis = d.settings.levelVisibility || {};
        return { ...d, settings: { ...d.settings, levelVisibility: { ...vis, [level]: checked } } };
      }
      return d;
    }));
  };

  const addFibLevel = (level) => {
    setDrawings(prev => prev.map(d => {
      if (d.id !== selectedDrawingId) return d;
      const levels = [...(d.settings.levels || []), level].sort((a, b) => a - b);
      return { ...d, settings: { ...d.settings, levels } };
    }));
  };

  const removeFibLevel = (level) => {
    setDrawings(prev => prev.map(d => {
      if (d.id !== selectedDrawingId) return d;
      const levels = (d.settings.levels || []).filter(l => l !== level);
      return { ...d, settings: { ...d.settings, levels } };
    }));
  };

  const handleDelete = () => {
    if (selectedDrawingId) {
      setDrawings(prev => prev.filter(d => d.id !== selectedDrawingId));
      setSelectedDrawingId(null);
      setInteractionState('IDLE');
    }
  };

  return (
    <>
      {/* data-overlay marks this as OUR canvas so findLWCanvas() skips it */}
      <canvas
        ref={canvasRef}
        data-overlay="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 10
        }}
      />
      
      {/* Settings Panel */}
      {selectedDrawing && interactionState !== 'DRAGGING_HANDLE' && interactionState !== 'DRAGGING_OBJECT' && (
        <div data-settings-panel="true" style={{
          position: 'absolute',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1E222D',
          border: '1px solid #2B2B43',
          borderRadius: 8,
          padding: '8px 12px',
          display: 'flex',
          gap: 16,
          zIndex: 20,
          color: '#D1D4DC',
          alignItems: 'center',
          fontSize: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          pointerEvents: 'auto'
        }}>
          <button onClick={handleDelete} style={{ background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer', padding: '0 4px', fontSize: 16 }} title="Delete">
            🗑
          </button>
          
          <div style={{ width: '1px', height: '20px', background: '#2B2B43' }}></div>

          <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
            <label>Color</label>
            <input type="color" value={selectedDrawing.settings.color || '#2962FF'} onChange={(e) => updateSetting('color', e.target.value)} style={{cursor: 'pointer', padding: 0, width: 24, height: 24, border: 'none', background: 'none'}} />
          </div>
          
          <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
            <label>Width</label>
            <select value={selectedDrawing.settings.lineWidth || 2} onChange={(e) => updateSetting('lineWidth', parseInt(e.target.value))} style={{background: '#2B2B43', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 4px'}}>
              <option value={1}>1px</option>
              <option value={2}>2px</option>
              <option value={3}>3px</option>
              <option value={4}>4px</option>
            </select>
          </div>

          {(selectedDrawing.type.includes('fib_') || selectedDrawing.type === 'rectangle' || selectedDrawing.type === 'triangle') && (
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <label>Fill</label>
              <input type="range" min="0" max="1" step="0.1" value={selectedDrawing.settings.fillOpacity ?? 0.2} onChange={(e) => updateSetting('fillOpacity', parseFloat(e.target.value))} style={{width: 60}} />
            </div>
          )}

          {selectedDrawing.type.includes('fib_') && (
             <div style={{display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap'}}>
               <label>Levels</label>
               {(selectedDrawing.settings.levels || []).map(l => (
                 <label key={l} style={{display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer'}}>
                   <input type="checkbox" checked={selectedDrawing.settings.levelVisibility?.[l] !== false} onChange={(e) => updateFibLevel(l, e.target.checked)} />
                   {l}
                   <button
                     onClick={() => removeFibLevel(l)}
                     style={{background:'none', border:'none', color:'#ef5350', cursor:'pointer', fontSize:10, padding:'0 2px'}}
                   >✕</button>
                 </label>
               ))}
               <input
                 type="number"
                 placeholder="Add"
                 step="0.001"
                 style={{width: 60, background: '#2B2B43', color: '#fff', border: 'none', padding: '2px 4px', borderRadius: 4}}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                     const val = parseFloat(e.target.value);
                     if (!isNaN(val)) {
                       addFibLevel(val);
                       e.target.value = '';
                     }
                   }
                 }}
               />
             </div>
          )}

          {(selectedDrawing.type === 'long_position' || selectedDrawing.type === 'short_position') && (
            <>
              <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
                <label>Entry</label>
                <input type="number" value={selectedDrawing.settings.entryPrice ?? selectedDrawing.points[0].price.toFixed(2)} onChange={(e) => updateSetting('entryPrice', parseFloat(e.target.value))} style={{width: 60, background: '#2B2B43', color: '#fff', border: 'none', padding: 2}} />
              </div>
              <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
                <label>Target</label>
                <input type="number" value={selectedDrawing.settings.targetPrice ?? (selectedDrawing.type === 'long_position' ? (selectedDrawing.points[0].price * 1.04).toFixed(2) : (selectedDrawing.points[0].price * 0.96).toFixed(2))} onChange={(e) => updateSetting('targetPrice', parseFloat(e.target.value))} style={{width: 60, background: '#2B2B43', color: '#fff', border: 'none', padding: 2}} />
              </div>
              <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
                <label>Stop</label>
                <input type="number" value={selectedDrawing.settings.stopPrice ?? (selectedDrawing.type === 'long_position' ? (selectedDrawing.points[0].price * 0.98).toFixed(2) : (selectedDrawing.points[0].price * 1.02).toFixed(2))} onChange={(e) => updateSetting('stopPrice', parseFloat(e.target.value))} style={{width: 60, background: '#2B2B43', color: '#fff', border: 'none', padding: 2}} />
              </div>
            </>
          )}

        </div>
      )}
    </>
  );
}
