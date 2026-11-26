import { Router } from 'express';
import { db } from '../db.js';
const router = Router();

router.get('/', async (req, res) => {
  // День подтверждённой отправки определяется по истории, а не по запланированному времени.
  const { rows: daily } = await db.query(
    `WITH sent AS (
    SELECT p.id,max(d.completed_at) AS sent_at FROM posts p
    JOIN deliveries d ON d.post_id=p.id AND d.external_id IS NOT NULL
    WHERE p.user_id=$1 AND p.status='published' GROUP BY p.id
  ), dates AS (
    SELECT generate_series((now() AT TIME ZONE 'Europe/Minsk')::date-370,
      (now() AT TIME ZONE 'Europe/Minsk')::date,'1 day')::date AS day
  ) SELECT to_char(dates.day,'YYYY-MM-DD') AS date,
    count(sent.id)::int AS count
    FROM dates LEFT JOIN sent ON (sent.sent_at AT TIME ZONE 'Europe/Minsk')::date=dates.day
    GROUP BY dates.day ORDER BY dates.day`,
    [req.userId],
  );
  const {
    rows: [counts],
  } = await db.query(
    `SELECT count(*) FILTER (WHERE status='scheduled')::int AS scheduled,
    count(*) FILTER (WHERE status='published')::int AS published,
    count(*) FILTER (WHERE status IN ('failed','uncertain'))::int AS failed
    FROM posts WHERE user_id=$1`,
    [req.userId],
  );
  res.json({ daily, counts, timezone: 'Europe/Minsk' });
});
export default router;
