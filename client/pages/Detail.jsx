import React,{useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {platforms,time} from '../config.js';
import {request} from '../services/api.js';
import {useData} from '../hooks/useData.js';
import {Status,Feedback,Back} from '../components/Common.jsx';
import {RichText,AttachmentList} from '../Composer.jsx';
export default function Detail({ kind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const result = useData(kind, id);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const data = result.data;
  async function remove() {
    if (!window.confirm('Удалить запись?')) return;
    setError('');
    setPending(true);
    try {
      await request(kind + '/' + id, { method:'DELETE' });
      navigate('/' + kind);
    } catch (error) {
      setError(error.message);
    } finally {
      setPending(false);
    }
  }
  return <section className="formPage"><Back kind={kind}/>{!data ? <Feedback result={result}/> : <>
    <header className="pageHeading"><div><h1>{data.name || 'Публикация'}</h1>{data.status && <Status status={data.status}/>}</div></header>
    <div className="formPanel detail">
      {data.telegram_html ? <RichText body={data.body} html={data.telegram_html} readOnly/> : data.body && <p className="bodyText">{data.body}</p>}
      {data.attachments?.length > 0 && <AttachmentList files={data.attachments}/>}
      {data.silent && <p className="muted">Без звука</p>}
      {data.protect_content && <p className="muted">Защита от копирования включена</p>}
      {data.platform && <dl><dt>Платформа</dt><dd>{platforms[data.platform]}</dd>
        {data.destination && <><dt>{data.platform === 'telegram' ? 'ID канала' : 'ID аккаунта'}</dt><dd>{data.destination}</dd></>}
        {data.channel_name && <><dt>Канал</dt><dd>{data.channel_name}</dd></>}
        {data.scheduled_at && <><dt>Время</dt><dd>{time(data.scheduled_at)}</dd></>}</dl>}
      {data.deliveries?.length > 0 && <div className="delivery"><h2>История отправки</h2>
        {data.deliveries.map((item, index) => <p key={index}>{time(item.attempted_at)} · {item.external_id ? 'ID: ' + item.external_id : item.error || 'Ответ не подтверждён'}</p>)}</div>}
      {data.status === 'uncertain' && <p>Проверь платформу перед созданием повторной публикации.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions">
        {!['publishing','published','uncertain'].includes(data.status) && <Link className="secondary" to={'/' + kind + '/' + id + '/edit'}>Редактировать</Link>}
        {data.status !== 'publishing' && <button className="danger" type="button" disabled={pending} onClick={remove}>Удалить</button>}
        {data.status && <button className="quiet" onClick={() => window.location.reload()}>Обновить статус</button>}
      </div>
    </div>
  </>}</section>;
}

