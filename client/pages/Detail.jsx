import { DeleteButton } from '../components/ui/DeleteButton.jsx';
import { toast } from '../components/ui/Toast.jsx';
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { platforms, time } from '../config.js';
import { request } from '../services/api.js';
import { useData } from '../hooks/useData.js';
import { Status, Feedback, Back } from '../components/Common.jsx';
import { RichText } from '../components/editor/RichText.jsx';
import { AttachmentList } from '../components/editor/AttachmentList.jsx';
export default function Detail({ kind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const result = useData(kind, id);
  const [pending, setPending] = useState(false);
  const data = result.data;
  async function remove() {
    setPending(true);
    try {
      await request(kind + '/' + id, { method: 'DELETE' });
      toast.success(kind === 'posts' ? 'Публикация удалена' : 'Канал удалён');
      navigate('/' + kind);
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="formPage">
      <Back kind={kind} />
      {!data ? (
        <Feedback result={result} />
      ) : (
        <>
          <header className="pageHeading">
            <div>
              <h1>{data.name || data.youtube_title || 'Публикация'}</h1>
              {data.status && <Status status={data.status} />}
            </div>
          </header>
          <div className="formPanel detail">
            {data.telegram_html ? (
              <RichText body={data.body} html={data.telegram_html} readOnly />
            ) : (
              data.body && <p className="bodyText">{data.body}</p>
            )}
            {data.attachments?.length > 0 && <AttachmentList files={data.attachments} />}
            {data.platform === 'youtube' && kind === 'posts' && (
              <p className="muted">
                Доступ:{' '}
                {
                  { unlisted: 'по ссылке', private: 'только мне', public: 'для всех' }[
                    data.youtube_privacy
                  ]
                }
                . После загрузки YouTube обрабатывает видео.
              </p>
            )}
            {data.silent && <p className="muted">Без звука</p>}
            {data.protect_content && <p className="muted">Защита от копирования включена</p>}
            {data.platform && (
              <dl>
                <dt>Платформа</dt>
                <dd>{platforms[data.platform]}</dd>
                {data.destination && (
                  <>
                    <dt>{data.platform === 'telegram' ? 'ID канала' : 'ID аккаунта'}</dt>
                    <dd>{data.destination}</dd>
                  </>
                )}
                {data.channel_name && (
                  <>
                    <dt>Канал</dt>
                    <dd>{data.channel_name}</dd>
                  </>
                )}
                {data.scheduled_at && (
                  <>
                    <dt>Время</dt>
                    <dd>{time(data.scheduled_at)}</dd>
                  </>
                )}
              </dl>
            )}
            {data.deliveries?.length > 0 && (
              <div className="delivery">
                <h2>История отправки</h2>
                {data.deliveries.map((item, index) => (
                  <p key={index}>
                    {time(item.attempted_at)} ·{' '}
                    {item.external_id
                      ? 'ID: ' + item.external_id
                      : item.error || 'Ответ не подтверждён'}
                  </p>
                ))}
              </div>
            )}
            {data.platform === 'youtube' && data.deliveries?.some((item) => item.external_id) && (
              <a
                className="quiet"
                target="_blank"
                rel="noopener noreferrer"
                href={
                  'https://www.youtube.com/watch?v=' +
                  encodeURIComponent(data.deliveries.find((item) => item.external_id).external_id)
                }
              >
                Открыть видео на YouTube
              </a>
            )}
            {data.status === 'uncertain' && (
              <p>Проверь платформу перед созданием повторной публикации.</p>
            )}
            <div className="actions">
              {!['publishing', 'published', 'uncertain'].includes(data.status) && (
                <Link className="secondary" to={'/' + kind + '/' + id + '/edit'}>
                  Редактировать
                </Link>
              )}
              {data.status !== 'publishing' && (
                <DeleteButton
                  disabled={pending}
                  onConfirm={remove}
                  label={'Удалить ' + (data.name || data.youtube_title || 'публикацию')}
                />
              )}
              {data.status && (
                <button className="quiet" onClick={() => window.location.reload()}>
                  Обновить статус
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
