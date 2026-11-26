import { Router } from 'express';
import { z } from 'zod';
import { db,transaction } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { fields } from '../middleware/validation.js';
import { error,take } from '../lib/http.js';
const router=Router();
router.use(requireAdmin);
router.param('id',(req,res,next,id)=>/^\d+$/.test(id)&&Number(id)>0&&Number(id)<=2147483647?next():next(error(404,'Запись не найдена')));
const query=z.object({q:z.string().trim().max(120).default(''),page:z.coerce.number().int().min(1).max(100000).default(1),role:z.enum(['','user','admin']).default(''),access:z.enum(['','active','blocked']).default(''),platform:z.enum(['','telegram','youtube']).default(''),status:z.enum(['','draft','scheduled','publishing','published','failed','uncertain','overdue','attention']).default('')});
function filters(req){const result=query.safeParse(req.query);if(!result.success)throw error(400,'Некорректные фильтры');return result.data;}
async function list(res,sql,params,page){const limit=20;const {rows}=await db.query(sql+' LIMIT $'+(params.length+1)+' OFFSET $'+(params.length+2),[...params,limit,(page-1)*limit]);res.json({items:rows.map(({total_count,...row})=>row),total:Number(rows[0]?.total_count||0),page,limit});}
function where(){const values=[];const clauses=[];return {values,clauses,add(sql,value){values.push(value);clauses.push(sql.replaceAll('?', '$'+values.length));},sql(){return clauses.length?' WHERE '+clauses.join(' AND '):'';}};}
async function audit(client,actor,action,resource,id,details={}){await client.query('INSERT INTO admin_events(actor_id,action,resource,resource_id,details) VALUES ($1,$2,$3,$4,$5)',[actor,action,resource,id,details]);}
// Сериализуем административные изменения и повторно проверяем права внутри транзакции.
async function mutation(req,action){return transaction(async client=>{await client.query("SELECT id FROM users WHERE role='admin' ORDER BY id FOR UPDATE");const {rows:[actor]}=await client.query('SELECT role,blocked FROM users WHERE id=$1',[req.userId]);if(actor?.role!=='admin'||actor.blocked)throw error(403,'Нет прав администратора');return action(client);});}
router.get('/overview',async(req,res)=>{
 const {rows:[counts]}=await db.query(`SELECT
  (SELECT count(*)::int FROM users) AS users,
  (SELECT count(*)::int FROM users WHERE blocked) AS blocked,
  (SELECT count(*)::int FROM channels) AS channels,
  (SELECT count(*)::int FROM attachments WHERE post_id IS NULL) AS media,
  (SELECT coalesce(sum(size),0)::text FROM attachments) AS storage_bytes,
  (SELECT count(*)::int FROM posts) AS posts,
  (SELECT count(*)::int FROM posts WHERE status='scheduled') AS scheduled,
  (SELECT count(*)::int FROM posts WHERE status='scheduled' AND scheduled_at<=now()) AS overdue,
  (SELECT count(*)::int FROM posts WHERE status IN ('failed','uncertain')) AS failed`);
 const {rows:problems}=await db.query(`SELECT p.id,p.status,p.scheduled_at,c.platform,
  (SELECT d.error FROM deliveries d WHERE d.post_id=p.id ORDER BY d.id DESC LIMIT 1) AS error
  FROM posts p JOIN channels c ON c.id=p.channel_id WHERE p.status IN ('failed','uncertain') OR (p.status='scheduled' AND p.scheduled_at<=now()) ORDER BY p.scheduled_at,p.id LIMIT 50`);
 res.json({counts,problems});
});
router.get('/users',async(req,res)=>{const f=filters(req),w=where();if(f.q)w.add('u.email ILIKE ?', '%'+f.q+'%');if(f.role)w.add('u.role=?',f.role);if(f.access)w.add('u.blocked=?',f.access==='blocked');await list(res,`SELECT u.id,u.email,u.role,u.blocked,
 (SELECT count(*)::int FROM channels c WHERE c.user_id=u.id) AS channels,
 (SELECT count(*)::int FROM posts p WHERE p.user_id=u.id) AS posts,
 (SELECT count(*)::int FROM attachments a WHERE a.user_id=u.id AND a.post_id IS NULL) AS media,
 count(*) OVER() AS total_count FROM users u${w.sql()} ORDER BY u.id DESC`,w.values,f.page);});
