import { useEffect, useRef, useState } from 'react';

interface CountdownTimerProps {
  deadline: number | null;
  serverNow: number;
}

/**
 * Shows seconds remaining until the server auto-resolves the current phase.
 * Uses the server's clock (deadline + serverNow) to stay skew-free, then ticks
 * locally between polls. Renders nothing when there's no deadline (e.g. single
 * device mode).
 */
export function CountdownTimer({ deadline, serverNow }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(0);
  const skewRef = useRef(0);

  useEffect(() => {
    if (deadline == null) return;
    // How far the local clock is ahead of the server's, measured at fetch time.
    skewRef.current = Date.now() - serverNow;
    const tick = () => {
      const serverEstimate = Date.now() - skewRef.current;
      setRemaining(Math.max(0, deadline - serverEstimate));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline, serverNow]);

  if (deadline == null) return null;

  const secs = Math.ceil(remaining / 1000);
  const urgent = secs <= 6;

  return (
    <div className="flex items-center justify-center">
      <span
        className={`text-[11px] tabular-nums tracking-wider ${urgent ? 'text-crimson' : 'text-parchment/40'}`}
      >
        ⏳ {secs}s
      </span>
    </div>
  );
}
