import { Router } from 'express';
import { z } from 'zod';
import { db, transaction } from '../db.js';
import { error, take } from '../lib/http.js';
import { fields } from '../middleware/validation.js';
const router = Router();
router.param('id', (req,res,next,id) => {
  if (!/^[1-9]\d*$/.test(id) || Number(id)>2147483647) return next(error(404,'Запись не найдена'));
  next();
});
import { access } from '../middleware/rate-limit.js';
import { encrypt, verifyChannel } from '../providers.js';
const name = z.string().trim().min(1).max(80);
const channel = z.object({
  name, platform: z.enum(['telegram', 'instagram']),
  destination: z.string().trim().min(1).max(80),
  token: z.string().trim().min(1).max(2048).optional(),
}).refine(({ platform, destination }) => platform === 'telegram'
  ? /^(?:@[a-zA-Z0-9_]{5,32}|-100\d{5,20})$/.test(destination) : /^\d{5,30}$/.test(destination));

const channelColumns = 'id,name,platform,destination';
router.get('', async (req, res) => {
  res.json((await db.query(`SELECT ${channelColumns} FROM channels WHERE user_id=$1 ORDER BY id DESC`, [req.userId])).rows);
});
router.get('/:id', async (req, res) => {
  res.json(take(await db.query(`SELECT ${channelColumns} FROM channels WHERE id=$1 AND user_id=$2`, [req.params.id, req.userId])));
});
router.post('', access, fields(channel), async (req, res) => {
  const { name, platform, destination, token } = req.input;
  if (!token) throw error(400, 'Для подключения нужен токен');
  const verified = await verifyChannel(platform, destination, token);
  res.status(201).json(take(await db.query(
    `INSERT INTO channels(user_id,name,platform,destination,credential) VALUES ($1,$2,$3,$4,$5) RETURNING ${channelColumns}`,
    [req.userId, name, platform, verified, encrypt(token)],
  )));
});
router.put('/:id', access, fields(channel), async (req, res) => {
  const { name, platform, destination, token } = req.input;
  const current = take(await db.query(`SELECT ${channelColumns} FROM channels WHERE id=$1 AND user_id=$2`, [req.params.id, req.userId]));
  if (current.platform !== platform || current.destination !== destination) {
    throw error(409, 'Для другого получателя создай отдельный канал');
  }
  if (token) await verifyChannel(platform, destination, token);
  res.json(take(await db.query(
    `UPDATE channels SET name=$1,credential=COALESCE($2,credential) WHERE id=$3 AND user_id=$4 RETURNING ${channelColumns}`,
    [name, token ? encrypt(token) : null, req.params.id, req.userId],
  )));
});
router.delete('/:id', async (req, res) => {
  take(await db.query('DELETE FROM channels WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.userId]));
  res.sendStatus(204);
});

export default router;
