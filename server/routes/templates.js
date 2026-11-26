import { Router } from 'express';
import { z } from 'zod';
import { Template } from '../models/template.js';

const router = Router();
const fields = z.object({ name: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(4096) });
const attributes = ['id', 'name', 'body'];
const publicData = ({ id, name, body }) => ({ id, name, body });
const issue = (status, message) => Object.assign(new Error(message), { status });
function data(req) {
  const result = fields.safeParse(req.body);
  if (!result.success) throw issue(400, 'Проверь название и текст шаблона');
  return result.data;
}
function owner(req) {
  const id = Number(req.params.id);
  if (!/^[1-9]\d*$/.test(req.params.id) || id > 2147483647) throw issue(404, 'Запись не найдена');
  return { id, user_id: req.userId };
}

router.get('/', async (req, res) => {
  res.json(await Template.findAll({ attributes, where: { user_id: req.userId }, order: [['id', 'DESC']] }));
});
router.get('/:id', async (req, res) => {
  const record = await Template.findOne({ attributes, where: owner(req) });
  if (!record) throw issue(404, 'Запись не найдена');
  res.json(record);
});
router.post('/', async (req, res) => {
  const record = await Template.create({ ...data(req), user_id: req.userId });
  res.status(201).json(publicData(record));
});
router.put('/:id', async (req, res) => {
  const [count, [record]] = await Template.update(data(req), { where: owner(req), returning: attributes });
  if (!count) throw issue(404, 'Запись не найдена');
  res.json(publicData(record));
});
router.delete('/:id', async (req, res) => {
  if (!await Template.destroy({ where: owner(req) })) throw issue(404, 'Запись не найдена');
  res.sendStatus(204);
});
export default router;
