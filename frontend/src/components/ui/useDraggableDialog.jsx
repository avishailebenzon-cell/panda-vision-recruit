import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook to make a dialog draggable by its header.
 * Returns { position, dragHandleProps, dialogStyle }
 * - Apply dragHandleProps to the drag handle element (e.g. DialogHeader)
 * - Apply dialogStyle to the DialogContent via style prop
 */
export function useDraggableDialog() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e) => {
    // Don't drag if clicking a button/input inside the header
    if (e.target.closest('button') || e.target.closest('input')) return;
    dragging.current = true;
    startPos.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...position };
    e.preventDefault();
  }, [position]);

  const onTouchStart = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    dragging.current = true;
    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
    startOffset.current = { ...position };
  }, [position]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return;
      setPosition({
        x: startOffset.current.x + (e.clientX - startPos.current.x),
        y: startOffset.current.y + (e.clientY - startPos.current.y),
      });
    };

    const onTouchMove = (e) => {
      if (!dragging.current) return;
      const touch = e.touches[0];
      setPosition({
        x: startOffset.current.x + (touch.clientX - startPos.current.x),
        y: startOffset.current.y + (touch.clientY - startPos.current.y),
      });
    };

    const onEnd = () => { dragging.current = false; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  const dialogStyle = {
    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
    position: 'fixed',
    top: '50%',
    left: '50%',
    margin: 0,
  };

  const dragHandleProps = {
    onMouseDown,
    onTouchStart,
    style: { cursor: 'grab' },
  };

  return { position, dragHandleProps, dialogStyle };
}