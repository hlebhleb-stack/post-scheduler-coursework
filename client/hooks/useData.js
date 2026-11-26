import { useState, useEffect } from 'react';
import { request } from '../services/api.js';

export function useData(kind, id) {
  const key = kind + '/' + (id || '');
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const data =
      id === 'new' ? Promise.resolve(null) : request(id ? kind + '/' + id : kind, options);
    const channels =
      kind === 'posts' && id === 'new' ? request('channels', options) : Promise.resolve(undefined);
    Promise.all([data, channels])
      .then(([data, channels]) => {
        if (!controller.signal.aborted) setResult({ key, data, channels });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ key, error: error.message });
      });
    return () => controller.abort();
  }, [key, kind, id]);
  return result?.key === key ? result : {};
}
