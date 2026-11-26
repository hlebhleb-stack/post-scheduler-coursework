import { Router } from 'express';
import { z } from 'zod';

import { fields } from '../../middleware/validation.js';
import { error, take } from '../../lib/http.js';
import { filters, list, where, audit, mutation, validateId } from './helpers.js';
const router = Router();
router.param('id', validateId);

router.get('/', async (req, res) => {
  const filter = filters(req);
  const conditions = where();
  if (filter.q) conditions.add('u.email ILIKE ?', '%' + filter.q + '%');
  if (filter.role) conditions.add('u.role=?', filter.role);
  if (filter.access) conditions.add('u.blocked=?', filter.access === 'blocked');
  await list(
    res,
    `SELECT u.id,u.email,u.role,u.blocked,
 (SELECT count(*)::int FROM channels c WHERE c.user_id=u.id) AS channels,
 (SELECT count(*)::int FROM posts p WHERE p.user_id=u.id) AS posts,
 (SELECT count(*)::int FROM attachments a WHERE a.user_id=u.id AND a.post_id IS NULL) AS media,
 count(*) OVER() AS total_count FROM users u${conditions.sql()} ORDER BY u.id DESC`,
    conditions.values,
    filter.page,
  );
});

router.patch(
  '/:id',
  fields(
    z
      .object({ role: z.enum(['user', 'admin']).optional(), blocked: z.boolean().optional() })
      .refine((v) => v.role !== undefined || v.blocked !== undefined),
  ),
  async (req, res) => {
    const id = Number(req.params.id);
    res.json(
      await mutation(req, async (client) => {
        const current = take(
          await client.query('SELECT id,email,role,blocked FROM users WHERE id=$1 FOR UPDATE', [
            id,
          ]),
        );
        const next = { ...current, ...req.input };
        if (id === req.userId && (next.blocked || next.role !== 'admin'))
          throw error(409, 'Нельзя заблокировать себя или снять собственные права администратора');
        if (
          current.role === 'admin' &&
          !current.blocked &&
          (next.role !== 'admin' || next.blocked)
        ) {
          const {
            rows: [count],
          } = await client.query(
            "SELECT count(*)::int AS n FROM users WHERE role='admin' AND NOT blocked",
          );
          if (count.n <= 1) throw error(409, 'Должен остаться хотя бы один активный администратор');
        }
        await client.query('UPDATE users SET role=$1,blocked=$2 WHERE id=$3', [
          next.role,
          next.blocked,
          id,
        ]);
        await audit(client, req.userId, 'user.update', 'user', id, {
          before: { role: current.role, blocked: current.blocked },
          after: { role: next.role, blocked: next.blocked },
        });
        return next;
      }),
    );
  },
);
export default router;
