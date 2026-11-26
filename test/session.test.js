import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request, sessionKey } from '../client/services/api.js';
function browser(t) {
  const storage = new Map([
    [sessionKey, JSON.stringify({ token: 'expired', email: 'test@example.com' })],
  ]);
  for (const key of ['sessionStorage', 'window']) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value: null, writable: true, configurable: true });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    });
  }
  globalThis.sessionStorage = {
    getItem: (key) => storage.get(key) || null,
    removeItem: (key) => storage.delete(key),
  };
  globalThis.window = new EventTarget();
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: 'Войди в аккаунт' }, { status: 401 }),
  );
  return storage;
}
test('Истёкшая сессия при восстановлении профиля удаляется и вызывает выход', async (t) => {
  const storage = browser(t);
  let expired = false;
  window.addEventListener('session-expired', () => {
    expired = true;
  });
  await assert.rejects(request('auth/me'));
  assert.equal(storage.has(sessionKey), false);
  assert(expired);
});
test('Ошибка входа не обрабатывается как истечение активной сессии', async (t) => {
  const storage = browser(t);
  let expired = false;
  window.addEventListener('session-expired', () => {
    expired = true;
  });
  await assert.rejects(
    request('auth/login', { method: 'POST', body: { email: 'test@example.com', password: 'bad' } }),
  );
  assert(storage.has(sessionKey));
  assert.equal(expired, false);
});
