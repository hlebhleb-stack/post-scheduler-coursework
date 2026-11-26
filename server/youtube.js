// OAuth-токены обмениваются сервером и никогда не возвращаются браузеру.
export const youtubeScopes = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];
export class YouTubeError extends Error {
  constructor(message, definitive = true) { super(message); this.definitive = definitive; this.status = 400; }
}
export function youtubeConfig() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new YouTubeError('Подключение YouTube ещё не настроено на сервере');
  return { clientId, clientSecret, redirectUri };
}
async function googleFetch(url, options, sending = false) {
  let response;
  try { response = await fetch(url, { ...options, redirect:'error', signal:AbortSignal.timeout(sending ? 120000 : 20000) }); }
  catch { throw new YouTubeError(sending ? 'YouTube не подтвердил загрузку. Проверьте канал перед повторной отправкой' : 'Google не ответил. Попробуйте позже', !sending); }
  if (!response.ok) {
    const data = await response.json().catch(()=>null);
    const reason = data?.error?.errors?.[0]?.reason;
    if (data?.error === 'invalid_grant') throw new YouTubeError('Доступ Google истёк или отозван. Подключите YouTube заново');
    if (response.status === 401) throw new YouTubeError('Google не принял доступ. Подключите YouTube заново');
    if (reason === 'quotaExceeded' || reason === 'uploadLimitExceeded' || response.status === 429) throw new YouTubeError('Лимит YouTube исчерпан. Попробуйте позже');
    if (reason === 'insufficientPermissions') throw new YouTubeError('Разрешите просмотр канала и загрузку видео при подключении Google');
    throw new YouTubeError(`YouTube отклонил запрос (HTTP ${response.status}). Проверьте доступ к API и настройки аккаунта`, !sending || response.status < 500);
  }
  return response;
}
export async function exchangeYouTubeCode(code) {
  const {clientId,clientSecret,redirectUri} = youtubeConfig();
  const response = await googleFetch('https://oauth2.googleapis.com/token', { method:'POST', body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code'}) });
  const tokens = await response.json();
  if (!tokens.access_token || !tokens.refresh_token) throw new YouTubeError('Google не выдал постоянный доступ. Повторите подключение и разрешите доступ к YouTube');
  const granted = new Set((tokens.scope || '').split(' '));
  if (youtubeScopes.some(scope=>!granted.has(scope))) throw new YouTubeError('Разрешите оба запрошенных права YouTube и повторите подключение');
  return tokens;
}
export async function youtubeChannel(accessToken) {
  const response = await googleFetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {headers:{Authorization:'Bearer '+accessToken}});
  const {items} = await response.json();
  if (items?.length !== 1 || !items[0]?.id) throw new YouTubeError('Выберите Google-аккаунт с созданным YouTube-каналом');
  return {id:items[0].id,name:items[0].snippet?.title || 'YouTube'};
}
export async function publishYouTube(post, credential) {
  const {clientId,clientSecret} = youtubeConfig();
  let stored;
  try { stored = JSON.parse(credential); } catch { throw new YouTubeError('Подключите YouTube заново'); }
  if (!stored.refresh_token) throw new YouTubeError('Подключите YouTube заново');
  const tokenResponse = await googleFetch('https://oauth2.googleapis.com/token', {method:'POST',body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:stored.refresh_token,grant_type:'refresh_token'})});
  const {access_token:accessToken} = await tokenResponse.json();
  if (!accessToken) throw new YouTubeError('Не удалось обновить доступ Google. Подключите YouTube заново');
  const channel = await youtubeChannel(accessToken);
  if (channel.id !== post.destination) throw new YouTubeError('Доступ Google относится к другому YouTube-каналу. Подключите нужный канал');
  const files = post.attachments || [];
  if (files.length !== 1 || files[0].mime !== 'video/mp4' || !post.youtube_title) throw new YouTubeError('Для YouTube нужны название и одно MP4-видео');
  const file = files[0];
  const response = await googleFetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method:'POST', headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Length':String(file.content.length),'X-Upload-Content-Type':file.mime},
    body:JSON.stringify({snippet:{title:post.youtube_title,description:post.body},status:{privacyStatus:post.youtube_privacy || 'unlisted',selfDeclaredMadeForKids:Boolean(post.youtube_made_for_kids)}}),
  });
  const location = response.headers.get('location');
  // Видео и OAuth-токен отправляются только на адрес загрузки Google.
  let target;
  try { target = new URL(location); } catch { throw new YouTubeError('YouTube не создал сессию загрузки'); }
  if (target.protocol !== 'https:' || target.hostname !== 'www.googleapis.com' || !target.pathname.startsWith('/upload/youtube/')) throw new YouTubeError('YouTube вернул недопустимый адрес загрузки');
  const uploaded = await googleFetch(target, {method:'PUT',headers:{Authorization:'Bearer '+accessToken,'Content-Type':file.mime},body:file.content}, true);
  const video = await uploaded.json().catch(()=>null);
  if (!video?.id || !/^[\w-]+$/.test(video.id)) throw new YouTubeError('YouTube не подтвердил загрузку. Проверьте канал перед повторной отправкой', false);
  // Принятая загрузка ещё может обрабатываться на стороне YouTube.
  return video.id;
}
