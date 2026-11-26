import { Router } from 'express';

import { db } from '../../db.js';

const router = Router();

router.get('/', async (req, res) => {
  const {
    rows: [counts],
  } = await db.query(`SELECT
  (SELECT count(*)::int FROM users) AS users,
  (SELECT count(*)::int FROM users WHERE blocked) AS blocked,
  (SELECT count(*)::int FROM channels) AS channels,
  (SELECT count(*)::int FROM attachments WHERE post_id IS NULL) AS media,
  (SELECT coalesce(sum(size),0)::text FROM attachments) AS storage_bytes,
  (SELECT count(*)::int FROM posts) AS posts,
  (SELECT count(*)::int FROM posts WHERE status='scheduled') AS scheduled,
  (SELECT count(*)::int FROM posts WHERE status='scheduled' AND scheduled_at<=now()) AS overdue,
  (SELECT count(*)::int FROM posts WHERE status IN ('failed','uncertain')) AS failed`);
  const { rows: problems } = await db.query(`SELECT p.id,p.status,p.scheduled_at,c.platform,
  (SELECT d.error FROM deliveries d WHERE d.post_id=p.id ORDER BY d.id DESC LIMIT 1) AS error
  FROM posts p JOIN channels c ON c.id=p.channel_id WHERE p.status IN ('failed','uncertain') OR (p.status='scheduled' AND p.scheduled_at<=now()) ORDER BY p.scheduled_at,p.id LIMIT 50`);
  res.json({ counts, problems });
});
export default router;
