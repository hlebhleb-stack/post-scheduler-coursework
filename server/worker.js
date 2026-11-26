import { setTimeout as delay } from 'node:timers/promises';
import { db, transaction } from './db.js';
import { publish, ProviderError } from './providers.js';

let running = true;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { running = false; });

async function claim() {
  return transaction(async client => {
    await client.query(`UPDATE posts SET status='uncertain',updated_at=now()
      WHERE status='publishing' AND updated_at < now() - interval '5 minutes'`);
    const { rows: [post] } = await client.query(`
      SELECT p.id,p.body,p.image_url,p.telegram_html,p.silent,p.protect_content,c.platform,c.destination,c.credential
      FROM posts p JOIN channels c ON c.id=p.channel_id
      WHERE p.status='scheduled' AND p.scheduled_at<=now()
      ORDER BY p.scheduled_at,p.id LIMIT 1 FOR UPDATE OF p SKIP LOCKED
    `);
    if (!post) return null;
    await client.query("UPDATE posts SET status='publishing',updated_at=now() WHERE id=$1", [post.id]);
    const { rows: [attempt] } = await client.query('INSERT INTO deliveries(post_id) VALUES ($1) RETURNING id', [post.id]);
    return { ...post, attemptId: attempt.id };
  });
}

async function processPost(post) {
  let externalId = null;
  let status = 'published';
  let message = null;
  try {
    const { rows: attachments } = await db.query('SELECT * FROM attachments WHERE post_id=$1 ORDER BY position,id', [post.id]);
    externalId = await publish({ ...post, attachments });
  } catch (error) {
    status = error instanceof ProviderError && error.definitive ? 'failed' : 'uncertain';
    message = error instanceof ProviderError ? error.message : 'Не удалось подтвердить результат отправки';
  }
  await transaction(async client => {
    await client.query('UPDATE deliveries SET completed_at=now(),external_id=$1,error=$2 WHERE id=$3', [externalId, message, post.attemptId]);
    await client.query("UPDATE posts SET status=$1,updated_at=now() WHERE id=$2 AND status='publishing'", [status, post.id]);
  });
}

try {
  do {
    const post = await claim();
    if (post) await processPost(post);
    else if (process.argv.includes('--once')) break;
    else if (running) await delay(5000);
  } while (running);
} finally {
  await db.end();
}
