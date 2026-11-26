import { publishYouTube, YouTubeError } from './youtube.js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key() {
  const value = Buffer.from(process.env.CHANNEL_KEY || '', 'base64');
  if (value.length !== 32) throw new Error('CHANNEL_KEY должен содержать 32 байта в base64');
  return value;
}

export function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const content = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), content]).toString('base64');
}

export function decrypt(value) {
  const data = Buffer.from(value, 'base64');
  const cipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
  cipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8');
}

export class ProviderError extends Error {
  constructor(message, definitive = false) {
    super(message);
    this.definitive = definitive;
  }
}

async function request(url, options, errorMessage) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(options.body instanceof FormData ? 120000 : 15000), redirect: 'error' });
  } catch {
    throw new ProviderError('Нет ответа от платформы');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok === false || body?.error) {
    throw new ProviderError(errorMessage?.(response.status, body) || `Платформа отклонила запрос (HTTP ${response.status})`, response.status < 500);
  }
  if (!body) throw new ProviderError('Платформа вернула нечитаемый ответ');
  return body;
}

function telegramError(method, status, body) {
  if (status === 401 || (method === 'getMe' && [400, 404].includes(status))) {
    return 'Telegram не принял токен. Скопируй токен этого бота из @BotFather целиком.';
  }
  if (status === 429) return 'Telegram ограничил частоту запросов. Попробуй позже.';
  if (status >= 500) return 'Telegram временно недоступен.';
  const detail = typeof body?.description === 'string' ? body.description.toLowerCase() : '';
  if (method === 'getChat' && (status === 400 || status === 403)) {
    return 'Telegram не нашёл доступный канал. Проверь @имя или ID канала и добавь этого бота в администраторы.';
  }
  if (method === 'getChatMember' && (status === 400 || status === 403)) {
    return 'Telegram не смог проверить права. Добавь этого бота в администраторы канала с правом публикации.';
  }
  if (method === 'sendMessage' && (status === 403 || /forbidden|not enough rights|chat not found/.test(detail))) {
    return 'Telegram не разрешил отправку. Проверь, что канал доступен боту и у него есть право публикации.';
  }
  if (/caption is too long|message is too long/.test(detail)) return 'Telegram отклонил слишком длинный текст или подпись';
  if (/can.t parse entities/.test(detail)) return 'Telegram не принял форматирование текста';
  if (/file|photo|image|media/.test(detail)) return 'Telegram не принял вложение. Проверь размер и формат файла';
  return `Telegram отклонил запрос (HTTP ${status}).`;
}

async function telegram(token, method, body = {}) {
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw new ProviderError('Неверный формат токена Telegram', true);
  const data = await request(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : JSON.stringify(body),
  }, (status, response) => telegramError(method, status, response));
  return data.result;
}

export async function verifyChannel(platform, destination, token) {
  if (platform !== 'telegram') throw new ProviderError('Эта платформа не поддерживается',true);
  const bot = await telegram(token, 'getMe');
  const chat = await telegram(token, 'getChat', { chat_id: destination });
  if (chat.type !== 'channel') throw new ProviderError('Укажи Telegram-канал', true);
  const membership = await telegram(token, 'getChatMember', { chat_id: chat.id, user_id: bot.id });
  if (membership.status !== 'creator' && !membership.can_post_messages) {
    throw new ProviderError('У бота нет права публиковать в канале', true);
  }
  return String(chat.id);
}

export async function publish(post) {
  const token = decrypt(post.credential);
  if (post.platform === 'youtube') {
    try { return await publishYouTube(post, token); }
    catch (err) { if (err instanceof YouTubeError) throw new ProviderError(err.message,err.definitive); throw err; }
  }
  if (post.platform === 'telegram') {
    const files = post.attachments || [];
    const options = { chat_id: post.destination, disable_notification: Boolean(post.silent), protect_content: Boolean(post.protect_content) };
    const caption = post.telegram_html || post.body;
    const formatting = post.telegram_html ? { parse_mode: 'HTML' } : {};
    let result;
    if (!files.length) {
      result = await telegram(token, 'sendMessage', { ...options, text: caption, ...formatting });
    } else {
      const form = new FormData();
      for (const [key,value] of Object.entries(options)) form.set(key, String(value));
      if (files.length > 1) {
        form.set('media', JSON.stringify(files.map((file,index) => ({ type: file.kind, media: 'attach://file' + index,
          ...(index === 0 && caption ? { caption, ...formatting } : {}),
        }))));
        files.forEach((file,index) => form.set('file' + index, new Blob([file.content], { type: file.mime }), file.name));
        const messages = await telegram(token, 'sendMediaGroup', form);
        if (!Array.isArray(messages) || messages.length !== files.length || messages.some(item => !item.message_id)) throw new ProviderError('Telegram не подтвердил весь альбом');
        return messages.map(item => item.message_id).join(',');
      }
      const file = files[0];
      const methods = { photo:'sendPhoto', video:'sendVideo', audio:'sendAudio', animation:'sendAnimation', document:'sendDocument' };
      form.set(file.kind, new Blob([file.content], { type: file.mime }), file.name);
      if (caption) form.set('caption', caption);
      if (post.telegram_html) form.set('parse_mode', 'HTML');
      result = await telegram(token, methods[file.kind], form);
    }
    if (!result?.message_id) throw new ProviderError('Telegram не подтвердил отправку');
    return String(result.message_id);
  }
  throw new ProviderError('Эта платформа не поддерживается',true);
}
