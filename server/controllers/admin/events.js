import { Router } from 'express';

import { filters, list, where } from './helpers.js';
const router = Router();

router.get('/', async (req, res) => {
  const filter = filters(req);
  const conditions = where();
  if (filter.q) conditions.add('(u.email ILIKE ? OR e.action ILIKE ?)', '%' + filter.q + '%');
  await list(
    res,
    `SELECT e.id,e.action,e.resource,e.resource_id,e.details,e.created_at,u.email AS actor,count(*) OVER() AS total_count FROM admin_events e LEFT JOIN users u ON u.id=e.actor_id${conditions.sql()} ORDER BY e.id DESC`,
    conditions.values,
    filter.page,
  );
});
export default router;
