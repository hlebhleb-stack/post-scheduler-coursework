import { Router } from 'express';

import { take } from '../../lib/http.js';
import { filters, list, where, audit, mutation, validateId } from './helpers.js';
const router = Router();
router.param('id', validateId);

router.get('/', async (req, res) => {
  const filter = filters(req);
  const conditions = where();
  conditions.clauses.push('a.post_id IS NULL');
  if (filter.q) conditions.add('(a.name ILIKE ? OR u.email ILIKE ?)', '%' + filter.q + '%');
  await list(
    res,
    `SELECT a.id,a.name,a.kind,a.mime,a.size,u.email AS owner,count(*) OVER() AS total_count FROM attachments a JOIN users u ON u.id=a.user_id${conditions.sql()} ORDER BY a.id DESC`,
    conditions.values,
    filter.page,
  );
});

router.delete('/:id', async (req, res) => {
  await mutation(req, async (client) => {
    const file = take(
      await client.query(
        'DELETE FROM attachments WHERE id=$1 AND post_id IS NULL RETURNING id,size',
        [req.params.id],
      ),
    );
    await audit(client, req.userId, 'media.delete', 'media', file.id, { size: file.size });
  });
  res.sendStatus(204);
});
export default router;
