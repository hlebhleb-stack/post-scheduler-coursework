import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import pg from 'pg';
export async function checkWorker(root, env) {
  const db = new pg.Pool({ connectionString: env.DATABASE_URL });
  let userId;
  const run = () =>
    new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', './test/support/worker-stub.mjs', 'server/worker.js', '--once'],
        { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let logs = '';
      child.stdout.on('data', (d) => (logs += d));
      child.stderr.on('data', (d) => (logs += d));
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Worker timeout'));
      }, 15000);
      child.on('error', reject);
      child.on('exit', (code) => {
        clearTimeout(timer);
        code === 0 ? resolve() : reject(new Error('Worker failed: ' + logs));
      });
    });
  try {
    userId = (
      await db.query("INSERT INTO users(email,password_hash) VALUES ($1,'test') RETURNING id", [
        'worker-' + Date.now() + '@example.com',
      ])
    ).rows[0].id;
    const { encrypt } = await import('../server/lib/credentials.js');
    const previous = process.env.CHANNEL_KEY;
    process.env.CHANNEL_KEY = env.CHANNEL_KEY;
    let credential;
    try {
      credential = encrypt('123:worker-test');
    } finally {
      if (previous === undefined) delete process.env.CHANNEL_KEY;
      else process.env.CHANNEL_KEY = previous;
    }
    const channel = (
      await db.query(
        "INSERT INTO channels(user_id,name,platform,destination,credential) VALUES ($1,'Worker test','telegram','@worker_test',$2) RETURNING id",
        [userId, credential],
      )
    ).rows[0].id;
    const ids = {};
    for (const [body, status, time] of [
      ['sent', 'scheduled', -1],
      ['reject', 'scheduled', -1],
      ['lost', 'scheduled', -1],
      ['draft', 'draft', -1],
      ['future', 'scheduled', 60],
      ['stale', 'publishing', -10],
    ]) {
      ids[body] = (
        await db.query(
          "INSERT INTO posts(user_id,channel_id,body,status,scheduled_at,updated_at) VALUES ($1,$2,$3,$4,now()+$5*interval '1 minute',now()+$5*interval '1 minute') RETURNING id",
          [userId, channel, body, status, time],
        )
      ).rows[0].id;
    }
    // Два независимых процесса одновременно читают одну очередь PostgreSQL.
    await db.query('UPDATE users SET blocked=true WHERE id=$1', [userId]);
    await run();
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM posts WHERE user_id=$1 AND status='scheduled'",
          [userId],
        )
      ).rows[0].n,
      4,
    );
    await db.query('UPDATE users SET blocked=false WHERE id=$1', [userId]);
    await Promise.all([run(), run()]);
    const rows = (
      await db.query(
        `SELECT p.body,p.status,count(d.id)::int AS attempts,max(d.external_id) AS external_id
      FROM posts p LEFT JOIN deliveries d ON d.post_id=p.id WHERE p.user_id=$1 GROUP BY p.id`,
        [userId],
      )
    ).rows;
    const expected = {
      sent: ['published', 1],
      reject: ['failed', 1],
      lost: ['uncertain', 1],
      draft: ['draft', 0],
      future: ['scheduled', 0],
      stale: ['uncertain', 0],
    };
    for (const row of rows) {
      assert.equal(row.status, expected[row.body][0]);
      assert.equal(row.attempts, expected[row.body][1]);
      if (row.body === 'sent') assert.equal(row.external_id, 'worker-confirmed');
    }
    await run();
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM deliveries d JOIN posts p ON p.id=d.post_id WHERE p.user_id=$1',
          [userId],
        )
      ).rows[0].n,
      3,
    );
    console.log(
      'Очередь: два worker, сроки, черновики, подтверждение, отказ, потерянный ответ и отсутствие повторной отправки проверены',
    );
  } finally {
    if (userId) {
      await db.query('DELETE FROM posts WHERE user_id=$1', [userId]);
      await db.query('DELETE FROM channels WHERE user_id=$1', [userId]);
      await db.query('DELETE FROM users WHERE id=$1', [userId]);
    }
    await db.end();
  }
}
