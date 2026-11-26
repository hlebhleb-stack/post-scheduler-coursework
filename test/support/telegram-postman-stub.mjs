// Загружается только тестовым запуском Node через --import.
// REST API и PostgreSQL настоящие, ответы внешнего Telegram изолированы.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url) === 'https://oauth2.googleapis.com/token') return Response.json({access_token:'test-access',refresh_token:'test-refresh',scope:'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly'});
  if (String(url).startsWith('https://www.googleapis.com/youtube/v3/channels?')) return Response.json({items:[{id:'UCtest',snippet:{title:'Demo'}}]});
  if (!String(url).startsWith('https://api.telegram.org/bot123:postman-test/')) return originalFetch(url, options);
  const method = String(url).split('/').at(-1);
  const result = {
    getMe: { id:123 },
    getChat: { id:-1001234567890, type:'channel' },
    getChatMember: { status:'administrator', can_post_messages:true },
  }[method];
  if (!result) throw new Error('Тестовая коллекция не должна отправлять сообщения');
  return Response.json({ ok:true, result });
};
