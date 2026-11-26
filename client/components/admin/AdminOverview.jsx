import React from 'react';
import { Status } from '../Common.jsx';
import { PlatformIcon } from '../PlatformIcon.jsx';
import { time } from '../../config.js';
import { fileSize } from '../../lib/format.js';

export function AdminOverview({ counts, problems, pending, select, setFilter, inspect }) {
  return (
    <>
      <div className="adminMetrics">
        {[
          ['users', 'Пользователи', 'users'],
          ['posts', 'Публикации', 'posts'],
          ['scheduled', 'В расписании', 'posts'],
          ['failed', 'Требуют проверки', 'posts'],
        ].map(([key, label, target]) => (
          <button
            key={key}
            onClick={() => {
              select(target);
              if (key === 'scheduled') setFilter('scheduled');
              if (key === 'failed') setFilter('attention');
            }}
          >
            <span>{label}</span>
            <strong>{counts[key]}</strong>
          </button>
        ))}
      </div>
      <div className="adminSummary">
        <span>Каналов — {counts.channels}</span>
        <span>Файлов — {counts.media}</span>
        <span>Хранилище — {fileSize(counts.storage_bytes)}</span>
        <span>Заблокировано — {counts.blocked}</span>
      </div>
      <section className="adminIssues">
        <div className="sectionHeading">
          <h2>Требуют внимания</h2>
          <button
            className="quiet"
            onClick={() => {
              select('posts');
              setFilter('overdue');
            }}
          >
            Просроченные — {counts.overdue}
          </button>
        </div>
        {!problems.length ? (
          <p className="muted">Проблем с отправкой нет</p>
        ) : (
          problems.map((post) => (
            <div className="adminIssue" key={post.id}>
              <PlatformIcon platform={post.platform} />
              <div>
                <strong>Публикация №{post.id}</strong>
                <p>
                  {post.error || 'Время отправки прошло. Проверьте работу обработчика расписания.'}
                </p>
                <small>{time(post.scheduled_at)}</small>
              </div>
              <Status status={post.status} />
              <button className="quiet" disabled={pending} onClick={() => inspect(post.id)}>
                Подробнее
              </button>
            </div>
          ))
        )}
      </section>
    </>
  );
}
