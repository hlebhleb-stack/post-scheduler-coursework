// Тестовый процесс запрещает любые реальные обращения к соцсетям.
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith('https://api.telegram.org/bot123:worker-test/'))
    throw new Error('Unexpected external request');
  const { text } = JSON.parse(options.body);
  await new Promise((resolve) => setTimeout(resolve, 80));
  if (text === 'lost') throw new Error('Connection lost after sending');
  if (text === 'reject')
    return Response.json({ ok: false, description: 'Forbidden' }, { status: 403 });
  return Response.json({ ok: true, result: { message_id: 'worker-confirmed' } });
};
