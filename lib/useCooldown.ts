import { useCallback, useEffect, useState } from 'react';

/** How long "Send a new code" waits after a code goes out. */
export const RESEND_COOLDOWN_S = 30;

/** Seconds until "Send a new code" is allowed again, ticking down; `start` begins a new wait. */
export function useCooldown(seconds: number = RESEND_COOLDOWN_S): [number, () => void] {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      // Reached 0: nothing left to count down.
      if (time >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  const start = useCallback(() => {
    setNow(Date.now());
    setUntil(Date.now() + seconds * 1000);
  }, [seconds]);
  return [left, start];
}
