import { AdminOverview } from '../components/admin/AdminOverview.jsx';
import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { request } from '../services/api.js';

import { useAuth } from '../context/AuthContext.jsx';
import { labels } from '../config.js';
import { PostInspector } from '../components/admin/PostInspector.jsx';
import { AdminRecord } from '../components/admin/AdminRecord.jsx';

const tabs = {
  overview: 'Обзор',
  users: 'Пользователи',
  posts: 'Публикации',
  channels: 'Каналы',
  media: 'Медиатека',
  events: 'Журнал',
};
export default function Admin() {
  const { session } = useAuth();
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    const params = new URLSearchParams({ q, page: String(page) });
    if (filter)
      params.set(tab === 'users' ? 'access' : tab === 'posts' ? 'status' : 'platform', filter);
    Promise.all([
      request('admin/overview', { signal: controller.signal }),
      tab === 'overview'
        ? Promise.resolve(null)
        : request('admin/' + tab + '?' + params, { signal: controller.signal }),
    ])
      .then(([summary, result]) => {
        if (!controller.signal.aborted) {
          setOverview(summary);
          setData(result);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [tab, q, filter, page, revision]);
  function select(value) {
    setTab(value);
    setSearch('');
    setQ('');
    setFilter('');
    setPage(1);
    setDetail(null);
    setNotice('');
    setError('');
  }
  async function mutate(path, method, body, message) {
    setPending(true);
    setError('');
    setNotice('');
    try {
      await request(path, { method, body });
      setNotice(message);
      setRevision((value) => value + 1);
      setDetail(null);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setPending(false);
    }
  }
  async function inspect(id) {
    setDetail(null);
    setDetailLoading(true);
    setError('');
    try {
      setDetail(await request('admin/posts/' + id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }
  const counts = overview?.counts;
  return (
    <section className="adminPage" aria-label="Администрирование">
      <h1 className="visuallyHidden">Администрирование</h1>
      <header className="adminHeader">
        <div className="adminSections" role="group" aria-label="Разделы администрирования">
          {Object.entries(tabs).map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={tab === key ? 'selected' : ''}
              aria-pressed={tab === key}
              onClick={() => select(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="secondary"
          disabled={loading || pending}
          onClick={() => setRevision((value) => value + 1)}
        >
          Обновить
        </button>
      </header>
      {error && (
        <p className="inlineError adminFeedback" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="adminNotice" role="status">
          {notice}
        </p>
      )}
      {tab === 'overview' && counts && (
        <AdminOverview
          counts={counts}
          problems={overview.problems}
          pending={pending}
          select={select}
          setFilter={setFilter}
          inspect={inspect}
        />
      )}
      {tab !== 'overview' && (
        <>
          <div className="adminToolbar">
            <div className="searchField">
              <Search size={17} aria-hidden="true" />
              <input
                aria-label="Поиск в администрировании"
                placeholder={
                  tab === 'users'
                    ? 'Поиск по email'
                    : tab === 'events'
                      ? 'Поиск по автору или действию'
                      : 'Поиск по названию или владельцу'
                }
                value={search}
                maxLength={120}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {['users', 'posts', 'channels'].includes(tab) && (
              <select
                aria-label="Фильтр списка"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setPage(1);
                  setDetail(null);
                }}
              >
                <option value="">
                  {tab === 'users'
                    ? 'Все пользователи'
                    : tab === 'posts'
                      ? 'Все статусы'
                      : 'Все платформы'}
                </option>
                {tab === 'users' ? (
                  <>
                    <option value="active">Активные</option>
                    <option value="blocked">Заблокированные</option>
                  </>
                ) : tab === 'posts' ? (
                  <>
                    <option value="overdue">Просроченные</option>
                    <option value="attention">Ошибки и неизвестный результат</option>
                    {Object.entries(labels).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value="telegram">Telegram</option>
                    <option value="youtube">YouTube</option>
                  </>
                )}
              </select>
            )}
            <span className="muted">{loading ? 'Загрузка…' : `Найдено — ${data?.total || 0}`}</span>
          </div>
          {!loading && data && !data.items.length && (
            <div className="empty">
              <strong>{q || filter ? 'Совпадений нет' : 'Записей пока нет'}</strong>
              {(q || filter) && (
                <button
                  className="quiet"
                  onClick={() => {
                    setSearch('');
                    setQ('');
                    setFilter('');
                    setPage(1);
                  }}
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          )}
          {!loading && data?.items.length > 0 && (
            <div className="adminRecords">
              {data.items.map((row) => (
                <AdminRecord
                  key={row.id}
                  row={row}
                  tab={tab}
                  pending={pending}
                  session={session}
                  mutate={mutate}
                  inspect={inspect}
                />
              ))}
            </div>
          )}
          {data && (
            <footer className="adminPagination">
              <span>
                Страница {page}
                {data.total ? ` из ${Math.ceil(data.total / data.limit)}` : ''}
              </span>
              <div>
                <button
                  className="quiet"
                  disabled={loading || page === 1}
                  onClick={() => {
                    setPage((value) => value - 1);
                    setDetail(null);
                  }}
                >
                  Назад
                </button>
                <button
                  className="quiet"
                  disabled={
                    loading || data.items.length < data.limit || page * data.limit >= data.total
                  }
                  onClick={() => {
                    setPage((value) => value + 1);
                    setDetail(null);
                  }}
                >
                  Далее
                </button>
              </div>
            </footer>
          )}
        </>
      )}
      {loading && (
        <p className="muted" role="status">
          Загрузка данных…
        </p>
      )}
      {detailLoading && (
        <p className="muted" role="status">
          Загрузка публикации…
        </p>
      )}
      {detail && (
        <PostInspector
          key={detail.id}
          post={detail}
          pending={pending}
          close={() => setDetail(null)}
          mutate={mutate}
        />
      )}
    </section>
  );
}
