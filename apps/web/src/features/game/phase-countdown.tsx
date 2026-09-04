import { useEffect, useState } from 'react';

export function PhaseCountdown({ endsAt }: { endsAt: string | null }) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => getRemainingSeconds(endsAt));

  useEffect(() => {
    setRemainingSeconds(getRemainingSeconds(endsAt));
    if (!endsAt) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds(getRemainingSeconds(endsAt));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [endsAt]);

  if (!endsAt) {
    return null;
  }

  return <p aria-live="polite" className="phase-countdown" role="timer">남은 시간: {remainingSeconds}초</p>;
}

function getRemainingSeconds(endsAt: string | null): number {
  if (!endsAt) {
    return 0;
  }

  const remainingMilliseconds = Date.parse(endsAt) - Date.now();
  return Number.isFinite(remainingMilliseconds)
    ? Math.max(0, Math.ceil(remainingMilliseconds / 1_000))
    : 0;
}
