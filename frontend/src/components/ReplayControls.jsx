import React from 'react';

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
  return (
    <div className="replay-controls">
      <button className="replay-btn primary" onClick={togglePlay}>
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>
      
      <button className="replay-btn" onClick={stepForward} disabled={isPlaying || currentIndex >= totalCount - 1}>
        ▶| Step
      </button>

      <div className="scrubber-container">
        <input 
          type="range" 
          className="replay-scrubber"
          min="0" 
          max={totalCount > 0 ? totalCount - 1 : 0} 
          value={currentIndex} 
          onChange={(e) => {
            if (isPlaying) togglePlay(); // Pause while scrubbing
            setReplayIndex(Number(e.target.value));
          }}
        />
      </div>

      <div className="speed-selector">
        <label>Speed:</label>
        <select value={replaySpeed} onChange={(e) => setReplaySpeed(Number(e.target.value))}>
          <option value={1000}>Slow (1s)</option>
          <option value={500}>Normal (0.5s)</option>
          <option value={100}>Fast (0.1s)</option>
          <option value={50}>Turbo (50ms)</option>
        </select>
      </div>

      <div className="replay-progress">
        Bar {currentIndex + 1} / {totalCount}
        {currentIndex >= totalCount - 1 && <span className="replay-complete"> (Complete)</span>}
      </div>

      <button className="replay-btn danger" onClick={exitReplay}>
        Exit Replay
      </button>
    </div>
  );
}
