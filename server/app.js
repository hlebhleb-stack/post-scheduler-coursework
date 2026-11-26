import express from 'express';
import { readFile } from 'node:fs/promises';
import { postUpload, mediaKind, telegramText, maxUploadBytes, uploadName } from './media.js';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { db, transaction } from './db.js';
import templateRoutes from './routes/templates.js';
import { encrypt, ProviderError, verifyChannel } from './providers.js';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('Задай JWT_SECRET длиной не менее 32 символов');

const app = express();
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: {
  imgSrc: ["'self'", 'blob:'], mediaSrc: ["'self'", 'blob:'],
} } }));
if (process.env.CLIENT_ORIGIN) app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '96kb' }));

const error = (status, message) => Object.assign(new Error(message), { status });
const fields = schema => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(error(400, 'Проверь заполнение полей'));
  req.input = result.data;
  next();
};
const account = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(8).max(72).refine(value => Buffer.byteLength(value) <= 72),
});
const access = rateLimit({ windowMs: 15 * 60000, limit: 30, message: { error: 'Попробуй снова через 15 минут' } });
app.get('/api/health', async (req, res) => {
  await db.query('SELECT 1');
  res.json({ status: 'ok' });
});
app.post('/api/auth/register', access, fields(account), async (req, res) => {
  const { email, password } = req.input;
  const hash = await bcrypt.hash(password, 12);
  const result = await db.query('INSERT INTO users(email,password_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id', [email, hash]);
  if (!result.rowCount) throw error(409, 'Этот адрес уже зарегистрирован');
  res.status(201).json({ email });
});
app.post('/api/auth/login', access, fields(account), async (req, res) => {
  const { email, password } = req.input;
  const { rows: [user] } = await db.query('SELECT id,email,role,password_hash FROM users WHERE email=$1', [email]);
  if (!user || !await bcrypt.compare(password, user.password_hash)) throw error(401, 'Неверный адрес или пароль');
  const token = jwt.sign({ email: user.email, role: user.role }, secret, {
    subject: String(user.id), expiresIn: '8h', algorithm: 'HS256',
  });
  res.json({ token, email });
});
app.use('/api', (req, res, next) => {
  try {
    const header = req.get('Authorization');
    if (!header?.startsWith('Bearer ')) throw new Error();
    const claims = jwt.verify(header.slice(7), secret, { algorithms: ['HS256'] });
    req.userId = Number(claims.sub);
    if (!Number.isSafeInteger(req.userId) || req.userId < 1) throw new Error();
  } catch {
    return next(error(401, 'Войди в аккаунт'));
  }
  next();
});
app.param('id', (req, res, next, id) => {
  if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) return next(error(404, 'Запись не найдена'));
  next();
});
const take = (result) => {
  if (!result.rowCount) throw error(404, 'Запись не найдена');
  return result.rows[0];
};

const name = z.string().trim().min(1).max(80);
const content = z.string().trim().min(1).max(4096);
const channel = z.object({
  name, platform: z.enum(['telegram', 'instagram']),
  destination: z.string().trim().min(1).max(80),
  token: z.string().trim().min(1).max(2048).optional(),
}).refine(({ platform, destination }) => platform === 'telegram'
  ? /^(?:@[a-zA-Z0-9_]{5,32}|-100\d{5,20})$/.test(destination) : /^\d{5,30}$/.test(destination));

app.use('/api/templates', templateRoutes);

