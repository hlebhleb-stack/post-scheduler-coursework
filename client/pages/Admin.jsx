import React,{useEffect,useState} from 'react';
import {Search} from 'lucide-react';
import {request} from '../services/api.js';
import {Status} from '../components/Common.jsx';
import {PlatformIcon} from '../components/PlatformIcon.jsx';
import {useAuth} from '../context/AuthContext.jsx';
import {labels,time} from '../config.js';
import {FormField} from '../components/FormField.jsx';
const tabs={overview:'Обзор',users:'Пользователи',posts:'Публикации',channels:'Каналы',media:'Медиатека',events:'Журнал'};
const actions={'user.update':'Изменены права или доступ','post.cancel':'Публикация снята с расписания','post.reschedule':'Изменено время отправки','media.delete':'Удалён файл медиатеки'};
const size=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(Number(value)/1048576)+' МБ';
function localDate(value){const date=new Date(value);return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export default function Admin(){
 const {session}=useAuth();
 const [tab,setTab]=useState('overview'),[search,setSearch]=useState(''),[q,setQ]=useState(''),[filter,setFilter]=useState(''),[page,setPage]=useState(1),[revision,setRevision]=useState(0);
 const [data,setData]=useState(null),[overview,setOverview]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState(false),[detail,setDetail]=useState(null),[detailLoading,setDetailLoading]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>{setQ(search);setPage(1);},250);return()=>clearTimeout(timer);},[search]);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');setData(null);
  const params=new URLSearchParams({q,page:String(page)});
  if(filter)params.set(tab==='users'?'access':tab==='posts'?'status':'platform',filter);
  Promise.all([request('admin/overview',{signal:controller.signal}),tab==='overview'?Promise.resolve(null):request('admin/'+tab+'?'+params,{signal:controller.signal})])
   .then(([summary,result])=>{if(!controller.signal.aborted){setOverview(summary);setData(result);}})
   .catch(err=>{if(!controller.signal.aborted)setError(err.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[tab,q,filter,page,revision]);
 function select(value){setTab(value);setSearch('');setQ('');setFilter('');setPage(1);setDetail(null);setNotice('');setError('');}
 async function mutate(path,method,body,message){setPending(true);setError('');setNotice('');try{await request(path,{method,body});setNotice(message);setRevision(value=>value+1);setDetail(null);return true;}catch(err){setError(err.message);return false;}finally{setPending(false);}}
 async function inspect(id){setDetail(null);setDetailLoading(true);setError('');try{setDetail(await request('admin/posts/'+id));}catch(err){setError(err.message);}finally{setDetailLoading(false);}}
 const counts=overview?.counts;
 return <section className="adminPage" aria-label="Администрирование"><h1 className="visuallyHidden">Администрирование</h1>
  <header className="adminHeader"><div className="adminSections" role="group" aria-label="Разделы администрирования">{Object.entries(tabs).map(([key,label])=><button type="button" key={key} className={tab===key?'selected':''} aria-pressed={tab===key} onClick={()=>select(key)}>{label}</button>)}</div><button className="secondary" disabled={loading||pending} onClick={()=>setRevision(value=>value+1)}>Обновить</button></header>
  {error&&<p className="inlineError adminFeedback" role="alert">{error}</p>}{notice&&<p className="adminNotice" role="status">{notice}</p>}
  {tab==='overview'&&counts&&<>
   <div className="adminMetrics">{[['users','Пользователи','users'],['posts','Публикации','posts'],['scheduled','В расписании','posts'],['failed','Требуют проверки','posts']].map(([key,label,target])=><button key={key} onClick={()=>{select(target);if(key==='scheduled')setFilter('scheduled');if(key==='failed')setFilter('attention');}}><span>{label}</span><strong>{counts[key]}</strong></button>)}</div>
   <div className="adminSummary"><span>Каналов — {counts.channels}</span><span>Файлов — {counts.media}</span><span>Хранилище — {size(counts.storage_bytes)}</span><span>Заблокировано — {counts.blocked}</span></div>
   <section className="adminIssues"><div className="sectionHeading"><h2>Требуют внимания</h2><button className="quiet" onClick={()=>{select('posts');setFilter('overdue');}}>Просроченные — {counts.overdue}</button></div>
    {!overview.problems.length?<p className="muted">Проблем с отправкой нет</p>:overview.problems.map(post=><div className="adminIssue" key={post.id}><PlatformIcon platform={post.platform}/><div><strong>Публикация №{post.id}</strong><p>{post.error||'Время отправки прошло. Проверьте работу обработчика расписания.'}</p><small>{time(post.scheduled_at)}</small></div><Status status={post.status}/><button className="quiet" disabled={pending} onClick={()=>inspect(post.id)}>Подробнее</button></div>)}
   </section>
  </>}
  {tab!=='overview'&&<>
   <div className="adminToolbar"><div className="searchField"><Search size={17} aria-hidden="true"/><input aria-label="Поиск в администрировании" placeholder={tab==='users'?'Поиск по email':tab==='events'?'Поиск по автору или действию':'Поиск по названию или владельцу'} value={search} maxLength={120} onChange={event=>setSearch(event.target.value)}/></div>
    {['users','posts','channels'].includes(tab)&&<select aria-label="Фильтр списка" value={filter} onChange={event=>{setFilter(event.target.value);setPage(1);setDetail(null);}}>
     <option value="">{tab==='users'?'Все пользователи':tab==='posts'?'Все статусы':'Все платформы'}</option>
     {tab==='users'?<><option value="active">Активные</option><option value="blocked">Заблокированные</option></>:tab==='posts'?<><option value="overdue">Просроченные</option><option value="attention">Ошибки и неизвестный результат</option>{Object.entries(labels).map(([key,value])=><option key={key} value={key}>{value}</option>)}</>:<><option value="telegram">Telegram</option><option value="youtube">YouTube</option></>}
    </select>}
    <span className="muted">{loading?'Загрузка…':`Найдено — ${data?.total||0}`}</span>
   </div>
   {!loading&&data&&!data.items.length&&<div className="empty"><strong>{q||filter?'Совпадений нет':'Записей пока нет'}</strong>{(q||filter)&&<button className="quiet" onClick={()=>{setSearch('');setQ('');setFilter('');setPage(1);}}>Сбросить фильтры</button>}</div>}
   {!loading&&data?.items.length>0&&<div className="adminRecords">{data.items.map(row=><article className={'adminRecord '+tab} key={row.id}>
    {tab==='users'&&<><div className="adminRecordTitle"><strong>{row.email}{row.email===session.email?' · Вы':''}</strong><small>Каналы {row.channels} · Публикации {row.posts} · Файлы {row.media}</small></div><span className={row.blocked?'adminBlocked':'muted'}>{row.blocked?'Заблокирован':'Активен'}</span><select aria-label={'Роль '+row.email} value={row.role} disabled={pending||row.email===session.email} onChange={event=>{const role=event.target.value;if(window.confirm(`Изменить роль ${row.email} на «${role==='admin'?'Администратор':'Пользователь'}»?`))mutate('admin/users/'+row.id,'PATCH',{role},'Роль пользователя изменена');}}><option value="user">Пользователь</option><option value="admin">Администратор</option></select><button className={row.blocked?'secondary':'danger'} disabled={pending||row.email===session.email} onClick={()=>{if(window.confirm(row.blocked?`Разблокировать ${row.email}?`:`Заблокировать ${row.email}? Вход будет закрыт, запланированные отправки приостановятся. Уже начатая отправка может завершиться.`))mutate('admin/users/'+row.id,'PATCH',{blocked:!row.blocked},row.blocked?'Пользователь разблокирован':'Пользователь заблокирован');}}>{row.blocked?'Разблокировать':'Заблокировать'}</button></>}
    {tab==='posts'&&<><PlatformIcon platform={row.platform}/><div className="adminRecordTitle"><strong>{row.youtube_title||row.body||'Вложение'}</strong><small>{row.owner} · {row.channel_name}</small>{row.owner_blocked&&<small className="adminBlocked">Владелец заблокирован — очередь приостановлена</small>}{row.error&&<small className="adminBlocked">{row.error}</small>}</div><time>{time(row.scheduled_at)}</time><Status status={row.status}/><button className="quiet" disabled={pending} onClick={()=>inspect(row.id)}>Подробнее</button></>}
    {tab==='channels'&&<><PlatformIcon platform={row.platform}/><div className="adminRecordTitle"><strong>{row.name}</strong><small>{row.owner}</small><small>{row.destination}</small></div><span>Публикаций — {row.posts}</span><span className="muted">В расписании — {row.scheduled}</span></>}
    {tab==='media'&&<><div className="adminRecordTitle"><strong>{row.name}</strong><small>{row.owner} · {row.mime}</small></div><span className="muted">{size(row.size)}</span><button className="danger" disabled={pending} onClick={()=>{if(window.confirm(`Удалить файл «${row.name}» из медиатеки ${row.owner}? Копии в публикациях сохранятся.`))mutate('admin/media/'+row.id,'DELETE',undefined,'Файл удалён из медиатеки');}}>Удалить файл</button></>}
    {tab==='events'&&<><div className="adminRecordTitle"><strong>{actions[row.action]||row.action}</strong><small>{row.actor||'Администратор недоступен'} · №{row.resource_id}</small>{row.action==='user.update'&&<small>{row.details.after?.role==='admin'?'Администратор':'Пользователь'} · {row.details.after?.blocked?'заблокирован':'активен'}</small>}</div><time>{time(row.created_at)}</time></>}
   </article>)}</div>}
   {data&&<footer className="adminPagination"><span>Страница {page}{data.total?` из ${Math.ceil(data.total/data.limit)}`:''}</span><div><button className="quiet" disabled={loading||page===1} onClick={()=>{setPage(value=>value-1);setDetail(null);}}>Назад</button><button className="quiet" disabled={loading||data.items.length<data.limit||page*data.limit>=data.total} onClick={()=>{setPage(value=>value+1);setDetail(null);}}>Далее</button></div></footer>}
  </>}
  {loading&&<p className="muted" role="status">Загрузка данных…</p>}{detailLoading&&<p className="muted" role="status">Загрузка публикации…</p>}
  {detail&&<PostInspector key={detail.id} post={detail} pending={pending} close={()=>setDetail(null)} mutate={mutate}/>}
 </section>;
}
function PostInspector({post,pending,close,mutate}){
 const [at,setAt]=useState(localDate(Date.now()+600000));const editable=['draft','scheduled','failed'].includes(post.status);
 return <section className="adminInspector" aria-label={'Публикация №'+post.id}><header className="sectionHeading"><div><h2>{post.youtube_title||'Публикация №'+post.id}</h2><p>{post.owner} · {post.channel_name}</p></div><button className="quiet" onClick={close}>Закрыть</button></header>
  <Status status={post.status}/>{post.body&&<p className="bodyText">{post.body}</p>}
  {post.attachments.length>0&&<ul className="adminAttachmentNames">{post.attachments.map(file=><li key={file.id}>{file.name} · {size(file.size)}</li>)}</ul>}
  {post.owner_blocked&&<p className="inlineError">Владелец заблокирован. Отправка возобновится после разблокировки.</p>}
  {post.deliveries.length>0&&<div className="adminHistory"><h2>История отправки</h2>{post.deliveries.map((item,index)=><p key={index}>{time(item.attempted_at)} · {item.error|| (item.external_id?'Подтверждено: '+item.external_id:'Ответ не подтверждён')}</p>)}</div>}
  {post.status==='uncertain'&&<p className="muted">Результат отправки неизвестен. Проверьте канал на платформе — повторная отправка может создать дубликат.</p>}
  {editable&&<form className="adminSchedule" onSubmit={event=>{event.preventDefault();if(!at||!Number.isFinite(Date.parse(at)))return;if(window.confirm('Изменить расписание и поставить публикацию в очередь?'))mutate('admin/posts/'+post.id,'PATCH',{action:'reschedule',scheduled_at:new Date(at).toISOString()},'Публикация запланирована');}}>
   <FormField name="admin-scheduled-at" label="Новое время отправки"><input type="datetime-local" value={at} required onChange={event=>setAt(event.target.value)}/></FormField><button className="primary" disabled={pending||post.owner_blocked}>Запланировать</button>
   {post.status!=='draft'&&<button className="quiet" type="button" disabled={pending} onClick={()=>{if(window.confirm('Снять публикацию с расписания и сохранить как черновик?'))mutate('admin/posts/'+post.id,'PATCH',{action:'cancel'},'Публикация сохранена как черновик');}}>В черновик</button>}
  </form>}
 </section>;
}
