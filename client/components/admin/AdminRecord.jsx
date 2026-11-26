import React from 'react';
import { Status } from '../Common.jsx';
import { PlatformIcon } from '../PlatformIcon.jsx';
import { time } from '../../config.js';
import { fileSize } from '../../lib/format.js';

const actions = {
  'user.update': 'Изменены права или доступ',
  'post.cancel': 'Публикация снята с расписания',
  'post.reschedule': 'Изменено время отправки',
  'media.delete': 'Удалён файл медиатеки',
};

export function AdminRecord({ row, tab, pending, session, mutate, inspect }) {
  return (
    <article className={'adminRecord ' + tab}>
      {tab === 'users' && (
        <>
          <div className="adminRecordTitle">
            <strong>
              {row.email}
              {row.email === session.email ? ' · Вы' : ''}
            </strong>
            <small>
              Каналы {row.channels} · Публикации {row.posts} · Файлы {row.media}
            </small>
          </div>
          <span className={row.blocked ? 'adminBlocked' : 'muted'}>
            {row.blocked ? 'Заблокирован' : 'Активен'}
          </span>
          <select
            aria-label={'Роль ' + row.email}
            value={row.role}
            disabled={pending || row.email === session.email}
            onChange={(event) => {
              const role = event.target.value;
              if (
                window.confirm(
                  `Изменить роль ${row.email} на «${role === 'admin' ? 'Администратор' : 'Пользователь'}»?`,
                )
              )
                mutate('admin/users/' + row.id, 'PATCH', { role }, 'Роль пользователя изменена');
            }}
          >
            <option value="user">Пользователь</option>
            <option value="admin">Администратор</option>
          </select>
          <button
            className={row.blocked ? 'secondary' : 'danger'}
            disabled={pending || row.email === session.email}
            onClick={() => {
              if (
                window.confirm(
                  row.blocked
                    ? `Разблокировать ${row.email}?`
                    : `Заблокировать ${row.email}? Вход будет закрыт, запланированные отправки приостановятся. Уже начатая отправка может завершиться.`,
                )
              )
                mutate(
                  'admin/users/' + row.id,
                  'PATCH',
                  { blocked: !row.blocked },
                  row.blocked ? 'Пользователь разблокирован' : 'Пользователь заблокирован',
                );
            }}
          >
            {row.blocked ? 'Разблокировать' : 'Заблокировать'}
          </button>
        </>
      )}
      {tab === 'posts' && (
        <>
          <PlatformIcon platform={row.platform} />
          <div className="adminRecordTitle">
            <strong>{row.youtube_title || row.body || 'Вложение'}</strong>
            <small>
              {row.owner} · {row.channel_name}
            </small>
            {row.owner_blocked && (
              <small className="adminBlocked">Владелец заблокирован — очередь приостановлена</small>
            )}
            {row.error && <small className="adminBlocked">{row.error}</small>}
          </div>
          <time>{time(row.scheduled_at)}</time>
          <Status status={row.status} />
          <button className="quiet" disabled={pending} onClick={() => inspect(row.id)}>
            Подробнее
          </button>
        </>
      )}
      {tab === 'channels' && (
        <>
          <PlatformIcon platform={row.platform} />
          <div className="adminRecordTitle">
            <strong>{row.name}</strong>
            <small>{row.owner}</small>
            <small>{row.destination}</small>
          </div>
          <span>Публикаций — {row.posts}</span>
          <span className="muted">В расписании — {row.scheduled}</span>
        </>
      )}
      {tab === 'media' && (
        <>
          <div className="adminRecordTitle">
            <strong>{row.name}</strong>
            <small>
              {row.owner} · {row.mime}
            </small>
          </div>
          <span className="muted">{fileSize(row.size)}</span>
          <button
            className="danger"
            disabled={pending}
            onClick={() => {
              if (
                window.confirm(
                  `Удалить файл «${row.name}» из медиатеки ${row.owner}? Копии в публикациях сохранятся.`,
                )
              )
                mutate('admin/media/' + row.id, 'DELETE', undefined, 'Файл удалён из медиатеки');
            }}
          >
            Удалить файл
          </button>
        </>
      )}
      {tab === 'events' && (
        <>
          <div className="adminRecordTitle">
            <strong>{actions[row.action] || row.action}</strong>
            <small>
              {row.actor || 'Администратор недоступен'} · №{row.resource_id}
            </small>
            {row.action === 'user.update' && (
              <small>
                {row.details.after?.role === 'admin' ? 'Администратор' : 'Пользователь'} ·{' '}
                {row.details.after?.blocked ? 'заблокирован' : 'активен'}
              </small>
            )}
          </div>
          <time>{time(row.created_at)}</time>
        </>
      )}
    </article>
  );
}
