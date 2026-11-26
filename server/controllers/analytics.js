import { Router } from 'express';
import { db } from '../db.js';
const router = Router();

router.get('/', async (req,res) => {
  // День подтверждённой отправки определяется по истории, а не по запланированному времени.
  const {rows:daily} = await db.query(`WITH sent AS (
    SELECT p.id,p.channel_id,max(d.completed_at) AS sent_at FROM posts p
    JOIN deliveries d ON d.post_id=p.id AND d.external_id IS NOT NULL
    WHERE p.user_id=$1 AND p.status='published' GROUP BY p.id
  ), dates AS (
    SELECT generate_series((now() AT TIME ZONE 'Europe/Minsk')::date-370,
      (now() AT TIME ZONE 'Europe/Minsk')::date,'1 day')::date AS day
  ) SELECT to_char(dates.day,'YYYY-MM-DD') AS date,
    count(sent.id)::int AS count
    FROM dates LEFT JOIN sent ON (sent.sent_at AT TIME ZONE 'Europe/Minsk')::date=dates.day
    GROUP BY dates.day ORDER BY dates.day`,[req.userId]);
  const {rows:[counts]} = await db.query(`SELECT count(*)::int AS total,
    count(*) FILTER (WHERE status='draft')::int AS draft,
    count(*) FILTER (WHERE status='scheduled')::int AS scheduled,
    count(*) FILTER (WHERE status='published')::int AS published,
    count(*) FILTER (WHERE status IN ('failed','uncertain'))::int AS failed,
    count(*) FILTER (WHERE status='publishing')::int AS publishing
    FROM posts WHERE user_id=$1`,[req.userId]);
  const {rows:channels} = await db.query(`SELECT c.id,c.name,c.platform,
    count(p.id) FILTER (WHERE p.status='published')::int AS published,
    count(p.id) FILTER (WHERE p.status='scheduled')::int AS scheduled
    FROM channels c LEFT JOIN posts p ON p.channel_id=c.id
    WHERE c.user_id=$1 GROUP BY c.id ORDER BY published DESC,c.name`,[req.userId]);
  const {rows:upcoming} = await db.query(`SELECT p.id,p.body,p.scheduled_at,c.name AS channel_name,
    (SELECT a.name FROM attachments a WHERE a.post_id=p.id ORDER BY a.position,a.id LIMIT 1) AS attachment_name
    FROM posts p JOIN channels c ON c.id=p.channel_id WHERE p.user_id=$1 AND p.status='scheduled'
    ORDER BY p.scheduled_at,p.id LIMIT 4`,[req.userId]);
  res.json({daily,counts,channels,upcoming,timezone:'Europe/Minsk'});
});
export default router;
