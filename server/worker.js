import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { db, transaction } from './db.js';
import { publish } from './providers/index.js';
import { ProviderError } from './lib/provider-error.js';

async function claimNextPost() {
  return transaction(async (client) => {
    await client.query(`UPDATE posts SET status='uncertain',updated_at=now()
      WHERE status='publishing' AND updated_at < now() - interval '5 minutes'`);
    // Блокировка строки исключает одновременную отправку двумя обработчиками.
    const {
      rows: [post],
    } = await client.query(`
      SELECT p.id,p.body,p.youtube_title,p.youtube_privacy,p.youtube_made_for_kids,p.telegram_html,p.silent,p.protect_content,c.platform,c.destination,c.credential
      FROM posts p JOIN channels c ON c.id=p.channel_id JOIN users u ON u.id=p.user_id
      WHERE NOT u.blocked AND p.status='scheduled' AND p.scheduled_at<=now()
      ORDER BY p.scheduled_at,p.id LIMIT 1 FOR UPDATE OF p SKIP LOCKED
    `);
    if (!post) return null;
    await client.query("UPDATE posts SET status='publishing',updated_at=now() WHERE id=$1", [
      post.id,
    ]);
    const {
      rows: [attempt],
    } = await client.query('INSERT INTO deliveries(post_id) VALUES ($1) RETURNING id', [post.id]);
    return { ...post, attemptId: attempt.id };
  });
}

async function processPost(post) {
  let externalId = null;
  let status = 'published';
  let message = null;
  try {
    const { rows: attachments } = await db.query(
      'SELECT * FROM attachments WHERE post_id=$1 ORDER BY position,id',
      [post.id],
    );
    externalId = await publish({ ...post, attachments });
  } catch (error) {
    // При неизвестном результате повторная отправка может создать дубль.
    status = error instanceof ProviderError && error.definitive ? 'failed' : 'uncertain';
    message =
      error instanceof ProviderError ? error.message : 'Не удалось подтвердить результат отправки';
  }
  await transaction(async (client) => {
    await client.query(
      'UPDATE deliveries SET completed_at=now(),external_id=$1,error=$2 WHERE id=$3',
      [externalId, message, post.attemptId],
    );
    await client.query(
      "UPDATE posts SET status=$1,updated_at=now() WHERE id=$2 AND status='publishing'",
      [status, post.id],
    );
  });
  console.log(JSON.stringify({ postId: post.id, status, externalId }));
}

export async function runWorker({ once = false, signal } = {}) {
  while (!signal?.aborted) {
    try {
      const post = await claimNextPost();
      if (post) {
        await processPost(post);
        continue;
      }
      if (once) return;
    } catch (error) {
      if (once) throw error;
      console.error('Ошибка обработки очереди', error.code || error.name);
    }
    try {
      await delay(5000, undefined, { signal });
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => controller.abort());
  try {
    await runWorker({ once: process.argv.includes('--once'), signal: controller.signal });
  } finally {
    await db.end();
  }
}
