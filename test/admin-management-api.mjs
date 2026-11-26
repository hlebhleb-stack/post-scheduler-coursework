import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';
export async function checkAdminManagement(base,databaseURL,secret){
 const db=new pg.Pool({connectionString:databaseURL});const prefix='manage-'+Date.now();const ids=[];
 const token=id=>jwt.sign({},secret,{subject:String(id),expiresIn:120,algorithm:'HS256'});
 const call=(path,id,method='GET',body)=>fetch(base+'/api/admin/'+path,{method,headers:{Authorization:'Bearer '+token(id),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{
  const hash=await bcrypt.hash('management-password-123',4);
  for(let i=0;i<23;i++)ids.push((await db.query('INSERT INTO users(email,password_hash,role) VALUES ($1,$2,$3) RETURNING id',[`${prefix}-${i}@example.com`,hash,i<2?'admin':'user'])).rows[0].id);
  const [admin,other,member]=ids;
  const channel=(await db.query("INSERT INTO channels(user_id,name,platform,destination,credential) VALUES ($1,'Admin channel','telegram','@manage_test','never-expose-credential') RETURNING id",[member])).rows[0].id;
  const posts={};for(const status of ['draft','scheduled','publishing','published','failed','uncertain'])posts[status]=(await db.query('INSERT INTO posts(user_id,channel_id,body,status,scheduled_at) VALUES ($1,$2,$3,$3,now()-interval \'1 minute\') RETURNING id',[member,channel,status])).rows[0].id;
  const media=(await db.query("INSERT INTO attachments(user_id,name,mime,kind,content,size,position) VALUES ($1,'library.txt','text/plain','document',$2,3,0) RETURNING id",[member,Buffer.from('abc')])).rows[0].id;
  const copy=(await db.query("INSERT INTO attachments(post_id,name,mime,kind,content,size,position) VALUES ($1,'copy.txt','text/plain','document',$2,3,0) RETURNING id",[posts.draft,Buffer.from('abc')])).rows[0].id;
  for(const path of ['users','posts','channels','media','events'])assert.equal((await call(path,member)).status,403);
  assert.equal((await call('users/'+member,member,'PATCH',{role:'admin'})).status,403);
  assert.equal((await call('posts/'+posts.scheduled,member,'PATCH',{action:'cancel'})).status,403);
  assert.equal((await call('media/'+media,member,'DELETE')).status,403);
  const first=await(await call('users?q='+prefix,admin)).json();assert.equal(first.total,23);assert.equal(first.items.length,20);
  const second=await(await call('users?q='+prefix+'&page=2',admin)).json();assert.equal(second.items.length,3);
  assert.equal((await call('users?page=-1',admin)).status,400);
  assert.equal((await call('users/'+admin,admin,'PATCH',{blocked:true})).status,409);
  assert.equal((await call('users/'+admin,admin,'PATCH',{role:'user'})).status,409);
  assert.equal((await call('users/'+member,admin,'PATCH',{role:'admin'})).status,200);
  assert.equal((await call('overview',member)).status,200);
  assert.equal((await call('users/'+member,admin,'PATCH',{role:'user'})).status,200);
  assert.equal((await call('overview',member)).status,403);
  assert.equal((await call('users/'+member,admin,'PATCH',{blocked:true})).status,200);
  assert.equal((await fetch(base+'/api/posts',{headers:{Authorization:'Bearer '+token(member)}})).status,403);
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:`${prefix}-2@example.com`,password:'management-password-123'})});assert.equal(login.status,403);
  assert.equal((await call('users/'+member,admin,'PATCH',{blocked:false})).status,200);
  const channels=await(await call('channels?q='+prefix,admin)).json();assert.equal(channels.items.length,1);assert(!JSON.stringify(channels).includes('never-expose'));
  const list=await(await call('posts?q='+prefix+'&status=overdue',admin)).json();assert.equal(list.items.length,1);
  const detail=await(await call('posts/'+posts.draft,admin)).json();assert.equal(detail.attachments[0].id,copy);assert(!('credential'in detail));
  assert.equal((await call('posts/'+posts.scheduled,admin,'PATCH',{action:'cancel'})).status,200);
  const future=new Date(Date.now()+600000).toISOString();assert.equal((await call('posts/'+posts.failed,admin,'PATCH',{action:'reschedule',scheduled_at:future})).status,200);
  assert.equal((await call('posts/'+posts.draft,admin,'PATCH',{action:'reschedule',scheduled_at:new Date(0).toISOString()})).status,400);
  for(const status of ['publishing','published','uncertain'])for(const action of ['cancel','reschedule'])assert.equal((await call('posts/'+posts[status],admin,'PATCH',{action,scheduled_at:future})).status,409);
  assert.equal((await call('media/'+copy,admin,'DELETE')).status,404);
  assert.equal((await call('media/'+media,admin,'DELETE')).status,204);assert.equal((await db.query('SELECT id FROM attachments WHERE id=$1',[copy])).rowCount,1);
  const events=await(await call('events?q='+prefix,admin)).json();assert(events.items.some(event=>event.action==='user.update'));assert(events.items.some(event=>event.action==='media.delete'));assert(!JSON.stringify(events).includes('never-expose'));
  assert.equal((await call('users/'+other,admin,'PATCH',{role:'user'})).status,200);assert.equal((await call('overview',other)).status,403);
  console.log('Админ-панель: поиск/страницы, роли, блокировка входа и JWT, расписание, защита uncertain, удаление медиатеки и журнал проверены');
 }finally{
  if(ids.length){await db.query('DELETE FROM admin_events WHERE actor_id=ANY($1)',[ids]);await db.query('DELETE FROM attachments WHERE user_id=ANY($1)',[ids]);await db.query('DELETE FROM posts WHERE user_id=ANY($1)',[ids]);await db.query('DELETE FROM channels WHERE user_id=ANY($1)',[ids]);await db.query('DELETE FROM users WHERE id=ANY($1)',[ids]);}await db.end();
 }
}
