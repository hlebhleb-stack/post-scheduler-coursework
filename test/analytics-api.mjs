import assert from 'node:assert/strict';
import pg from 'pg';
import jwt from 'jsonwebtoken';

export async function checkAnalytics(base, databaseURL, secret) {
  const db = new pg.Pool({ connectionString: databaseURL });
  let userId;
  try {
    const {
      rows: [user],
    } = await db.query(
      "INSERT INTO users(email,password_hash) VALUES ($1,'test-only') RETURNING id",
      ['analytics-' + Date.now() + '@example.com'],
    );
    userId = user.id;
    const headers = {
      Authorization:
        'Bearer ' +
        jwt.sign({}, secret, { subject: String(userId), expiresIn: 60, algorithm: 'HS256' }),
    };
    assert.equal((await fetch(base + '/api/analytics')).status, 401);
    let result = await (await fetch(base + '/api/analytics', { headers })).json();
    assert.equal(result.daily.length, 371);
    assert.deepEqual(result.counts, { scheduled: 0, published: 0, failed: 0 });
    assert(result.daily.every((day) => day.count === 0));
    const {
      rows: [channel],
    } = await db.query(
      "INSERT INTO channels(user_id,name,platform,destination,credential) VALUES ($1,'Analytics channel','telegram','@test_channel','test-only') RETURNING id",
      [userId],
    );
    const {
      rows: [post],
    } = await db.query(
      "INSERT INTO posts(user_id,channel_id,body,scheduled_at,status) VALUES ($1,$2,'Sent',now()-interval '60 days','published') RETURNING id",
      [userId, channel.id],
    );
    await db.query(
      "INSERT INTO deliveries(post_id,completed_at,external_id) VALUES ($1,now(),'123')",
      [post.id],
    );
    await db.query(
      "INSERT INTO posts(user_id,channel_id,body,scheduled_at,status) VALUES ($1,$2,'Draft',now(),'draft'),($1,$2,'Queue',now()+interval '1 day','scheduled')",
      [userId, channel.id],
    );
    result = await (await fetch(base + '/api/analytics', { headers })).json();
    assert.equal(result.counts.published, 1);
    assert.equal(result.counts.scheduled, 1);
    assert.equal(result.daily.at(-1).count, 1);
    assert.equal(
      result.daily.reduce((sum, day) => sum + day.count, 0),
      1,
    );
    assert(!JSON.stringify(result).includes('credential'));
    console.log('Аналитика: пустые данные, изоляция, реальные даты отправки и счётчики проверены');
  } finally {
    if (userId) {
      await db.query('DELETE FROM posts WHERE user_id=$1', [userId]);
      await db.query('DELETE FROM channels WHERE user_id=$1', [userId]);
      await db.query('DELETE FROM users WHERE id=$1', [userId]);
    }
    await db.end();
  }
}
