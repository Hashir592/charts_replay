export const TOOL_CONFIGS = {
  cursor: { name: 'Cursor', points: 0 },
  horizontal_line: { name: 'Horizontal Line', points: 1 },
  trend_line: { name: 'Trend Line', points: 2 },
  ray: { name: 'Ray', points: 2 },
  extended_line: { name: 'Extended Line', points: 2 },
  fib_retracement: { name: 'Fib Retracement', points: 2 },
  fib_extension: { name: 'Trend-Based Fib Extension', points: 3 },
  fib_channel: { name: 'Fib Channel', points: 3 },
  triangle: { name: 'Triangle', points: 3 },
  rectangle: { name: 'Rectangle', points: 2 },
  long_position: { name: 'Long Position', points: 1 },
  short_position: { name: 'Short Position', points: 1 },
  path: { name: 'Path', points: -1 }, // infinite
};

// Colors
export const DEFAULT_COLORS = {
  line: '#2962FF',
  text: '#ffffff',
  bg: 'rgba(41, 98, 255, 0.1)',
  fib: ['#787B86', '#F23645', '#FF9800', '#FFEB3B', '#4CAF50', '#00BCD4', '#9C27B0'],
  long: { border: '#4CAF50', bg: 'rgba(76, 175, 80, 0.2)' },
  short: { border: '#F23645', bg: 'rgba(242, 54, 69, 0.2)' },
};

export const createDefaultSettings = (type) => {
  const base = { color: DEFAULT_COLORS.line, lineWidth: 2 };
  if (type === 'trend_line') {
    return { ...base, extendLeft: false, extendRight: false };
  }
  if (type === 'ray') {
    return { ...base, extendLeft: false, extendRight: true };
  }
  if (type === 'extended_line') {
    return { ...base, extendLeft: true, extendRight: true };
  }
  if (type === 'fib_retracement' || type === 'fib_extension' || type === 'fib_channel') {
    return { ...base, levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618] };
  }
  if (type === 'rectangle' || type === 'triangle') {
    return { ...base, bgColor: DEFAULT_COLORS.bg };
  }
  if (type === 'long_position' || type === 'short_position') {
    return { ...base, stopLossPercent: 2, takeProfitPercent: 4 };
  }
  return base;
};

// Render logic
// Bug 8 fix: clamp to reasonable offscreen bounds, pass null through
const clampCoord = (val, max) => {
  if (val === null) return null;
  if (val < -500) return -500;
  if (val > max + 500) return max + 500;
  return val;
};

