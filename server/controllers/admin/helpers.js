import { z } from 'zod';
import { db, transaction } from '../../db.js';
import { error } from '../../lib/http.js';

const query = z.object({
  q: z.string().trim().max(120).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  role: z.enum(['', 'user', 'admin']).default(''),
  access: z.enum(['', 'active', 'blocked']).default(''),
  platform: z.enum(['', 'telegram', 'youtube']).default(''),
  status: z
    .enum([
      '',
      'draft',
      'scheduled',
      'publishing',
      'published',
      'failed',
      'uncertain',
      'overdue',
      'attention',
    ])
    .default(''),
});

export function filters(req) {
  const result = query.safeParse(req.query);
  if (!result.success) throw error(400, 'Некорректные фильтры');
  return result.data;
}

export async function list(res, sql, params, page) {
  const limit = 20;
  const { rows } = await db.query(
    sql + ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2),
    [...params, limit, (page - 1) * limit],
  );
  res.json({
    items: rows.map(({ total_count, ...row }) => row),
    total: Number(rows[0]?.total_count || 0),
    page,
    limit,
  });
}

export function where() {
  const values = [];
  const clauses = [];
  return {
    values,
    clauses,
    add(sql, value) {
      values.push(value);
      clauses.push(sql.replaceAll('?', '$' + values.length));
    },
    sql() {
      return clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
    },
  };
}

export async function audit(client, actor, action, resource, id, details = {}) {
  await client.query(
    'INSERT INTO admin_events(actor_id,action,resource,resource_id,details) VALUES ($1,$2,$3,$4,$5)',
    [actor, action, resource, id, details],
  );
}

export async function mutation(req, action) {
  return transaction(async (client) => {
    await client.query("SELECT id FROM users WHERE role='admin' ORDER BY id FOR UPDATE");
    const {
      rows: [actor],
    } = await client.query('SELECT role,blocked FROM users WHERE id=$1', [req.userId]);
    if (actor?.role !== 'admin' || actor.blocked) throw error(403, 'Нет прав администратора');
    return action(client);
  });
}

export function validateId(req, res, next, id) {
  if (/^\d+$/.test(id) && Number(id) > 0 && Number(id) <= 2147483647) return next();
  next(error(404, 'Запись не найдена'));
}
