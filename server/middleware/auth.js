import jwt from 'jsonwebtoken';
import { error } from '../lib/http.js';
import { db } from '../db.js';
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('Задай JWT_SECRET длиной не менее 32 символов');

export async function authenticate(req, res, next) {
  try {
    const header = req.get('Authorization');
    if (!header?.startsWith('Bearer ')) throw new Error();
    const claims = jwt.verify(header.slice(7), secret, { algorithms:['HS256'] });
    req.userId = Number(claims.sub);
    if (!Number.isSafeInteger(req.userId) || req.userId < 1) throw new Error();
  } catch { return next(error(401, 'Войди в аккаунт')); }
  const {rows:[user]} = await db.query('SELECT blocked FROM users WHERE id=$1',[req.userId]);
  if (!user) return next(error(401,'Войди в аккаунт'));
  if (user.blocked) return next(error(403,'Аккаунт заблокирован администратором'));
  next();
}
// Права проверяем по БД: снятие роли действует и для ранее выданного JWT.
export async function requireAdmin(req, res, next) {
  const { rows:[user] } = await db.query('SELECT role,blocked FROM users WHERE id=$1', [req.userId]);
  if (user?.role !== 'admin' || user.blocked) return next(error(403, 'Доступ разрешён только администратору'));
  next();
}
export { secret };
