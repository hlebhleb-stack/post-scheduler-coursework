import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import pg from 'pg';
export async function checkSecurity(base, databaseURL, secret) {
  const db = new pg.Pool({ connectionString: databaseURL });
  let userId;
  try {
    userId = (
      await db.query("INSERT INTO users(email,password_hash) VALUES ($1,'test') RETURNING id", [
        'security-' + Date.now() + '@example.com',
      ])
    ).rows[0].id;
    const valid = jwt.sign({}, secret, {
      subject: String(userId),
      expiresIn: 60,
      algorithm: 'HS256',
    });
    const expired = jwt.sign({}, secret, {
      subject: String(userId),
      expiresIn: -60,
      algorithm: 'HS256',
    });
    const wrongAlgorithm = jwt.sign({}, secret, {
      subject: String(userId),
      expiresIn: 60,
      algorithm: 'HS384',
    });
    for (const path of ['channels', 'posts', 'media', 'admin/overview', 'auth/me']) {
      for (const token of [expired, wrongAlgorithm])
        assert.equal(
          (await fetch(base + '/api/' + path, { headers: { Authorization: 'Bearer ' + token } }))
            .status,
          401,
        );
    }
    const headers = { Authorization: 'Bearer ' + valid, 'Content-Type': 'application/json' };
    for (const body of [
      { name: '', platform: 'telegram', destination: '@test_channel', token: '123:test' },
      {
        name: 'x'.repeat(81),
        platform: 'telegram',
        destination: '@test_channel',
        token: '123:test',
      },
      { name: 'Тест', platform: 'unsupported', destination: '@test_channel', token: '123:test' },
      { name: 'Тест', platform: 'telegram', destination: 'wrong-channel', token: '123:test' },
    ])
      assert.equal(
        (
          await fetch(base + '/api/channels', {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          })
        ).status,
        400,
      );
    for (const body of [
      { email: 'wrong-email', password: 'password123' },
      { email: 'valid@example.com', password: 'short' },
      { email: 'valid@example.com', password: 'x'.repeat(73) },
    ]) {
      assert.equal(
        (
          await fetch(base + '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        ).status,
        400,
      );
    }
    for (const id of ['0', '-1', 'abc', '2147483648', '1%20OR%201=1'])
      assert.equal((await fetch(base + '/api/channels/' + id, { headers })).status, 404);
    assert.equal((await fetch(base + '/api/not-a-route', { headers })).status, 404);
    const health = await fetch(base + '/api/health');
    assert(health.headers.get('content-security-policy'));
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    console.log(
      'Безопасность: истёкший JWT, алгоритм подписи, поля, длинные строки, неверный email/ID и защитные заголовки проверены',
    );
  } finally {
    if (userId) await db.query('DELETE FROM users WHERE id=$1', [userId]);
    await db.end();
  }
}
