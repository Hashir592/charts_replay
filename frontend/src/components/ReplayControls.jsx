import React from 'react';
import { Play, Pause, StepForward, X } from 'lucide-react';

const SPEEDS = [
  { value: 1000, label: '0.5×' },
  { value: 500, label: '1×' },
  { value: 250, label: '2×' },
  { value: 100, label: '5×' },
  { value: 50, label: '10×' },
];

export default function ReplayControls({
  isPlaying,
  togglePlay,
  stepForward,
  replaySpeed,
  setReplaySpeed,
  exitReplay,
  currentIndex,
  totalCount,
  setReplayIndex,
}) {
  const atEnd = currentIndex >= totalCount - 1;

  return (
    <div className="replay-controls">
      <span className="replay-badge">
        <span className="dot" />
        REPLAY
      </span>

      <div className="replay-divider" />

      <button
        className="replay-btn primary"
        onClick={togglePlay}
        disabled={atEnd}
        title={isPlaying ? 'Pause (space)' : 'Play (space)'}
      >
        {isPlaying ? (
          <Pause size={14} fill="currentColor" />
        ) : (
          <Play size={14} fill="currentColor" />
        )}
      </button>

      <button
        className="replay-btn"
        onClick={stepForward}
        disabled={isPlaying || atEnd}
        title="Step forward (→)"
      >
        <StepForward size={15} />
      </button>

      <div className="scrubber-container">
        <input
          type="range"
          className="replay-scrubber"
          min="0"
          max={totalCount > 0 ? totalCount - 1 : 0}
          value={currentIndex}
          onChange={(e) => {
            if (isPlaying) togglePlay();
            setReplayIndex(Number(e.target.value));
          }}
        />
      </div>

      <div className="replay-progress">
        {currentIndex + 1} / {totalCount}
        {atEnd && <span className="replay-complete"> · end</span>}
      </div>

      <div className="replay-divider" />

      <select
        className="replay-speed"
        value={replaySpeed}
        onChange={(e) => setReplaySpeed(Number(e.target.value))}
        title="Playback speed"
      >
        {SPEEDS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <div className="replay-divider" />

      <button className="replay-btn danger" onClick={exitReplay} title="Exit replay">
        <X size={15} />
      </button>
    </div>
  );
}
