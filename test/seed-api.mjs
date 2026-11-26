import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import bcrypt from 'bcryptjs';
export async function checkSeed(root, env) {
  const suffix = Date.now();
  const emails = [`seed-user-${suffix}@example.com`, `seed-admin-${suffix}@example.com`];
  const passwords = ['seed-user-password-123', 'seed-admin-password-456'];
  const db = new pg.Pool({ connectionString: env.DATABASE_URL });
  try {
    const seedEnv = {
      ...env,
      SEED_USER_EMAIL: emails[0],
      SEED_ADMIN_EMAIL: emails[1],
      SEED_USER_PASSWORD: passwords[0],
      SEED_ADMIN_PASSWORD: passwords[1],
      SEED_TELEGRAM_DESTINATION: '@postman_test',
      SEED_TELEGRAM_TOKEN: '123:postman-test',
    };
    for (let i = 0; i < 2; i++) {
      const run = spawnSync(
        process.execPath,
        ['--import', './test/support/telegram-postman-stub.mjs', 'server/scripts/seed.js'],
        { cwd: root, env: seedEnv, encoding: 'utf8', timeout: 15000 },
      );
      assert.equal(run.status, 0, run.stderr);
      assert(!run.stdout.includes(passwords[0]));
      assert(!run.stdout.includes(seedEnv.SEED_TELEGRAM_TOKEN));
    }
    const users = (
      await db.query('SELECT id,email,role,password_hash FROM users WHERE email=ANY($1)', [emails])
    ).rows;
    assert.equal(users.length, 2);
    for (const [index, email] of emails.entries()) {
      const user = users.find((user) => user.email === email);
      assert.equal(user.role, index ? 'admin' : 'user');
      assert(await bcrypt.compare(passwords[index], user.password_hash));
    }
    const ids = users.map((user) => user.id);
    assert.equal(
      (await db.query('SELECT id FROM channels WHERE user_id=ANY($1)', [ids])).rowCount,
      1,
    );
    const posts = (await db.query('SELECT status FROM posts WHERE user_id=ANY($1)', [ids])).rows;
    assert.equal(posts.length, 1);
    assert.equal(posts[0].status, 'draft');
    assert.equal(
      (
        await db.query('SELECT id FROM attachments WHERE user_id=ANY($1) AND post_id IS NULL', [
          ids,
        ])
      ).rowCount,
      1,
    );
    console.log(
      'Seed: пользователь/администратор, хеши паролей, медиатека, проверенный канал и черновик без дублей проверены',
    );
  } finally {
    await db.query(
      'DELETE FROM attachments WHERE user_id IN (SELECT id FROM users WHERE email=ANY($1))',
      [emails],
    );
    await db.query(
      'DELETE FROM posts WHERE user_id IN (SELECT id FROM users WHERE email=ANY($1))',
      [emails],
    );
    await db.query(
      'DELETE FROM channels WHERE user_id IN (SELECT id FROM users WHERE email=ANY($1))',
      [emails],
    );
    await db.query('DELETE FROM users WHERE email=ANY($1)', [emails]);
    await db.end();
  }
}
