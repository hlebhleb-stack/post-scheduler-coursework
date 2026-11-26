import assert from 'node:assert/strict';
import pg from 'pg';

export async function checkAdmin(base, databaseURL) {
  const db = new pg.Pool({connectionString:databaseURL});
  const email = 'admin-check-' + Date.now() + '@example.com';
  const password = 'Admin-check-password-123';
  try {
    const registration = await fetch(base + '/api/auth/register', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    assert.equal(registration.status,201);
    const login = await fetch(base + '/api/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    assert.equal(login.status,200);
    const session = await login.json();
    const headers = {Authorization:'Bearer ' + session.token};
    assert.equal(session.role,'user');
    assert.equal((await fetch(base + '/api/admin/overview',{headers})).status,403);
    assert.equal((await fetch(base + '/api/admin/overview')).status,401);
    await db.query("UPDATE users SET role='admin' WHERE email=$1",[email]);
    const overview = await fetch(base + '/api/admin/overview',{headers});
    assert.equal(overview.status,200);
    const data = await overview.json();
    assert.equal(typeof data.counts.users,'number');
    assert(Array.isArray(data.problems));
    for (const problem of data.problems) {
      assert.deepEqual(Object.keys(problem).sort(),['error','id','platform','scheduled_at','status']);
    }
    const profile = await (await fetch(base + '/api/auth/me',{headers})).json();
    assert.equal(profile.role,'admin');
    // Старый JWT не сохраняет права после снятия роли.
    await db.query("UPDATE users SET role='user' WHERE email=$1",[email]);
    assert.equal((await fetch(base + '/api/admin/overview',{headers})).status,403);
    console.log('Проверки доступа администратора, профиля и отзыва роли пройдены');
  } finally {
    await db.query('DELETE FROM users WHERE email=$1',[email]);
    await db.end();
  }
}
