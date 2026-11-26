import React, { useState } from 'react';
import { Status } from '../Common.jsx';
import { FormField } from '../FormField.jsx';
import { time } from '../../config.js';
import { fileSize, localDateTime } from '../../lib/format.js';

export function PostInspector({ post, pending, close, mutate }) {
  const [at, setAt] = useState(localDateTime(Date.now() + 600000));
  const editable = ['draft', 'scheduled', 'failed'].includes(post.status);
  return (
    <section className="adminInspector" aria-label={'Публикация №' + post.id}>
      <header className="sectionHeading">
        <div>
          <h2>{post.youtube_title || 'Публикация №' + post.id}</h2>
          <p>
            {post.owner} · {post.channel_name}
          </p>
        </div>
        <button className="quiet" onClick={close}>
          Закрыть
        </button>
      </header>
      <Status status={post.status} />
      {post.body && <p className="bodyText">{post.body}</p>}
      {post.attachments.length > 0 && (
        <ul className="adminAttachmentNames">
          {post.attachments.map((file) => (
            <li key={file.id}>
              {file.name} · {fileSize(file.size)}
            </li>
          ))}
        </ul>
      )}
      {post.owner_blocked && (
        <p className="inlineError">
          Владелец заблокирован. Отправка возобновится после разблокировки.
        </p>
      )}
      {post.deliveries.length > 0 && (
        <div className="adminHistory">
          <h2>История отправки</h2>
          {post.deliveries.map((item, index) => (
            <p key={index}>
              {time(item.attempted_at)} ·{' '}
              {item.error ||
                (item.external_id ? 'Подтверждено: ' + item.external_id : 'Ответ не подтверждён')}
            </p>
          ))}
        </div>
      )}
      {post.status === 'uncertain' && (
        <p className="muted">
          Результат отправки неизвестен. Проверьте канал на платформе — повторная отправка может
          создать дубликат.
        </p>
      )}
      {editable && (
        <form
          className="adminSchedule"
          onSubmit={(event) => {
            event.preventDefault();
            if (!at || !Number.isFinite(Date.parse(at))) return;
            if (window.confirm('Изменить расписание и поставить публикацию в очередь?'))
              mutate(
                'admin/posts/' + post.id,
                'PATCH',
                { action: 'reschedule', scheduled_at: new Date(at).toISOString() },
                'Публикация запланирована',
              );
          }}
        >
          <FormField name="admin-scheduled-at" label="Новое время отправки">
            <input
              type="datetime-local"
              value={at}
              required
              onChange={(event) => setAt(event.target.value)}
            />
          </FormField>
          <button className="primary" disabled={pending || post.owner_blocked}>
            Запланировать
          </button>
          {post.status !== 'draft' && (
            <button
              className="quiet"
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm('Снять публикацию с расписания и сохранить как черновик?'))
                  mutate(
                    'admin/posts/' + post.id,
                    'PATCH',
                    { action: 'cancel' },
                    'Публикация сохранена как черновик',
                  );
              }}
            >
              В черновик
            </button>
          )}
        </form>
      )}
    </section>
  );
}
