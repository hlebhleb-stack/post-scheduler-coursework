import assert from 'node:assert/strict';
import pg from 'pg';
import jwt from 'jsonwebtoken';

export async function checkMediaLibrary(base,databaseURL,secret) {
  const db=new pg.Pool({connectionString:databaseURL});
  const users=[];
  try {
    for(let i=0;i<2;i++)users.push((await db.query("INSERT INTO users(email,password_hash) VALUES ($1,'test-only') RETURNING id",['media-library-'+Date.now()+'-'+i+'@example.com'])).rows[0].id);
    const headers=id=>({Authorization:'Bearer '+jwt.sign({},secret,{subject:String(id),expiresIn:60,algorithm:'HS256'})});
    const owned=headers(users[0]);
    const form=new FormData();form.set('payload','{}');form.append('files',new Blob(['library bytes'],{type:'text/plain'}),'library.txt');
    const uploaded=await fetch(base+'/api/media',{method:'POST',headers:owned,body:form});assert.equal(uploaded.status,201);
    const [file]=await uploaded.json();assert.equal(file.kind,'document');assert(!Object.hasOwn(file,'content'));
    const foreign=headers(users[1]);
    for(const path of ['/api/media/'+file.id,'/api/attachments/'+file.id])assert.equal((await fetch(base+path,{headers:foreign})).status,404);
    assert.equal((await fetch(base+'/api/media/'+file.id,{method:'DELETE',headers:foreign})).status,404);
    assert.equal((await fetch(base+'/api/media/'+file.id,{method:'PUT',headers:{...foreign,'Content-Type':'application/json'},body:'{"name":"other"}'})).status,404);
    const renamed=await fetch(base+'/api/media/'+file.id,{method:'PUT',headers:{...owned,'Content-Type':'application/json'},body:'{"name":"renamed.txt"}'});assert.equal(renamed.status,200);assert.equal((await renamed.json()).name,'renamed.txt');
    const channel=(await db.query("INSERT INTO channels(user_id,name,platform,destination,credential) VALUES ($1,'Library test','telegram','@library_test','test-only') RETURNING id",[users[0]])).rows[0];
    const body={channel_id:channel.id,body:'',media_ids:[file.id],scheduled_at:new Date(Date.now()+3600000).toISOString(),status:'draft'};
    const created=await fetch(base+'/api/posts',{method:'POST',headers:{...owned,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(created.status,201);const {id}=await created.json();
    const post=await (await fetch(base+'/api/posts/'+id,{headers:owned})).json();assert.equal(post.attachments.length,1);assert.equal(post.attachments[0].name,'renamed.txt');assert.notEqual(post.attachments[0].id,file.id);
    // Копию вложения публикации нельзя удалить через API медиатеки.
    assert.equal((await fetch(base+'/api/media/'+post.attachments[0].id,{method:'DELETE',headers:owned})).status,404);
    assert.equal((await fetch(base+'/api/media/'+file.id,{method:'DELETE',headers:owned})).status,204);
    assert.equal((await fetch(base+'/api/attachments/'+post.attachments[0].id,{headers:owned})).status,200);
    assert.equal(await (await fetch(base+'/api/attachments/'+post.attachments[0].id,{headers:owned})).text(),'library bytes');
    const missing=await fetch(base+'/api/posts',{method:'POST',headers:{...owned,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(missing.status,404);
    console.log('Медиатека: CRUD, изоляция владельцев и сохранность копии в посте проверены');
  } finally {
    for(const id of users){await db.query('DELETE FROM posts WHERE user_id=$1',[id]);await db.query('DELETE FROM attachments WHERE user_id=$1',[id]);await db.query('DELETE FROM channels WHERE user_id=$1',[id]);await db.query('DELETE FROM users WHERE id=$1',[id]);}
    await db.end();
  }
}
