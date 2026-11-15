import { useEffect, useRef, useState } from 'react';

const TWEEN_MS = 700;

/** Animates a displayed value towards a target (ease-out); jumps when motion is reduced. */
export function useTween(target: number, reduced: boolean) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const valueRef = useRef(target);
  useEffect(() => {
    if (reduced) {
      // No animation: the target is returned directly below.
      valueRef.current = target;
      return;
    }
    from.current = valueRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / TWEEN_MS);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = from.current + (target - from.current) * eased;
      valueRef.current = v;
      setValue(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return reduced ? target : value;
}
