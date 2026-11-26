export const sessionKey = 'schedule-session';

export async function request(path, options = {}) {
  const session = JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
  const result = await fetch('/api/' + path, {
    method: options.method || 'GET',
    signal: options.signal,
    headers: {
      ...(session ? { Authorization: 'Bearer ' + session.token } : {}),
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });
  if (result.status === 204) return null;
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    if (result.status === 401 && session && !path.startsWith('auth/')) {
      sessionStorage.removeItem(sessionKey);
      window.dispatchEvent(new Event('session-expired'));
    }
    throw new Error(data.error || 'Не удалось выполнить запрос');
  }
  return data;
}

