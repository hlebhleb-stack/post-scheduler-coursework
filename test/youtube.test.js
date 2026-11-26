import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publish,encrypt,ProviderError} from '../server/providers.js';
import {exchangeYouTubeCode,youtubeScopes} from '../server/youtube.js';
process.env.CHANNEL_KEY=Buffer.alloc(32,9).toString('base64');
process.env.YOUTUBE_CLIENT_ID='test-client';process.env.YOUTUBE_CLIENT_SECRET='test-secret';process.env.YOUTUBE_REDIRECT_URI='https://example.com/api/youtube/callback';
const post={platform:'youtube',credential:encrypt(JSON.stringify({refresh_token:'test-refresh'})),destination:'UCtest',youtube_title:'Тестовое видео',body:'Описание',youtube_privacy:'unlisted',youtube_made_for_kids:false,attachments:[{kind:'video',mime:'video/mp4',content:Buffer.from('video')}]};
function mockGoogle(t,{uploadFailure=false,wrongChannel=false,badLocation=false,refreshFailure=false}={}) {
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  url=String(url);calls.push({url,options});
  if(url.endsWith('/token')) return refreshFailure ? Response.json({error:'invalid_grant'},{status:400}) : Response.json({access_token:'test-access',refresh_token:'test-refresh',scope:youtubeScopes.join(' ')});
  if(url.includes('/channels?')) return Response.json({items:[{id:wrongChannel?'UCother':'UCtest',snippet:{title:'Демо'}}]});
  if(options.method==='POST') return new Response(null,{headers:{location:badLocation?'https://example.com/upload':'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test'}});
  if(uploadFailure) throw new Error('network interrupted');
  return Response.json({id:'test-video-id'});
 });
 return calls;
}
test('YouTube обновляет токен, проверяет канал и передаёт видео с выбранным доступом',async t=>{
 const calls=mockGoogle(t);assert.equal(await publish(post),'test-video-id');
 assert.equal(calls.length,4);assert.equal(calls[0].options.body.get('refresh_token'),'test-refresh');
 const meta=JSON.parse(calls[2].options.body);assert.equal(meta.snippet.title,post.youtube_title);assert.equal(meta.status.privacyStatus,'unlisted');assert.equal(meta.status.selfDeclaredMadeForKids,false);assert.deepEqual(calls[3].options.body,post.attachments[0].content);
});
test('Сбой при отправке не вызывает автоматической повторной загрузки',async t=>{
 const calls=mockGoogle(t,{uploadFailure:true});await assert.rejects(publish(post),e=>e instanceof ProviderError&&!e.definitive);assert.equal(calls.length,4);
});
test('Чужой канал и отозванный доступ останавливают отправку до загрузки',async t=>{
 const calls=mockGoogle(t,{wrongChannel:true});await assert.rejects(publish(post),e=>e.definitive);assert.equal(calls.length,2);
 t.mock.restoreAll();const failed=mockGoogle(t,{refreshFailure:true});await assert.rejects(publish(post),e=>e.definitive&&/заново/.test(e.message));assert.equal(failed.length,1);
});
test('OAuth требует оба права, загрузка запрещает адрес за пределами Google',async t=>{
 mockGoogle(t);assert((await exchangeYouTubeCode('test-code')).refresh_token);
 t.mock.restoreAll();mockGoogle(t,{badLocation:true});await assert.rejects(publish(post),e=>e.definitive&&/адрес/.test(e.message));
 t.mock.restoreAll();t.mock.method(globalThis,'fetch',async()=>Response.json({access_token:'x',refresh_token:'y',scope:youtubeScopes[0]}));await assert.rejects(exchangeYouTubeCode('code'),/оба/);
});
