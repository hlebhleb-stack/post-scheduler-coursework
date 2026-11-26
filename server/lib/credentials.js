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
