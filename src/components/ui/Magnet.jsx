import { useRef, useCallback } from 'react';

export default function Magnet({
  children,
  padding = 80,
  disabled = false,
  magnetStrength = 2,
  activeTransition = 'transform 0.3s ease-out',
  inactiveTransition = 'transform 0.5s ease-in-out',
  className = '',
}) {
  const ref = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (disabled || !ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const dx = e.clientX - (left + width / 2);
    const dy = e.clientY - (top + height / 2);
    ref.current.style.transform = `translate(${dx / magnetStrength}px, ${dy / magnetStrength}px)`;
    ref.current.style.transition = activeTransition;
  }, [disabled, magnetStrength, activeTransition]);

  const reset = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.transform = 'translate(0,0)';
    ref.current.style.transition = inactiveTransition;
  }, [inactiveTransition]);

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      style={{ display: 'inline-block' }}
    >
      {children}
    </div>
  );
}
