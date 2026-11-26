import { rateLimit } from 'express-rate-limit';
export const access = rateLimit({ windowMs: 15 * 60000, limit: 30, message: { error: 'Попробуй снова через 15 минут' } });
