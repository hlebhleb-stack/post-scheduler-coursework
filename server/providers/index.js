import { decrypt } from '../lib/credentials.js';
import { ProviderError } from '../lib/provider-error.js';
import { publishTelegram, verifyTelegramChannel } from './telegram.js';
import { publishYouTube, YouTubeError } from './youtube.js';

export async function verifyChannel(platform, destination, token) {
  if (platform !== 'telegram') throw new ProviderError('Эта платформа не поддерживается', true);
  return verifyTelegramChannel(destination, token);
}

// Общая точка отправки: обработчик очереди не зависит от особенностей платформы.
export async function publish(post) {
  const token = decrypt(post.credential);
  if (post.platform === 'telegram') return publishTelegram(post, token);
  if (post.platform === 'youtube') {
    try {
      return await publishYouTube(post, token);
    } catch (error) {
      if (error instanceof YouTubeError) throw new ProviderError(error.message, error.definitive);
      throw error;
    }
  }
  throw new ProviderError('Эта платформа не поддерживается', true);
}
