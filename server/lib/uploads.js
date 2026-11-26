import multer from 'multer';
import { tmpdir } from 'node:os';
import { unlink } from 'node:fs/promises';
import sanitizeHtml from 'sanitize-html';

export const maxUploadBytes = 50 * 1024 * 1024;
const upload = multer({
  dest: tmpdir(),
  limits: { fileSize: maxUploadBytes, files: 10, fields: 1, fieldSize: 100000 },
}).array('files', 10);
export function postUpload(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  res.on('close', () => {
    for (const file of req.files || []) unlink(file.path).catch(() => {});
  });
  upload(req, res, (err) => {
    if (err)
      return next(Object.assign(new Error('До 10 файлов, не более 50 МБ каждый'), { status: 400 }));
    try {
      req.body = JSON.parse(req.body.payload);
    } catch {
      return next(Object.assign(new Error('Некорректные данные публикации'), { status: 400 }));
    }
    next();
  });
}

export function telegramText(html) {
  if (!html) return '';
  const lines = html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p(?:\s[^>]*)?>/gi, '');
  return sanitizeHtml(lines, {
    allowedTags: [
      'b',
      'strong',
      'i',
      'em',
      'u',
      's',
      'del',
      'a',
      'code',
      'pre',
      'blockquote',
      'tg-spoiler',
    ],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['https', 'http', 'mailto', 'tg'],
    transformTags: { strong: 'b', em: 'i', del: 's' },
  });
}
export function mediaKind(file) {
  const ext = file.originalname.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png'].includes(ext) && file.mimetype.startsWith('image/')) return 'photo';
  if (ext === 'gif' && file.mimetype === 'image/gif') return 'animation';
  if (ext === 'mp4' && file.mimetype === 'video/mp4') return 'video';
  if (['mp3', 'm4a'].includes(ext) && file.mimetype.startsWith('audio/')) return 'audio';
  return 'document';
}

export function uploadName(value) {
  const decoded = Buffer.from(value, 'latin1').toString('utf8');
  return (
    decoded.includes('�') || [...value].some((char) => char.charCodeAt(0) > 255) ? value : decoded
  ).slice(0, 255);
}
