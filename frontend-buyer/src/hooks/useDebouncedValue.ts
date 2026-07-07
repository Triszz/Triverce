import { useEffect, useState } from 'react';

/**
 * useDebouncedValue — standard debounce hook for input → API rate-limiting.
 *
 * Returns a value that lags `value` by `delayMs` milliseconds, only
 * updating once `value` has been stable for that duration.
 *
 * Usage:
 *   const [raw, setRaw] = useState(1);
 *   const committed = useDebouncedValue(raw, 350);
 *   useEffect(() => { onCommit(committed); }, [committed]);
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
