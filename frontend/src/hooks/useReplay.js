import { useState, useEffect, useRef } from 'react';

export default function useReplay(totalCandlesCount) {
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(500);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const replayIndexRef = useRef(replayIndex);
  replayIndexRef.current = replayIndex;

  const speedRef = useRef(replaySpeed);
  speedRef.current = replaySpeed;

  // Cleanup interval on unmount
  useEffect(() => {
    return () => stopPlayback();
  }, []);

  // Handle Play/Pause Interval
  useEffect(() => {
    let intervalId;
    if (isPlaying) {
      intervalId = setInterval(() => {
        setReplayIndex((prev) => {
          if (prev >= totalCandlesCount - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, replaySpeed);
    }
    return () => clearInterval(intervalId);
  }, [isPlaying, replaySpeed, totalCandlesCount]);

  const startReplay = () => {
    if (totalCandlesCount === 0) return;
    setIsReplayMode(true);
    setIsPlaying(false);
    // Start 100 bars before the end
    setReplayIndex(Math.max(0, totalCandlesCount - 100));
  };

  const exitReplay = () => {
    setIsReplayMode(false);
    setIsPlaying(false);
    setReplayIndex(totalCandlesCount - 1);
  };

  const togglePlay = () => {
    if (replayIndex >= totalCandlesCount - 1) {
      // If at end, restart from 100 bars ago
      setReplayIndex(Math.max(0, totalCandlesCount - 100));
    }
    setIsPlaying(!isPlaying);
  };

  const stepForward = () => {
    setIsPlaying(false); // Pause if playing
    if (replayIndex < totalCandlesCount - 1) {
      setReplayIndex(replayIndex + 1);
    }
  };

  const stopPlayback = () => {
    setIsPlaying(false);
  };

  // Reset when data changes (e.g., symbol/timeframe switch)
  useEffect(() => {
    if (isReplayMode) {
      startReplay();
    }
  }, [totalCandlesCount]); // Re-trigger if dataset changes size

  return {
    isReplayMode,
    replayIndex,
    setReplayIndex,
    isPlaying,
    replaySpeed,
    setReplaySpeed,
    startReplay,
    exitReplay,
    togglePlay,
    stepForward,
  };
}
