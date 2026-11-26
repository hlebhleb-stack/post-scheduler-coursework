import { useState,useEffect } from 'react';
import { request } from '../services/api.js';
export function useData(kind, id) {
  const key = kind + '/' + (id || '');
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = id === 'new' ? Promise.resolve(null) : id ? request(kind + '/' + id, { signal: controller.signal })
      : request(kind, { signal: controller.signal });
    const references = kind === 'posts' && id === 'new' ? [
      request('channels', { signal: controller.signal }),
    ] : [];
    const calls = id === 'new' ? [Promise.resolve(null), ...references] : [load];
    Promise.all(calls)
      .then(([data, channels]) => {
        if (!controller.signal.aborted) setResult({ key, data, channels });
      })
      .catch(error => {
        if (!controller.signal.aborted) setResult({ key, error: error.message });
      });
    return () => controller.abort();
  }, [key, kind, id]);
  return result?.key === key ? result : {};
}