const channelColumns = 'id,name,platform,destination';
app.get('/api/channels', async (req, res) => {
  res.json((await db.query(`SELECT ${channelColumns} FROM channels WHERE user_id=$1 ORDER BY id DESC`, [req.userId])).rows);
});
app.get('/api/channels/:id', async (req, res) => {
  res.json(take(await db.query(`SELECT ${channelColumns} FROM channels WHERE id=$1 AND user_id=$2`, [req.params.id, req.userId])));
});
app.post('/api/channels', access, fields(channel), async (req, res) => {
  const { name, platform, destination, token } = req.input;
  if (!token) throw error(400, 'Для подключения нужен токен');
  const verified = await verifyChannel(platform, destination, token);
  res.status(201).json(take(await db.query(
    `INSERT INTO channels(user_id,name,platform,destination,credential) VALUES ($1,$2,$3,$4,$5) RETURNING ${channelColumns}`,
    [req.userId, name, platform, verified, encrypt(token)],
  )));
});
app.put('/api/channels/:id', access, fields(channel), async (req, res) => {
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
app.delete('/api/channels/:id', async (req, res) => {
  take(await db.query('DELETE FROM channels WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.userId]));
  res.sendStatus(204);
});

const post = z.object({
  channel_id: z.number().int().positive().max(2147483647),
  body: z.string().trim().max(4096),
  telegram_html: z.string().max(50000).nullish(),
  silent: z.boolean().default(false),
  protect_content: z.boolean().default(false),
  attachment_ids: z.array(z.number().int().positive()).max(10).optional(),
  image_url: z.url({ protocol: /^https$/ }).max(2048).nullish(),
  scheduled_at: z.iso.datetime(),
  status: z.enum(['draft', 'scheduled']),
});
const selectPosts = `SELECT p.*,c.name AS channel_name,c.platform,
  COALESCE((SELECT json_agg(json_build_object('id',a.id,'name',a.name,'mime',a.mime,'kind',a.kind,'size',a.size) ORDER BY a.position,a.id)
    FROM attachments a WHERE a.post_id=p.id), '[]') AS attachments
  FROM posts p JOIN channels c ON c.id=p.channel_id`;
app.get('/api/posts', async (req, res) => {
  res.json((await db.query(`${selectPosts} WHERE p.user_id=$1 ORDER BY p.scheduled_at DESC,p.id DESC`, [req.userId])).rows);
});
app.get('/api/posts/:id', async (req, res) => {
  const post = take(await db.query(`${selectPosts} WHERE p.id=$1 AND p.user_id=$2`, [req.params.id, req.userId]));
  const { rows } = await db.query('SELECT attempted_at,completed_at,external_id,error FROM deliveries WHERE post_id=$1 ORDER BY id DESC', [post.id]);
  res.json({ ...post, deliveries: rows });
});
app.get('/api/attachments/:id', async (req, res) => {
  const file = take(await db.query(`SELECT a.* FROM attachments a JOIN posts p ON p.id=a.post_id
    WHERE a.id=$1 AND p.user_id=$2`, [req.params.id, req.userId]));
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
    const all = [...kept, ...files];
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
    return saved;
  });
  res.status(req.params.id ? 200 : 201).json(take(result));
}
app.post('/api/posts', postUpload, fields(post), savePost);
app.put('/api/posts/:id', postUpload, fields(post), savePost);
app.delete('/api/posts/:id', async (req, res) => {
  const id = req.params.id;
  await transaction(async client => {
    const current = take(await client.query('SELECT status FROM posts WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, req.userId]));
    if (current.status === 'publishing') throw error(409, 'Дождись завершения отправки');
    await client.query('DELETE FROM posts WHERE id=$1', [id]);
  });
  res.sendStatus(204);
});
app.use('/api', (req, res, next) => next(error(404, 'Маршрут не найден')));
app.use(express.static(fileURLToPath(new URL('../dist', import.meta.url))));
app.get('/{*path}', (req, res) => res.sendFile(fileURLToPath(new URL('../dist/index.html', import.meta.url))));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.code === '23503') return res.status(409).json({ error: 'Сначала удали или перенеси публикации этого канала' });
  if (err.code === '23505') return res.status(409).json({ error: 'Такая запись уже существует' });
  if (err instanceof ProviderError) return res.status(422).json({ error: err.message });
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error('Ошибка API', err.code || err.name);
  res.status(status).json({ error: status === 500 ? 'Ошибка сервера' : err.message });
});
app.listen(process.env.PORT || 3000, () => console.log('API запущен'));
