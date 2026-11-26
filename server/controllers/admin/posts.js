import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { fields } from '../../middleware/validation.js';
import { error, take } from '../../lib/http.js';
import { filters, list, where, audit, mutation, validateId } from './helpers.js';
const router = Router();
router.param('id', validateId);

router.get('/', async (req, res) => {
  const filter = filters(req);
  const conditions = where();
  if (filter.q)
    conditions.add(
      '(u.email ILIKE ? OR c.name ILIKE ? OR p.body ILIKE ? OR p.youtube_title ILIKE ?)',
      '%' + filter.q + '%',
    );
  if (filter.platform) conditions.add('c.platform=?', filter.platform);
  if (filter.status === 'overdue')
    conditions.clauses.push("p.status='scheduled' AND p.scheduled_at<=now()");
  else if (filter.status === 'attention')
    conditions.clauses.push("p.status IN ('failed','uncertain')");
  else if (filter.status) conditions.add('p.status=?', filter.status);
  await list(
    res,
    `SELECT p.id,p.status,p.scheduled_at,p.youtube_title,left(p.body,160) AS body,u.email AS owner,c.name AS channel_name,c.platform,u.blocked AS owner_blocked,
 (SELECT d.error FROM deliveries d WHERE d.post_id=p.id ORDER BY d.id DESC LIMIT 1) AS error,count(*) OVER() AS total_count
 FROM posts p JOIN users u ON u.id=p.user_id JOIN channels c ON c.id=p.channel_id${conditions.sql()} ORDER BY p.scheduled_at DESC,p.id DESC`,
    conditions.values,
    filter.page,
  );
});

router.get('/:id', async (req, res) => {
  const post = take(
    await db.query(
      `SELECT p.id,p.status,p.scheduled_at,p.youtube_title,p.youtube_privacy,p.youtube_made_for_kids,p.body,p.silent,p.protect_content,c.name AS channel_name,c.platform,u.email AS owner,u.blocked AS owner_blocked FROM posts p JOIN channels c ON c.id=p.channel_id JOIN users u ON u.id=p.user_id WHERE p.id=$1`,
      [req.params.id],
    ),
  );
  const { rows: attachments } = await db.query(
    'SELECT id,name,mime,kind,size FROM attachments WHERE post_id=$1 ORDER BY position,id',
    [post.id],
  );
  const { rows: deliveries } = await db.query(
    'SELECT attempted_at,completed_at,external_id,error FROM deliveries WHERE post_id=$1 ORDER BY id DESC',
    [post.id],
  );
  res.json({ ...post, attachments, deliveries });
});

router.patch(
  '/:id',
  fields(
    z.discriminatedUnion('action', [
      z.object({ action: z.literal('cancel') }),
      z.object({ action: z.literal('reschedule'), scheduled_at: z.iso.datetime() }),
    ]),
  ),
  async (req, res) => {
    const id = Number(req.params.id);
    res.json(
      await mutation(req, async (client) => {
        const post = take(
          await client.query('SELECT id,status,scheduled_at FROM posts WHERE id=$1 FOR UPDATE', [
            id,
          ]),
        );
        if (!['draft', 'scheduled', 'failed'].includes(post.status))
          throw error(
            409,
            'Нельзя менять отправляемую, опубликованную публикацию или отправку с неизвестным результатом',
          );
        if (req.input.action === 'reschedule' && Date.parse(req.input.scheduled_at) <= Date.now())
          throw error(400, 'Выберите время в будущем');
        const status = req.input.action === 'cancel' ? 'draft' : 'scheduled';
        const at = req.input.action === 'reschedule' ? req.input.scheduled_at : post.scheduled_at;
        await client.query(
          'UPDATE posts SET status=$1,scheduled_at=$2,updated_at=now() WHERE id=$3',
          [status, at, id],
        );
        await audit(client, req.userId, 'post.' + req.input.action, 'post', id, {
          before: post.status,
          after: status,
          scheduled_at: at,
        });
        return { id, status, scheduled_at: at };
      }),
    );
  },
);
export default router;
