import { ProviderError } from '../providers.js';
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err.code === '23503') return res.status(409).json({ error: 'Сначала удали или перенеси публикации этого канала' });
  if (err.code === '23505') return res.status(409).json({ error: 'Такая запись уже существует' });
  if (err instanceof ProviderError) return res.status(422).json({ error: err.message });
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error('Ошибка API', err.code || err.name);
  res.status(status).json({ error: status === 500 ? 'Ошибка сервера' : err.message });
}
