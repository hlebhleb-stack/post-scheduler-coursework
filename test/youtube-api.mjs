import assert from 'node:assert/strict';
import pg from 'pg';
import jwt from 'jsonwebtoken';
export async function checkYouTube(base,databaseUrl,secret) {
 const db=new pg.Pool({connectionString:databaseUrl});let userId;
 try {
  userId=(await db.query("INSERT INTO users(email,password_hash) VALUES ($1,'test') RETURNING id",['youtube-'+Date.now()+'@example.com'])).rows[0].id;
  const token=jwt.sign({},secret,{subject:String(userId),algorithm:'HS256',expiresIn:'5m'});
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const connect=()=>fetch(base+'/api/youtube/connect',{method:'POST',headers,body:JSON.stringify({name:'YouTube Демо'})});
  assert.equal((await fetch(base+'/api/youtube/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  const started=await connect();assert.equal(started.status,200);assert(started.headers.get('set-cookie').includes('HttpOnly'));
  const cookie=started.headers.get('set-cookie').split(';')[0];const {url}=await started.json();const google=new URL(url);const state=google.searchParams.get('state');
  assert.equal(google.origin,'https://accounts.google.com');assert.equal(google.searchParams.get('access_type'),'offline');
  assert.equal((await fetch(base+'/api/channels',{headers:{Authorization:'Bearer '+state}})).status,401);
  const callback=base+'/api/youtube/callback?code=test-code&state='+encodeURIComponent(state);
  const bad=await fetch(callback,{redirect:'manual'});assert.equal(bad.headers.get('location'),'/channels/new?youtube_error=state');
  const cancelled=await fetch(base+'/api/youtube/callback?error=access_denied&state='+encodeURIComponent(state),{headers:{Cookie:cookie},redirect:'manual'});assert(cancelled.headers.get('location').includes('cancelled'));
  const accepted=await fetch(callback,{headers:{Cookie:cookie},redirect:'manual'});assert.match(accepted.headers.get('location'),/^\/channels\/\d+$/);
  const channels=await(await fetch(base+'/api/channels',{headers})).json();assert.equal(channels.length,1);assert.equal(channels[0].platform,'youtube');assert(!JSON.stringify(channels).includes('test-refresh'));
  const channel=channels[0];
  const payload={channel_id:channel.id,body:'',youtube_title:'Видео',youtube_privacy:'unlisted',youtube_made_for_kids:false,scheduled_at:new Date(Date.now()+60000).toISOString(),status:'draft'};
  let result=await fetch(base+'/api/posts',{method:'POST',headers,body:JSON.stringify(payload)});assert.equal(result.status,400);
  const form=new FormData();form.set('payload',JSON.stringify(payload));form.append('files',new Blob(['test-video'],{type:'video/mp4'}),'demo.mp4');
  result=await fetch(base+'/api/posts',{method:'POST',headers:{Authorization:'Bearer '+token},body:form});assert.equal(result.status,201);const saved=await result.json();
  const detail=await(await fetch(base+'/api/posts/'+saved.id,{headers})).json();assert.equal(detail.youtube_title,'Видео');assert.equal(detail.attachments.length,1);
  result=await fetch(base+'/api/posts/'+saved.id,{method:'PUT',headers,body:JSON.stringify({...payload,youtube_title:'<bad>'})});assert.equal(result.status,400);assert((await result.json()).fields.youtube_title);
  const second=await connect();const nextURL=new URL((await second.json()).url);await fetch(base+'/api/youtube/callback?code=test-code&state='+encodeURIComponent(nextURL.searchParams.get('state')),{headers:{Cookie:second.headers.get('set-cookie').split(';')[0]},redirect:'manual'});
  assert.equal((await db.query('SELECT id FROM channels WHERE user_id=$1',[userId])).rowCount,1);
  console.log('YouTube API: OAuth, защита state/cookie, изоляция JWT, подключение без дублей, MP4 и валидация проверены');
 } finally {if(userId){await db.query('DELETE FROM posts WHERE user_id=$1',[userId]);await db.query('DELETE FROM channels WHERE user_id=$1',[userId]);await db.query('DELETE FROM users WHERE id=$1',[userId]);}await db.end();}
}
