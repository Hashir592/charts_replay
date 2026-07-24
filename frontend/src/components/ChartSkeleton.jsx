import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Shimmering candle silhouette shown over the chart while a symbol/timeframe
 * loads. Purely presentational — driven by the existing `isLoading` flag, it
 * reads as "drawing the chart" rather than a bare spinner.
 */
export default function ChartSkeleton({ label }) {
  // Static per mount so the bars don't reshuffle on every render.
  const heights = useMemo(
    () => Array.from({ length: 48 }, () => 18 + Math.round(Math.random() * 64)),
    []
  );

  return (
    <div className="chart-loading" aria-hidden="true">
      <div className="skeleton-label">
        <Loader2 size={13} className="spin" />
        {label}
      </div>
      {heights.map((h, i) => (
        <div
          key={i}
          className="skeleton-bar"
          style={{ height: `${h}%`, animationDelay: `${(i % 12) * 60}ms` }}
        />
      ))}
    </div>
  );
}
