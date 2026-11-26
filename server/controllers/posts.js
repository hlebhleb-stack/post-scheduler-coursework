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
import { readFile } from 'node:fs/promises';
import { postUpload, mediaKind, telegramText, maxUploadBytes, uploadName } from '../media.js';
const post = z.object({
  channel_id: z.number().int().positive().max(2147483647),
  body: z.string().trim().max(4096),
  telegram_html: z.string().max(50000).nullish(),
  silent: z.boolean().default(false),
  protect_content: z.boolean().default(false),
  media_ids: z.array(z.number().int().positive()).max(10).default([]),
  attachment_ids: z.array(z.number().int().positive()).max(10).optional(),
  image_url: z.url({ protocol: /^https$/ }).max(2048).nullish(),
  scheduled_at: z.iso.datetime(),
  status: z.enum(['draft', 'scheduled']),
});
const selectPosts = `SELECT p.*,c.name AS channel_name,c.platform,
  COALESCE((SELECT json_agg(json_build_object('id',a.id,'name',a.name,'mime',a.mime,'kind',a.kind,'size',a.size) ORDER BY a.position,a.id)
    FROM attachments a WHERE a.post_id=p.id), '[]') AS attachments
  FROM posts p JOIN channels c ON c.id=p.channel_id`;
router.get('', async (req, res) => {
  res.json((await db.query(`${selectPosts} WHERE p.user_id=$1 ORDER BY p.scheduled_at DESC,p.id DESC`, [req.userId])).rows);
});
router.get('/:id', async (req, res) => {
  const post = take(await db.query(`${selectPosts} WHERE p.id=$1 AND p.user_id=$2`, [req.params.id, req.userId]));
  const { rows } = await db.query('SELECT attempted_at,completed_at,external_id,error FROM deliveries WHERE post_id=$1 ORDER BY id DESC', [post.id]);
  res.json({ ...post, deliveries: rows });
});
export const attachments = Router();
attachments.param('id', (req,res,next,id) => {
  if (!/^[1-9]\d*$/.test(id) || Number(id)>2147483647) return next(error(404,'Запись не найдена'));
  next();
});
attachments.get('/:id', async (req, res) => {
  const file = take(await db.query(`SELECT a.* FROM attachments a LEFT JOIN posts p ON p.id=a.post_id
    WHERE a.id=$1 AND (p.user_id=$2 OR (a.post_id IS NULL AND a.user_id=$2))`, [req.params.id, req.userId]));
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  res.set('Cache-Control', 'private, no-store');
  res.send(file.content);
});
async function savePost(req, res) {
  const { channel_id, body, image_url, scheduled_at, status, silent, protect_content } = req.input;
  const result = await transaction(async client => {
    const channel = take(await client.query('SELECT platform FROM channels WHERE id=$1 AND user_id=$2 FOR KEY SHARE', [channel_id, req.userId]));
    if (status === 'scheduled' && Date.parse(scheduled_at) <= Date.now()) {
      throw error(400, 'Время публикации должно быть в будущем');
    }
    if (channel.platform === 'instagram' && (!image_url || body.length > 2200)) {
      throw error(400, 'Instagram требует HTTPS-ссылку на фото и подпись до 2200 символов');
    }
    let current;
    if (req.params.id) {
      current = take(await client.query('SELECT status FROM posts WHERE id=$1 AND user_id=$2 FOR UPDATE', [req.params.id, req.userId]));
      if (['publishing','published','uncertain'].includes(current.status)) {
        throw error(409, 'Текущий статус не позволяет изменить или повторно отправить публикацию');
      }
    }
    const existing = current ? (await client.query('SELECT id,kind,size FROM attachments WHERE post_id=$1 ORDER BY position,id', [req.params.id])).rows : [];
    const keepIds = req.input.attachment_ids || existing.map(file => file.id);
    if (keepIds.some(id => !existing.some(file => file.id === id)) || new Set(keepIds).size !== keepIds.length) throw error(400, 'Недоступное вложение');
    const kept = existing.filter(file => keepIds.includes(file.id));
    const files = (req.files || []).map(file => ({ ...file, kind: mediaKind(file) }));
    const mediaIds = req.input.media_ids;
    if (new Set(mediaIds).size !== mediaIds.length) throw error(400,'Файл выбран несколько раз');
    const {rows:library} = await client.query(`SELECT id,name,mime,kind,content,size FROM attachments
      WHERE id=ANY($1::int[]) AND user_id=$2 AND post_id IS NULL FOR SHARE`,[mediaIds,req.userId]);
    if (library.length !== mediaIds.length) throw error(404,'Файл медиатеки не найден');
    const selected = mediaIds.map(id=>library.find(file=>file.id===id));
    const all = [...kept, ...files, ...selected];
    if (all.length > 10 || all.reduce((sum, file) => sum + file.size, 0) > maxUploadBytes) throw error(400, 'До 10 вложений общим размером до 50 МБ');
    if (files.some(file => file.size === 0 || (file.kind === 'photo' && file.size > 10 * 1024 * 1024))) throw error(400, 'Фото — до 10 МБ. Пустые файлы не поддерживаются');
    if (!body && !all.length) throw error(400, 'Добавь текст или вложение');
    if (all.length && channel.platform !== 'telegram') throw error(400, 'Загрузка файлов доступна для Telegram');
    if (all.length && body.length > 1024) throw error(400, 'Подпись к вложению — до 1024 символов');
    if (all.length > 1) {
      const family = item => ['photo','video'].includes(item.kind) ? 'visual' : item.kind;
      if (all.some(item => family(item) !== family(all[0])) || all.some(item => item.kind === 'animation')) throw error(400, 'Альбом может содержать фото и видео вместе, только музыку или только документы. GIF отправляется отдельно');
    }
    const html = channel.platform === 'telegram' ? telegramText(req.input.telegram_html) || null : null;
    const values = [channel_id, body, channel.platform === 'instagram' ? image_url : null, scheduled_at, status, req.userId, html, silent, protect_content];
    const saved = current ? await client.query(
      'UPDATE posts SET channel_id=$1,body=$2,image_url=$3,scheduled_at=$4,status=$5,telegram_html=$7,silent=$8,protect_content=$9,updated_at=now() WHERE user_id=$6 AND id=$10 RETURNING id', [...values, req.params.id],
    ) : await client.query(
      'INSERT INTO posts(channel_id,body,image_url,scheduled_at,status,user_id,telegram_html,silent,protect_content) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id', values,
    );
    const postId = saved.rows[0].id;
    await client.query('DELETE FROM attachments WHERE post_id=$1 AND NOT (id=ANY($2::int[]))', [postId, keepIds]);
    for (const [index, file] of files.entries()) {
      await client.query('INSERT INTO attachments(post_id,name,mime,kind,content,size,position) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [postId, uploadName(file.originalname), file.mimetype, file.kind, await readFile(file.path), file.size, kept.length + index]);
    }
    for (const [index,file] of selected.entries()) {
      await client.query('INSERT INTO attachments(post_id,name,mime,kind,content,size,position) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [postId,file.name,file.mime,file.kind,file.content,file.size,kept.length+files.length+index]);
    }
    return saved;
  });
  res.status(req.params.id ? 200 : 201).json(take(result));
}
router.post('', postUpload, fields(post), savePost);
router.put('/:id', postUpload, fields(post), savePost);
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  await transaction(async client => {
    const current = take(await client.query('SELECT status FROM posts WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, req.userId]));
    if (current.status === 'publishing') throw error(409, 'Дождись завершения отправки');
    await client.query('DELETE FROM posts WHERE id=$1', [id]);
  });
  res.sendStatus(204);
});
export default router;
