import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Drawings are persisted to localStorage, so a render crash caused by a bad
 * drawing would otherwise repeat on every reload with no way out of it from
 * inside the app. This keeps the failure contained to the chart area and
 * offers clearing the drawings for the current chart as an escape hatch.
 */
export default class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Chart crashed:', error, info);
  }

  componentDidUpdate(prevProps) {
    // A new symbol/timeframe is a fresh chance to render successfully.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="chart-crash">
        <AlertTriangle size={28} />
        <h3>The chart stopped rendering</h3>
        <p>
          This is usually caused by a saved drawing that can no longer be placed on
          this chart. Removing the drawings for this symbol normally fixes it.
        </p>
        <code>{String(this.state.error?.message || this.state.error)}</code>
        <div className="chart-crash-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              this.props.onClearDrawings?.();
              this.setState({ error: null });
            }}
          >
            Remove drawings & retry
          </button>
          <button className="btn btn-ghost" onClick={() => this.setState({ error: null })}>
            Just retry
          </button>
        </div>
      </div>
    );
  }
}
