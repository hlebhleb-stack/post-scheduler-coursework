import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publish, encrypt } from '../server/providers.js';
import { telegramText } from '../server/media.js';

// Изолированный тест не обращается к Telegram и не использует рабочие токены.
process.env.CHANNEL_KEY = Buffer.alloc(32, 7).toString('base64');
const post = {
  platform:'telegram', credential:encrypt('123:test-token'), destination:'-10012345678',
  body:'Текст', telegram_html:'<b>Текст</b>', silent:true, protect_content:true,
};
const attachment = { name:'example.bin', mime:'application/octet-stream', content:Buffer.from('test') };

test('HTML редактора преобразуется в безопасное форматирование Telegram', () => {
  assert.equal(telegramText('<p><strong>Текст</strong></p><p><em>Курсив</em></p>'), '<b>Текст</b>\n<i>Курсив</i>');
  assert.equal(telegramText('<script>alert(1)</script><a href="javascript:alert(1)">ссылка</a><tg-spoiler>секрет</tg-spoiler>'), '<a>ссылка</a><tg-spoiler>секрет</tg-spoiler>');
});

test('Текст, все типы вложений и альбом передаются нужным методам Bot API', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url:String(url), options });
    return Response.json({ ok:true, result:String(url).endsWith('sendMediaGroup') ? [{message_id:1},{message_id:2}] : {message_id:1} });
  });
  await publish(post);
  assert(calls.at(-1).url.endsWith('/sendMessage'));
  assert.equal(JSON.parse(calls.at(-1).options.body).parse_mode, 'HTML');
  for (const [kind,method] of Object.entries({ photo:'sendPhoto', video:'sendVideo', audio:'sendAudio', animation:'sendAnimation', document:'sendDocument' })) {
    await publish({ ...post, attachments:[{ ...attachment, kind }] });
    const call = calls.at(-1);
    assert(call.url.endsWith('/' + method));
    assert(call.options.body instanceof FormData);
    assert.equal(call.options.body.get('caption'), post.telegram_html);
    assert.equal(call.options.body.get('protect_content'), 'true');
    assert.equal(await call.options.body.get(kind).text(), 'test');
  }
  assert.equal(await publish({ ...post, attachments:[{...attachment,kind:'photo'},{...attachment,kind:'video'}] }), '1,2');
  const media = JSON.parse(calls.at(-1).options.body.get('media'));
  assert.deepEqual(media.map(item => item.type), ['photo','video']);
  assert.equal(media[0].caption, post.telegram_html);
  assert.equal(media[1].caption, undefined);
});
