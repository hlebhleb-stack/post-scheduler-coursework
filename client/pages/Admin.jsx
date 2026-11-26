import React from 'react';
import {useData} from '../hooks/useData.js';
import {Feedback,Status} from '../components/Common.jsx';
import {time,platforms} from '../config.js';
export default function Admin() {
  const result = useData('admin/overview');
  if (!result.data) return <Feedback result={result}/>;
  const {counts,problems} = result.data;
  return <section><header className="pageHeading"><h1>Администрирование</h1><button className="secondary" onClick={() => window.location.reload()}>Обновить</button></header>
    <div className="adminStats">{Object.entries({users:'Пользователи',channels:'Каналы',media:'Медиатека',posts:'Публикации',scheduled:'В расписании',overdue:'Просрочено',failed:'Требуют проверки'}).map(([key,title]) => <div key={key}><span>{title}</span><strong>{counts[key]}</strong></div>)}</div>
    <h2>Проблемы отправки</h2><div className="formPanel adminProblems">{problems.length ? problems.map(post => <div key={post.id}><strong>Публикация №{post.id}</strong><Status status={post.status}/><p>{platforms[post.platform]} · {time(post.scheduled_at)}</p><p>{post.error || 'Запланированное время прошло, публикация ожидает отправки'}</p></div>) : <p className="muted">Проблем с отправкой нет</p>}</div>
  </section>;
}