router.patch('/users/:id',fields(z.object({role:z.enum(['user','admin']).optional(),blocked:z.boolean().optional()}).refine(v=>v.role!==undefined||v.blocked!==undefined)),async(req,res)=>{
 const id=Number(req.params.id);res.json(await mutation(req,async client=>{
  const current=take(await client.query('SELECT id,email,role,blocked FROM users WHERE id=$1 FOR UPDATE',[id]));
  const next={...current,...req.input};
  if(id===req.userId&&(next.blocked||next.role!=='admin'))throw error(409,'Нельзя заблокировать себя или снять собственные права администратора');
  if(current.role==='admin'&&!current.blocked&&(next.role!=='admin'||next.blocked)){
   const {rows:[count]}=await client.query("SELECT count(*)::int AS n FROM users WHERE role='admin' AND NOT blocked");if(count.n<=1)throw error(409,'Должен остаться хотя бы один активный администратор');
  }
  await client.query('UPDATE users SET role=$1,blocked=$2 WHERE id=$3',[next.role,next.blocked,id]);
  await audit(client,req.userId,'user.update','user',id,{before:{role:current.role,blocked:current.blocked},after:{role:next.role,blocked:next.blocked}});return next;
 }));
});
router.get('/posts',async(req,res)=>{const f=filters(req),w=where();if(f.q)w.add("(u.email ILIKE ? OR c.name ILIKE ? OR p.body ILIKE ? OR p.youtube_title ILIKE ?)",'%'+f.q+'%');if(f.platform)w.add('c.platform=?',f.platform);if(f.status==='overdue')w.clauses.push("p.status='scheduled' AND p.scheduled_at<=now()");else if(f.status==='attention')w.clauses.push("p.status IN ('failed','uncertain')");else if(f.status)w.add('p.status=?',f.status);await list(res,`SELECT p.id,p.status,p.scheduled_at,p.youtube_title,left(p.body,160) AS body,u.email AS owner,c.name AS channel_name,c.platform,u.blocked AS owner_blocked,
 (SELECT d.error FROM deliveries d WHERE d.post_id=p.id ORDER BY d.id DESC LIMIT 1) AS error,count(*) OVER() AS total_count
 FROM posts p JOIN users u ON u.id=p.user_id JOIN channels c ON c.id=p.channel_id${w.sql()} ORDER BY p.scheduled_at DESC,p.id DESC`,w.values,f.page);});
router.get('/posts/:id',async(req,res)=>{
 const post=take(await db.query(`SELECT p.id,p.status,p.scheduled_at,p.youtube_title,p.youtube_privacy,p.youtube_made_for_kids,p.body,p.silent,p.protect_content,c.name AS channel_name,c.platform,u.email AS owner,u.blocked AS owner_blocked FROM posts p JOIN channels c ON c.id=p.channel_id JOIN users u ON u.id=p.user_id WHERE p.id=$1`,[req.params.id]));
 const {rows:attachments}=await db.query('SELECT id,name,mime,kind,size FROM attachments WHERE post_id=$1 ORDER BY position,id',[post.id]);
 const {rows:deliveries}=await db.query('SELECT attempted_at,completed_at,external_id,error FROM deliveries WHERE post_id=$1 ORDER BY id DESC',[post.id]);res.json({...post,attachments,deliveries});
});
router.patch('/posts/:id',fields(z.discriminatedUnion('action',[
 z.object({action:z.literal('cancel')}),z.object({action:z.literal('reschedule'),scheduled_at:z.iso.datetime()}),
])),async(req,res)=>{
 const id=Number(req.params.id);res.json(await mutation(req,async client=>{
  const post=take(await client.query('SELECT id,status,scheduled_at FROM posts WHERE id=$1 FOR UPDATE',[id]));
  if(!['draft','scheduled','failed'].includes(post.status))throw error(409,'Нельзя менять отправляемую, опубликованную публикацию или отправку с неизвестным результатом');
  if(req.input.action==='reschedule'&&Date.parse(req.input.scheduled_at)<=Date.now())throw error(400,'Выберите время в будущем');
  const status=req.input.action==='cancel'?'draft':'scheduled';
  const at=req.input.action==='reschedule'?req.input.scheduled_at:post.scheduled_at;
  await client.query('UPDATE posts SET status=$1,scheduled_at=$2,updated_at=now() WHERE id=$3',[status,at,id]);
  await audit(client,req.userId,'post.'+req.input.action,'post',id,{before:post.status,after:status,scheduled_at:at});return {id,status,scheduled_at:at};
 }));
});
router.get('/channels',async(req,res)=>{const f=filters(req),w=where();if(f.q)w.add('(c.name ILIKE ? OR u.email ILIKE ? OR c.destination ILIKE ?)','%'+f.q+'%');if(f.platform)w.add('c.platform=?',f.platform);await list(res,`SELECT c.id,c.name,c.platform,c.destination,u.email AS owner,
 (SELECT count(*)::int FROM posts p WHERE p.channel_id=c.id) AS posts,
 (SELECT count(*)::int FROM posts p WHERE p.channel_id=c.id AND p.status='scheduled') AS scheduled,
 count(*) OVER() AS total_count FROM channels c JOIN users u ON u.id=c.user_id${w.sql()} ORDER BY c.id DESC`,w.values,f.page);});
router.get('/media',async(req,res)=>{const f=filters(req),w=where();w.clauses.push('a.post_id IS NULL');if(f.q)w.add('(a.name ILIKE ? OR u.email ILIKE ?)','%'+f.q+'%');await list(res,`SELECT a.id,a.name,a.kind,a.mime,a.size,u.email AS owner,count(*) OVER() AS total_count FROM attachments a JOIN users u ON u.id=a.user_id${w.sql()} ORDER BY a.id DESC`,w.values,f.page);});
router.delete('/media/:id',async(req,res)=>{await mutation(req,async client=>{const file=take(await client.query('DELETE FROM attachments WHERE id=$1 AND post_id IS NULL RETURNING id,size',[req.params.id]));await audit(client,req.userId,'media.delete','media',file.id,{size:file.size});});res.sendStatus(204);});
router.get('/events',async(req,res)=>{const f=filters(req),w=where();if(f.q)w.add('(u.email ILIKE ? OR e.action ILIKE ?)','%'+f.q+'%');await list(res,`SELECT e.id,e.action,e.resource,e.resource_id,e.details,e.created_at,u.email AS actor,count(*) OVER() AS total_count FROM admin_events e LEFT JOIN users u ON u.id=e.actor_id${w.sql()} ORDER BY e.id DESC`,w.values,f.page);});
export default router;
