import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../db.js';
import { fields } from '../middleware/validation.js';
import { access } from '../middleware/rate-limit.js';
import { error } from '../lib/http.js';
import { secret } from '../middleware/auth.js';
const router = Router();
const account = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(8).max(72).refine(value => Buffer.byteLength(value) <= 72),
});
router.post('/register', access, fields(account), async (req, res) => {
  const { email, password } = req.input;
  // В базе сохраняется хеш пароля; исходный пароль не хранится.
  const hash = await bcrypt.hash(password, 12);
  const result = await db.query('INSERT INTO users(email,password_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id', [email, hash]);
  if (!result.rowCount) throw Object.assign(error(409,'Этот адрес уже зарегистрирован'),{fields:{email:'Этот адрес уже зарегистрирован. Войдите в аккаунт'}});
  res.status(201).json({ email });
});
router.post('/login', access, fields(account), async (req, res) => {
  const { email, password } = req.input;
  const { rows: [user] } = await db.query('SELECT id,email,role,password_hash FROM users WHERE email=$1', [email]);
  if (!user || !await bcrypt.compare(password, user.password_hash)) throw Object.assign(error(401,'Неверный адрес или пароль'),{fields:{password:'Проверьте адрес электронной почты и пароль'}});
  const token = jwt.sign({ email: user.email, role: user.role }, secret, {
    subject: String(user.id), expiresIn: '8h', algorithm: 'HS256',
  });
  res.json({ token, email, role:user.role });
});
export default router;
