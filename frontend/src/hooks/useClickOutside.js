import { useEffect } from 'react';

/**
 * Closes a popup when the user clicks anywhere outside `ref`, or presses Escape.
 * `active` lets callers skip the listeners entirely while the popup is closed.
 */
export default function useClickOutside(ref, onClose, active = true) {
  useEffect(() => {
    if (!active) return;

    const handlePointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref, onClose, active]);
}