export const renderDrawing = (ctx, d, coordSys, isSelected, isHovered) => {
  if (d.points.length === 0) return;
  const { type, settings, points } = d;

  // Map to pixels
  // Bug 8 fix: track validity of each point for graceful skip rendering
  const pxs = points.map(p => {
    let x = null;
    if (p.time != null) {
      x = coordSys.timeToCoordinate(p.time);
    }
    if (x === null && p.logical != null) {
      x = coordSys.logicalToCoordinate(p.logical);
    }
    const y = coordSys.priceToCoordinate(p.price);
    
    return {
      x: clampCoord(x, coordSys.width),
      y: clampCoord(y, coordSys.height),
      valid: x !== null && y !== null
    };
  });

  // If any critical point is completely missing/unresolvable, don't render the whole drawing or handle gracefully
  // (We'll handle specific nulls in the switch)

  ctx.save();
  ctx.lineWidth = settings.lineWidth || 2;
  ctx.strokeStyle = isSelected ? '#fff' : (settings.color || DEFAULT_COLORS.line);
  ctx.fillStyle = settings.bgColor || DEFAULT_COLORS.bg;
  
  if (isSelected || isHovered) {
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.shadowBlur = 10;
  }

  const p1 = pxs[0];
  const p2 = pxs[1];
  const p3 = pxs[2];

  switch (type) {
    case 'horizontal_line':
      if (p1 && p1.y !== null) {
        ctx.beginPath();
        ctx.moveTo(0, p1.y);
        ctx.lineTo(coordSys.width, p1.y);
        ctx.stroke();
        
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillRect(coordSys.width - 60, p1.y - 12, 60, 24);
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.fillText(points[0].price.toFixed(2), coordSys.width - 55, p1.y + 4);
      }
      break;

    case 'trend_line':
      if (p1 && p2 && p1.x !== null && p1.y !== null && p2.x !== null && p2.y !== null) {
        // Just draw segment
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      } else if (p1 && p1.x !== null && p1.y !== null) {
        // Just a dot if drawing
        ctx.beginPath(); ctx.arc(p1.x, p1.y, 3, 0, Math.PI * 2); ctx.fill();
      }
      break;

    case 'ray':
    case 'extended_line': {
      if (p1 && p2 && p1.x !== null && p1.y !== null && p2.x !== null && p2.y !== null) {
        const extendLeft = settings.extendLeft ?? (type === 'extended_line');
        const extendRight = settings.extendRight ?? true;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        // Vertical
        if (Math.abs(dx) < 0.5) { // Bug 17: float-safe vertical check
          const x = p1.x;
          const y0 = extendLeft ? 0 : Math.min(p1.y, p2.y);
          const y1 = extendRight ? coordSys.height : Math.max(p1.y, p2.y);
          ctx.beginPath();
          ctx.moveTo(x, y0);
          ctx.lineTo(x, y1);
          ctx.stroke();
          break;
        }

        const slope = dy / dx;
        const b = p1.y - slope * p1.x;

        const leftX = 0;
        const rightX = coordSys.width;
        const leftY = slope * leftX + b;
        const rightY = slope * rightX + b;

        const start = extendLeft ? { x: leftX, y: leftY } : p1;
        const end = extendRight ? { x: rightX, y: rightY } : p2;

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      } else if (p1 && p1.x !== null && p1.y !== null) {
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'fib_retracement':
      if (p1 && p2 && p1.x !== null && p1.y !== null && p2.x !== null && p2.y !== null) {
        const levels = settings.levels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const minX = Math.min(p1.x, p2.x);
        const maxX = coordSys.width;
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        const diff = points[0].price - points[1].price;
        // Bug 13: explicit text color and font — never inherit from strokeStyle
        levels.forEach((l, i) => {
          if (settings.levelVisibility && settings.levelVisibility[l] === false) return;
          const price = points[0].price - diff * l;
          const y = clampCoord(coordSys.priceToCoordinate(price), coordSys.height);
          if (y === null) return;

          const fibColor = DEFAULT_COLORS.fib[i % DEFAULT_COLORS.fib.length];
          ctx.strokeStyle = fibColor;
          ctx.beginPath();
          ctx.moveTo(minX, y);
          ctx.lineTo(maxX, y);
          ctx.stroke();

          ctx.fillStyle = '#D1D4DC';
          ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillText(`${l} (${price.toFixed(2)})`, minX + 5, y - 4);
        });
        
        // Zone fill
        const fillOpacity = settings.fillOpacity !== undefined ? settings.fillOpacity : 0.2;
        if (fillOpacity > 0) {
          ctx.save();
          ctx.globalAlpha = fillOpacity;
          levels.forEach((l, i) => {
            if (i === 0) return;
            if (settings.levelVisibility && settings.levelVisibility[l] === false) return;
            const prevL = levels[i-1];
            if (settings.levelVisibility && settings.levelVisibility[prevL] === false) return;
            
            const price1 = points[0].price - diff * prevL;
            const price2 = points[0].price - diff * l;
            const y1 = clampCoord(coordSys.priceToCoordinate(price1), coordSys.height);
            const y2 = clampCoord(coordSys.priceToCoordinate(price2), coordSys.height);
            
            if (y1 !== null && y2 !== null) {
              ctx.fillStyle = DEFAULT_COLORS.fib[(i) % DEFAULT_COLORS.fib.length];
              ctx.fillRect(minX, Math.min(y1, y2), maxX - minX, Math.abs(y2 - y1));
            }
          });
          ctx.restore();
        }
      }
      break;

    case 'fib_extension':
    case 'fib_channel':
      if (p1 && p2 && p1.x !== null && p1.y !== null && p2.x !== null && p2.y !== null) {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
      if (p1 && p2 && p3 && p1.x !== null && p1.y !== null && p2.x !== null && p2.y !== null && p3.x !== null && p3.y !== null) {
        const levels = settings.levels || [0, 0.618, 1, 1.618];
        const diffX = p2.x - p1.x;
        const diffY = p2.y - p1.y;
        
        if (type === 'fib_channel') {
          // p3 defines the baseline offset
          const dx = p3.x - p1.x;
          const dy = p3.y - p1.y;
          
          const fillOpacity = settings.fillOpacity !== undefined ? settings.fillOpacity : 0;
          if (fillOpacity > 0) {
            ctx.save();
            ctx.globalAlpha = fillOpacity;
            ctx.fillStyle = settings.color || DEFAULT_COLORS.line;
            // Simplified fill for fib channel
            ctx.beginPath();
            ctx.moveTo(p1.x - diffX*10, p1.y - diffY*10);
            ctx.lineTo(p2.x + diffX*10, p2.y + diffY*10);
            ctx.lineTo(p2.x + dx + diffX*10, p2.y + dy + diffY*10);
            ctx.lineTo(p1.x + dx - diffX*10, p1.y + dy - diffY*10);
            ctx.fill();
            ctx.restore();
          }

          levels.forEach((l, i) => {
            if (settings.levelVisibility && settings.levelVisibility[l] === false) return;
            const offsetX = dx * l;
            const offsetY = dy * l;
            ctx.beginPath();
            ctx.moveTo(p1.x + offsetX - diffX*10, p1.y + offsetY - diffY*10);
            ctx.lineTo(p2.x + offsetX + diffX*10, p2.y + offsetY + diffY*10);
            ctx.strokeStyle = DEFAULT_COLORS.fib[i % DEFAULT_COLORS.fib.length];
            ctx.stroke();
          });
        } else {
          // Fib extension: p3 is retracement point
          const priceDiff = points[1].price - points[0].price;
          const minX = Math.min(p1.x, p2.x, p3.x);
          const maxX = coordSys.width;
          levels.forEach((l, i) => {
            if (settings.levelVisibility && settings.levelVisibility[l] === false) return;
            const price = points[2].price + priceDiff * l;
            const y = clampCoord(coordSys.priceToCoordinate(price), coordSys.height);
            if (y !== null) {
              ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y);
              ctx.strokeStyle = DEFAULT_COLORS.fib[i % DEFAULT_COLORS.fib.length]; ctx.stroke();
            }
          });
        }
      }
      break;

    case 'triangle':
      // Bug 15: fillOpacity control, matching rectangle behaviour
      if (p1 && p2 && p3 && p1.x !== null && p1.y !== null && p2.x !== null && p2.y !== null && p3.x !== null && p3.y !== null) {
        const fillOpacity = settings.fillOpacity !== undefined ? settings.fillOpacity : 0.15;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.save();
        ctx.globalAlpha = fillOpacity;
        ctx.fill();
        ctx.restore();
        ctx.stroke();
      }
      break;

    case 'rectangle':
      if (p1 && p2 && p1.x !== null && p1.y !== null && p2.x !== null && p2.y !== null) {
        const fillOpacity = settings.fillOpacity !== undefined ? settings.fillOpacity : 0.2;
        ctx.save();
        ctx.globalAlpha = fillOpacity;
        ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        ctx.restore();
        ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      }
      break;

    case 'long_position':
    case 'short_position':
      if (p1 && p1.x !== null && p1.y !== null) {
        const isLong = type === 'long_position';
        const w = 200;
        const entryPrice = settings.entryPrice !== undefined ? settings.entryPrice : points[0].price;
        const tpPrice = settings.targetPrice !== undefined ? settings.targetPrice : (isLong ? entryPrice * 1.04 : entryPrice * 0.96);
        const slPrice = settings.stopPrice !== undefined ? settings.stopPrice : (isLong ? entryPrice * 0.98 : entryPrice * 1.02);
        
        const yEntry = clampCoord(coordSys.priceToCoordinate(entryPrice), coordSys.height) ?? p1.y;
        const ySL = clampCoord(coordSys.priceToCoordinate(slPrice), coordSys.height) ?? p1.y + 50;
        const yTP = clampCoord(coordSys.priceToCoordinate(tpPrice), coordSys.height) ?? p1.y - 50;

        // TP zone
        ctx.fillStyle = isLong ? 'rgba(76, 175, 80, 0.25)' : 'rgba(242, 54, 69, 0.25)';
        ctx.fillRect(p1.x, Math.min(yEntry, yTP), w, Math.abs(yTP - yEntry));
        // SL zone
        ctx.fillStyle = isLong ? 'rgba(242, 54, 69, 0.25)' : 'rgba(76, 175, 80, 0.25)';
        ctx.fillRect(p1.x, Math.min(yEntry, ySL), w, Math.abs(ySL - yEntry));

        // TP border line
        ctx.save();
        ctx.strokeStyle = isLong ? '#4CAF50' : '#F23645';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, yTP);
        ctx.lineTo(p1.x + w, yTP);
        ctx.stroke();
        ctx.restore();

        // SL border line
        ctx.save();
        ctx.strokeStyle = isLong ? '#F23645' : '#4CAF50';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, ySL);
        ctx.lineTo(p1.x + w, ySL);
        ctx.stroke();
        ctx.restore();

        // Entry dashed line
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(p1.x, yEntry);
        ctx.lineTo(p1.x + w, yEntry);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Labels
        ctx.fillStyle = '#fff';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        const slPercent = Math.abs(slPrice - entryPrice) / entryPrice * 100;
        const tpPercent = Math.abs(tpPrice - entryPrice) / entryPrice * 100;
        const rrRatio = slPercent > 0 ? (tpPercent / slPercent).toFixed(2) : '∞';
        ctx.fillText(`Entry: ${entryPrice.toFixed(2)}`, p1.x + 5, yEntry - 5);

        ctx.fillStyle = isLong ? '#4CAF50' : '#F23645';
        ctx.fillText(`TP: ${tpPrice.toFixed(2)} (${tpPercent.toFixed(1)}%)`, p1.x + 5, yTP + (isLong ? -6 : 14));
        ctx.fillStyle = isLong ? '#F23645' : '#4CAF50';
        ctx.fillText(`SL: ${slPrice.toFixed(2)} (${slPercent.toFixed(1)}%)`, p1.x + 5, ySL + (isLong ? 14 : -6));

        ctx.fillStyle = '#D1D4DC';
        ctx.fillText(`R:R  1:${rrRatio}`, p1.x + w - 70, yEntry - 5);

        // Drag handles (entry, TP, SL)
        if (isSelected) {
          const handleSize = 5;
          const hx = p1.x + w;
          [[yEntry, '#fff'], [yTP, isLong ? '#4CAF50' : '#F23645'], [ySL, isLong ? '#F23645' : '#4CAF50']].forEach(([hy, color]) => {
            ctx.fillStyle = color;
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.rect(hx - handleSize, hy - handleSize, handleSize * 2, handleSize * 2);
            ctx.fill();
            ctx.stroke();
          });
        }
      }
      break;

    case 'path':
      if (pxs.length > 0) {
        ctx.beginPath();
        let moved = false;
        for (let i = 0; i < pxs.length; i++) {
          if (pxs[i].x !== null && pxs[i].y !== null) {
            if (!moved) {
              ctx.moveTo(pxs[i].x, pxs[i].y);
              moved = true;
            } else {
              ctx.lineTo(pxs[i].x, pxs[i].y);
            }
          }
        }
        if (moved) ctx.stroke();
      }
      break;
  }
  
  // Draw selection handles (skip for long/short — they render their own)
  if (isSelected && type !== 'long_position' && type !== 'short_position') {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    pxs.forEach(p => {
      if (p.x === null || p.y === null) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }
  
  ctx.restore();
};

export const isPointNearDrawing = (px, py, d, coordSys) => {
  // Simple bounding box or distance check
  const pxs = d.points.map(p => {
    let x = null;
    if (p.time != null) {
      x = coordSys.timeToCoordinate(p.time);
    }
    if (x === null && p.logical != null) {
      x = coordSys.logicalToCoordinate(p.logical);
    }
    const y = coordSys.priceToCoordinate(p.price);
    return { x, y };
  });

  // If points are unresolvable, we can't hit test them easily
  if (pxs.some(p => p.x === null || p.y === null)) return { hit: false };
  
  // Bug 6 fix: tolerance in CSS pixels only — no DPR multiplication
  const lineWidth = d.settings?.lineWidth || 2;
  const tolerance = Math.max(8, 6 + lineWidth * 2);
  
  // Check handles first (higher priority, slightly larger radius)
  for (let i = 0; i < pxs.length; i++) {
    if (Math.hypot(pxs[i].x - px, pxs[i].y - py) <= tolerance + 4) {
      return { hit: true, handleIndex: i };
    }
  }
  
  const distToLine = (x0, y0, x1, y1, x2, y2) => {
    const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(x0 - x1, 2) + Math.pow(y0 - y1, 2));
    let t = ((x0 - x1) * (x2 - x1) + (y0 - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(Math.pow(x0 - (x1 + t * (x2 - x1)), 2) + Math.pow(y0 - (y1 + t * (y2 - y1)), 2));
  };


  switch(d.type) {
    case 'horizontal_line':
      if (pxs[0] && Math.abs(py - pxs[0].y) < tolerance) return { hit: true, handleIndex: -1 };
      break;
    case 'trend_line':
      if (pxs.length >= 2) {
        if (distToLine(px, py, pxs[0].x, pxs[0].y, pxs[1].x, pxs[1].y) < tolerance) return { hit: true, handleIndex: -1 };
      }
      break;
    case 'ray':
    case 'extended_line':
      if (pxs.length >= 2) {
        if (distToLine(px, py, pxs[0].x, pxs[0].y, pxs[1].x, pxs[1].y) < tolerance) return { hit: true, handleIndex: -1 };
      }
      break;
    case 'rectangle':
      if (pxs.length >= 2) {
        const minX = Math.min(pxs[0].x, pxs[1].x);
        const maxX = Math.max(pxs[0].x, pxs[1].x);
        const minY = Math.min(pxs[0].y, pxs[1].y);
        const maxY = Math.max(pxs[0].y, pxs[1].y);
        if (px >= minX && px <= maxX && py >= minY && py <= maxY) return { hit: true, handleIndex: -1 };
      }
      break;
    case 'long_position':
    case 'short_position': {
      if (!pxs[0] || pxs[0].x === null || pxs[0].y === null) break;
      const isLong = d.type === 'long_position';
      const entryPrice = d.settings?.entryPrice ?? d.points[0].price;
      const tpPrice = d.settings?.targetPrice ?? (isLong ? entryPrice * 1.04 : entryPrice * 0.96);
      const slPrice = d.settings?.stopPrice ?? (isLong ? entryPrice * 0.98 : entryPrice * 1.02);
      const yEntry = coordSys.priceToCoordinate(entryPrice);
      const yTP = coordSys.priceToCoordinate(tpPrice);
      const ySL = coordSys.priceToCoordinate(slPrice);
      const posW = 200;
      const x0 = pxs[0].x;
      const x1 = x0 + posW;
      // Check TP handle (handleIndex 1)
      if (yTP !== null && Math.abs(py - yTP) < tolerance && px >= x0 - 10 && px <= x1 + 10) {
        return { hit: true, handleIndex: 1 };
      }
      // Check SL handle (handleIndex 2)
      if (ySL !== null && Math.abs(py - ySL) < tolerance && px >= x0 - 10 && px <= x1 + 10) {
        return { hit: true, handleIndex: 2 };
      }
      // Check entry handle (handleIndex 0)
      if (yEntry !== null && Math.abs(py - yEntry) < tolerance && px >= x0 - 10 && px <= x1 + 10) {
        return { hit: true, handleIndex: 0 };
      }
      // Check body (inside the box area)
      if (yEntry !== null && yTP !== null && ySL !== null) {
        const minY = Math.min(yTP, ySL);
        const maxY = Math.max(yTP, ySL);
        if (px >= x0 && px <= x1 && py >= minY && py <= maxY) {
          return { hit: true, handleIndex: -1 };
        }
      }
      break;
    }
    default:
      // Check path distance
      for (let i = 0; i < pxs.length - 1; i++) {
        if (distToLine(px, py, pxs[i].x, pxs[i].y, pxs[i+1].x, pxs[i+1].y) < tolerance) return { hit: true, handleIndex: -1 };
      }
  }
  return { hit: false };
};
