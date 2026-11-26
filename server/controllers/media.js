import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { Media } from '../models/media.js';
import { postUpload, mediaKind, maxUploadBytes, uploadName } from '../lib/uploads.js';
import { error } from '../lib/http.js';
import { fields } from '../middleware/validation.js';
const router = Router();
const attributes = ['id', 'name', 'mime', 'kind', 'size'];
router.param('id', (req, res, next, id) => {
  if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) return next(error(404, 'Файл не найден'));
  next();
});
const owner = (req) => ({ id: Number(req.params.id), user_id: req.userId, post_id: null });
router.get('/', async (req, res) =>
  res.json(
    await Media.findAll({
      attributes,
      where: { user_id: req.userId, post_id: null },
      order: [['id', 'DESC']],
    }),
  ),
);
router.get('/:id', async (req, res) => {
  const record = await Media.findOne({ attributes, where: owner(req) });
  if (!record) throw error(404, 'Файл не найден');
  res.json(record);
});
router.post('/', postUpload, async (req, res) => {
  const files = req.files || [];
  if (!files.length) throw error(400, 'Выберите файлы для загрузки');
  if (
    files.reduce((sum, file) => sum + file.size, 0) > maxUploadBytes ||
    files.some(
      (file) => !file.size || (mediaKind(file) === 'photo' && file.size > 10 * 1024 * 1024),
    )
  )
    throw error(400, 'До 50 МБ за загрузку, фото до 10 МБ, пустые файлы не поддерживаются');
  const records = await Media.bulkCreate(
    await Promise.all(
      files.map(async (file) => ({
        user_id: req.userId,
        post_id: null,
        name: uploadName(file.originalname),
        mime: file.mimetype,
        kind: mediaKind(file),
        size: file.size,
        content: await readFile(file.path),
        position: 0,
      })),
    ),
    { returning: true },
  );
  res
    .status(201)
    .json(records.map((record) => Object.fromEntries(attributes.map((key) => [key, record[key]]))));
});
router.put(
  '/:id',
  fields(z.object({ name: z.string().trim().min(1).max(255) })),
  async (req, res) => {
    const [count, records] = await Media.update(
      { name: req.input.name },
      { where: owner(req), returning: attributes },
    );
    if (!count) throw error(404, 'Файл не найден');
    res.json(records[0]);
  },
);
router.delete('/:id', async (req, res) => {
  if (!(await Media.destroy({ where: owner(req) }))) throw error(404, 'Файл не найден');
  res.sendStatus(204);
});
export default router;
