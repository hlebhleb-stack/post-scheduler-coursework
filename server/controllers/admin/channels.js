import { Router } from 'express';

import { filters, list, where, validateId } from './helpers.js';
const router = Router();
router.param('id', validateId);

router.get('/', async (req, res) => {
  const filter = filters(req);
  const conditions = where();
  if (filter.q)
    conditions.add(
      '(c.name ILIKE ? OR u.email ILIKE ? OR c.destination ILIKE ?)',
      '%' + filter.q + '%',
    );
  if (filter.platform) conditions.add('c.platform=?', filter.platform);
  await list(
    res,
    `SELECT c.id,c.name,c.platform,c.destination,u.email AS owner,
 (SELECT count(*)::int FROM posts p WHERE p.channel_id=c.id) AS posts,
 (SELECT count(*)::int FROM posts p WHERE p.channel_id=c.id AND p.status='scheduled') AS scheduled,
 count(*) OVER() AS total_count FROM channels c JOIN users u ON u.id=c.user_id${conditions.sql()} ORDER BY c.id DESC`,
    conditions.values,
    filter.page,
  );
});
export default router;
