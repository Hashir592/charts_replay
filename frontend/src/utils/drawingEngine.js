export const TOOL_CONFIGS = {
  cursor: { name: 'Cursor', points: 0 },
  horizontal_line: { name: 'Horizontal Line', points: 1 },
  trend_line: { name: 'Trend Line', points: 2 },
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
export const renderDrawing = (ctx, d, coordSys, isSelected, isHovered) => {
  if (d.points.length === 0) return;
  const { type, settings, points } = d;

  // Map to pixels
  const pxs = points.map(p => ({
    x: coordSys.timeToCoordinate(p.time) ?? coordSys.width / 2,
    y: coordSys.priceToCoordinate(p.price) ?? coordSys.height / 2
  }));

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
      if (p1) {
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
      if (p1 && p2) {
        // Extend to edges
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        if (dx === 0) break;
        const slope = dy / dx;
        const yAt0 = p1.y - slope * p1.x;
        const yAtW = p1.y + slope * (coordSys.width - p1.x);

        ctx.beginPath();
        ctx.moveTo(0, yAt0);
        ctx.lineTo(coordSys.width, yAtW);
        ctx.stroke();
      } else if (p1) {
        // Just a dot if drawing
        ctx.beginPath(); ctx.arc(p1.x, p1.y, 3, 0, Math.PI * 2); ctx.fill();
      }
      break;

    case 'fib_retracement':
      if (p1 && p2) {
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
        levels.forEach((l, i) => {
          const price = points[0].price - diff * l;
          const y = coordSys.priceToCoordinate(price);
          if (y !== null) {
            ctx.beginPath();
            ctx.moveTo(minX, y);
            ctx.lineTo(maxX, y);
            ctx.strokeStyle = DEFAULT_COLORS.fib[i % DEFAULT_COLORS.fib.length];
            ctx.stroke();
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fillText(`${l} (${price.toFixed(2)})`, minX + 5, y - 5);
          }
        });
      }
      break;

    case 'fib_extension':
    case 'fib_channel':
      if (p1 && p2) {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
      if (p1 && p2 && p3) {
        const levels = settings.levels || [0, 0.618, 1, 1.618];
        const diffX = p2.x - p1.x;
        const diffY = p2.y - p1.y;
        
        if (type === 'fib_channel') {
          // p3 defines the baseline offset
          const dx = p3.x - p1.x;
          const dy = p3.y - p1.y;
          levels.forEach((l, i) => {
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
            const price = points[2].price + priceDiff * l;
            const y = coordSys.priceToCoordinate(price);
            if (y !== null) {
              ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y);
              ctx.strokeStyle = DEFAULT_COLORS.fib[i % DEFAULT_COLORS.fib.length]; ctx.stroke();
            }
          });
        }
      }
      break;

    case 'triangle':
      if (p1 && p2 && p3) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;

    case 'rectangle':
      if (p1 && p2) {
        ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      }
      break;

    case 'long_position':
    case 'short_position':
      if (p1) {
        const isLong = type === 'long_position';
        const w = 100; // width of position box
        const entryPrice = points[0].price;
        const slPercent = settings.stopLossPercent || 2;
        const tpPercent = settings.takeProfitPercent || 4;
        
        const slPrice = isLong ? entryPrice * (1 - slPercent/100) : entryPrice * (1 + slPercent/100);
        const tpPrice = isLong ? entryPrice * (1 + tpPercent/100) : entryPrice * (1 - tpPercent/100);
        
        const ySL = coordSys.priceToCoordinate(slPrice) ?? p1.y + 50;
        const yTP = coordSys.priceToCoordinate(tpPrice) ?? p1.y - 50;

        // Target box (Green)
        ctx.fillStyle = isLong ? DEFAULT_COLORS.long.bg : DEFAULT_COLORS.short.bg;
        ctx.fillRect(p1.x, p1.y, w, yTP - p1.y);
        // Stop box (Red)
        ctx.fillStyle = isLong ? DEFAULT_COLORS.short.bg : DEFAULT_COLORS.long.bg;
        ctx.fillRect(p1.x, p1.y, w, ySL - p1.y);
        
        // Labels
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText(`Risk: ${slPercent.toFixed(1)}%`, p1.x + 5, ySL + (isLong ? 12 : -5));
        ctx.fillText(`Target: ${tpPercent.toFixed(1)}%`, p1.x + 5, yTP + (isLong ? -5 : 12));
      }
      break;

    case 'path':
      if (pxs.length > 0) {
        ctx.beginPath();
        ctx.moveTo(pxs[0].x, pxs[0].y);
        for (let i = 1; i < pxs.length; i++) {
          ctx.lineTo(pxs[i].x, pxs[i].y);
        }
        ctx.stroke();
      }
      break;
  }
  
  // Draw selection handles
  if (isSelected) {
    ctx.fillStyle = '#fff';
    pxs.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  
  ctx.restore();
};

export const isPointNearDrawing = (px, py, d, coordSys) => {
  // Simple bounding box or distance check
  const pxs = d.points.map(p => ({
    x: coordSys.timeToCoordinate(p.time) ?? -999,
    y: coordSys.priceToCoordinate(p.price) ?? -999
  }));
  
  const distToLine = (x0, y0, x1, y1, x2, y2) => {
    const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(x0 - x1, 2) + Math.pow(y0 - y1, 2));
    let t = ((x0 - x1) * (x2 - x1) + (y0 - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(Math.pow(x0 - (x1 + t * (x2 - x1)), 2) + Math.pow(y0 - (y1 + t * (y2 - y1)), 2));
  };

  const tolerance = 10;
  
  switch(d.type) {
    case 'horizontal_line':
      if (pxs[0] && Math.abs(py - pxs[0].y) < tolerance) return true;
      break;
    case 'trend_line':
      if (pxs.length >= 2) {
        // It extends fully, but let's just use segment distance
        if (distToLine(px, py, pxs[0].x, pxs[0].y, pxs[1].x, pxs[1].y) < tolerance) return true;
      }
      break;
    case 'rectangle':
      if (pxs.length >= 2) {
        const minX = Math.min(pxs[0].x, pxs[1].x);
        const maxX = Math.max(pxs[0].x, pxs[1].x);
        const minY = Math.min(pxs[0].y, pxs[1].y);
        const maxY = Math.max(pxs[0].y, pxs[1].y);
        if (px >= minX && px <= maxX && py >= minY && py <= maxY) return true;
      }
      break;
    default:
      // Fallback: check distance to any point
      for (const p of pxs) {
        if (Math.hypot(p.x - px, p.y - py) < tolerance * 2) return true;
      }
      // Check path distance
      for (let i = 0; i < pxs.length - 1; i++) {
        if (distToLine(px, py, pxs[i].x, pxs[i].y, pxs[i+1].x, pxs[i+1].y) < tolerance) return true;
      }
  }
  return false;
};
