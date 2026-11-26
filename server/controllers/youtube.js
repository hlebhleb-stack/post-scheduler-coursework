import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db } from '../db.js';
import { authenticate, secret } from '../middleware/auth.js';
import { access } from '../middleware/rate-limit.js';
import { fields } from '../middleware/validation.js';
import { encrypt } from '../lib/credentials.js';
import {
  youtubeConfig,
  youtubeScopes,
  exchangeYouTubeCode,
  youtubeChannel,
  YouTubeError,
} from '../providers/youtube.js';
import { error } from '../lib/http.js';
const router = Router();
const stateSecret = secret + ':youtube-oauth';
const cookieName = 'youtube-connect';
const cookieOptions = () => ({
  httpOnly: true,
  secure: youtubeConfig().redirectUri.startsWith('https:'),
  sameSite: 'lax',
  path: '/api/youtube',
  maxAge: 600000,
});
const hash = (value) => createHash('sha256').update(value).digest('hex');
router.post(
  '/connect',
  authenticate,
  access,
  fields(
    z.object({
      name: z.string().trim().min(1).max(80),
      channel_id: z.number().int().positive().max(2147483647).optional(),
    }),
  ),
  async (req, res) => {
    const config = youtubeConfig();
    const user = await db.query('SELECT id FROM users WHERE id=$1', [req.userId]);
    if (!user.rowCount) throw error(401, 'Войди в аккаунт');
    if (req.input.channel_id) {
      const current = await db.query(
        "SELECT id FROM channels WHERE id=$1 AND user_id=$2 AND platform='youtube'",
        [req.input.channel_id, req.userId],
      );
      if (!current.rowCount) throw error(404, 'Канал не найден');
    }
    const nonce = randomBytes(32).toString('hex');
    const state = jwt.sign(
      {
        purpose: 'youtube-connect',
        nonce: hash(nonce),
        name: req.input.name,
        channelId: req.input.channel_id,
      },
      stateSecret,
      {
        subject: String(req.userId),
        audience: 'youtube-oauth',
        expiresIn: '10m',
        algorithm: 'HS256',
      },
    );
    res.cookie(cookieName, nonce, cookieOptions());
    res.set('Cache-Control', 'no-store');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: youtubeScopes.join(' '),
      access_type: 'offline',
      prompt: 'consent select_account',
      state,
    }).toString();
    res.json({ url: String(url) });
  },
);
// Google не передаёт JWT приложения: callback проверяет подписанный state и HttpOnly-cookie.
router.get('/callback', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  let claims;
  try {
    claims = jwt.verify(req.query.state, stateSecret, {
      algorithms: ['HS256'],
      audience: 'youtube-oauth',
    });
    const nonce = (req.get('cookie') || '')
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(cookieName + '='))
      ?.slice(cookieName.length + 1);
    const expected = Buffer.from(claims.nonce || '', 'hex');
    const actual = Buffer.from(hash(nonce || ''), 'hex');
    if (
      claims.purpose !== 'youtube-connect' ||
      !nonce ||
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    )
      throw new Error();
  } catch {
    return res.redirect('/channels/new?youtube_error=state');
  }
  res.clearCookie(cookieName, { path: '/api/youtube' });
  try {
    if (req.query.error) return res.redirect('/channels/new?youtube_error=cancelled');
    if (typeof req.query.code !== 'string' || req.query.code.length > 4096)
      throw new YouTubeError('Неверный код Google');
    const user = await db.query('SELECT id FROM users WHERE id=$1 AND NOT blocked', [
      Number(claims.sub),
    ]);
    if (!user.rowCount) return res.redirect('/channels/new?youtube_error=access');
    const tokens = await exchangeYouTubeCode(req.query.code);
    const channel = await youtubeChannel(tokens.access_token);
    const credential = encrypt(JSON.stringify({ refresh_token: tokens.refresh_token }));
    let result;
    if (claims.channelId) {
      result = await db.query(
        `UPDATE channels SET credential=$1,name=$2 WHERE id=$3 AND user_id=$4 AND platform='youtube' AND destination=$5 RETURNING id`,
        [credential, claims.name, claims.channelId, Number(claims.sub), channel.id],
      );
      if (!result.rowCount) return res.redirect('/channels/new?youtube_error=channel');
    } else {
      result = await db.query(
        `INSERT INTO channels(user_id,name,platform,destination,credential) VALUES ($1,$2,'youtube',$3,$4)
        ON CONFLICT(user_id,platform,destination) DO UPDATE SET name=EXCLUDED.name,credential=EXCLUDED.credential RETURNING id`,
        [Number(claims.sub), claims.name, channel.id, credential],
      );
    }
    res.redirect('/channels/' + result.rows[0].id);
  } catch (err) {
    // Токены, коды и ответы Google не включаются в URL или журнал.
    res.redirect(
      '/channels/new?youtube_error=' + (err instanceof YouTubeError ? 'access' : 'server'),
    );
  }
});
export default router;
