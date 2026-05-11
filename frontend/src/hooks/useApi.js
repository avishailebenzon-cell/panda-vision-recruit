import { useState, useEffect, useCallback } from 'react';

export function useApi(fn, deps = [], immediate = true) {
  const [data,    setData]    = useState(undefined);
  const [loading, setLoading] = useState(immediate);
  const [error,   setError]   = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      setData(result);
      return result;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { if (immediate) execute(); }, [execute, immediate]);

  return { data, loading, error, refetch: execute };
}

export function useInterval(fn, ms) {
  useEffect(() => {
    fn();
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms]);
}
