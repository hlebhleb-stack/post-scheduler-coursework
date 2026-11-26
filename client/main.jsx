import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, FileText, Hash, LogOut, Plus, Search, X, Eye, EyeOff } from 'lucide-react';
import './style.css';
import { RichText, AttachmentList, FilePicker } from './Composer.jsx';

const sections = {
  posts: { title: 'Публикации', action: 'Создать публикацию', search: 'Поиск по тексту', empty: 'Публикаций пока нет', icon: CalendarDays },
  channels: { title: 'Каналы', action: 'Подключить канал', search: 'Поиск по названию', empty: 'Каналы пока не подключены', icon: Hash },
  templates: { title: 'Шаблоны', action: 'Создать шаблон', search: 'Поиск по названию', empty: 'Шаблонов пока нет', icon: FileText },
};
const labels = {
  draft: 'Черновик', scheduled: 'В расписании', publishing: 'Отправляется',
  published: 'Опубликовано', failed: 'Ошибка отправки', uncertain: 'Проверить вручную',
};
const platforms = { telegram: 'Telegram', instagram: 'Instagram' };
const time = date => new Date(date).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
const clock = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

const sessionKey = 'schedule-session';

async function request(path, options = {}) {
  const session = JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
  const result = await fetch('/api/' + path, {
    method: options.method || 'GET',
    signal: options.signal,
    headers: {
      ...(session ? { Authorization: 'Bearer ' + session.token } : {}),
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });
  if (result.status === 204) return null;
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    if (result.status === 401 && session && !path.startsWith('auth/')) {
      sessionStorage.removeItem(sessionKey);
      window.dispatchEvent(new Event('session-expired'));
    }
    throw new Error(data.error || 'Не удалось выполнить запрос');
  }
  return data;
}

function useData(kind, id) {
  const key = kind + '/' + (id || '');
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = id === 'new' ? Promise.resolve(null) : id ? request(kind + '/' + id, { signal: controller.signal })
      : request(kind, { signal: controller.signal });
    const references = kind === 'posts' && id === 'new' ? [
      request('channels', { signal: controller.signal }),
      request('templates', { signal: controller.signal }),
    ] : [];
    const calls = id === 'new' ? [Promise.resolve(null), ...references] : [load];
    Promise.all(calls)
      .then(([data, channels, templates]) => {
        if (!controller.signal.aborted) setResult({ key, data, channels, templates });
      })
      .catch(error => {
        if (!controller.signal.aborted) setResult({ key, error: error.message });
      });
    return () => controller.abort();
  }, [key, kind, id]);
  return result?.key === key ? result : {};
}

function Status({ status }) {
  return <span className={'status ' + status}>{labels[status]}</span>;
}

function Feedback({ result }) {
  return result.error ? <p role="alert" className="error">{result.error}</p>
    : <p role="status" className="muted">Загрузка…</p>;
}

function Auth({ onLogin, register }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setError('');
    try {
      if (register) await request('auth/register', { method: 'POST', body: input });
      const session = await request('auth/login', { method: 'POST', body: input });
      sessionStorage.setItem(sessionKey, JSON.stringify(session));
      onLogin(session);
      navigate('/posts');
    } catch (error) {
      setError(error.message);
    } finally {
      setPending(false);
    }
  }
  return <main className="auth">
    <form className="authForm" onSubmit={submit}>
      <div className="authHeading"><h1>{register ? 'Создать аккаунт' : 'С возвращением'}</h1>
        <p>{register ? 'Зарегистрируйтесь, чтобы планировать публикации.' : 'Войдите в свой планировщик.'}</p></div>
      <label>Электронная почта<input type="email" autoComplete="email" name="email" placeholder="name@example.com" required/></label>
      <div className="passwordGroup"><label htmlFor="auth-password">Пароль</label><div className="passwordField"><input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} name="password" minLength={register ? 8 : undefined} placeholder={register ? 'Минимум 8 символов' : 'Введите пароль'} required/>
        <button type="button" aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={pending}>{pending ? 'Подождите…' : register ? 'Зарегистрироваться' : 'Войти'}</button>
      <p className="authSwitch">{register ? 'Уже есть аккаунт?' : 'Нет аккаунта?'} <Link to={register ? '/login' : '/register'}>{register ? 'Войти' : 'Зарегистрироваться'}</Link></p>
    </form>
  </main>;
}

function Layout({ session, logout }) {
  return <div className="shell"><aside className="sidebar">
    <nav aria-label="Разделы">{Object.entries(sections).map(([key, {title, icon: Icon}]) =>
      <NavLink key={key} to={'/' + key}><Icon size={18}/>{title}</NavLink>)}</nav>
    <div className="identity"><span title={session.email}>{session.email}</span><button type="button" className="quiet logout" onClick={logout}><LogOut size={17} aria-hidden="true"/> Выйти</button></div>
  </aside><main className="workspace"><Routes>
    {Object.keys(sections).map(kind => <React.Fragment key={kind}>
      <Route path={kind} element={<List key={kind} kind={kind}/>}/>
      <Route path={kind + '/new'} element={<Editor key={kind + '/new'} kind={kind} create/>}/>
      <Route path={kind + '/:id'} element={<Detail key={kind + '/detail'} kind={kind}/>}/>
      <Route path={kind + '/:id/edit'} element={<Editor key={kind + '/edit'} kind={kind}/>}/>
    </React.Fragment>)}
    <Route path="*" element={<Navigate to="/posts" replace/>}/>
  </Routes></main></div>;
}

function List({ kind }) {
  const result = useData(kind);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const meta = sections[kind];
  const rows = result.data?.filter(row => (
    (row.name || row.body).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    && (!status || row.status === status)
  ));
  return <section>
    <header className="pageHeading"><div><h1>{meta.title}</h1><p className="pageCount">{rows ? `${rows.length} ${kind === 'posts' ? 'в списке' : kind === 'channels' ? 'подключено' : 'в списке'}` : 'Загрузка…'}</p></div>
      <Link className="primary" to={'/' + kind + '/new'}><Plus size={18} aria-hidden="true"/> {meta.action}</Link></header>
    <div className="listPanel">
      <div className="filters"><div className="searchField"><Search size={17} aria-hidden="true"/>
        <input aria-label={meta.search} placeholder={meta.search} value={search} onChange={event => setSearch(event.target.value)}/>
        {search && <button type="button" onClick={() => setSearch('')} aria-label="Очистить поиск"><X size={16} aria-hidden="true"/></button>}
      </div>
        {kind === 'posts' && <select aria-label="Статус" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">Все статусы</option>{Object.entries(labels).map(([key,label]) => <option value={key} key={key}>{label}</option>)}
        </select>}</div>
      {!rows ? <div className="empty"><Feedback result={result}/></div> : rows.length ? <>
        <div className="tableHead"><span>{kind === 'posts' ? 'Публикация' : 'Название'}</span><span>{kind === 'posts' ? 'Дата и время' : kind === 'channels' ? 'Платформа' : 'Текст'}</span><span>{kind === 'posts' ? 'Статус' : ''}</span></div>
        <ul className="rows">{rows.map(row => <li key={row.id}><Link to={'/' + kind + '/' + row.id}>
          <span className="rowTitle"><strong>{row.name || row.body.slice(0, 90) || row.attachments?.[0]?.name || 'Вложение'}</strong>{row.channel_name && <small>{row.channel_name}</small>}</span>
          <span className="rowMeta">{row.scheduled_at ? <time dateTime={row.scheduled_at}>{day.format(new Date(row.scheduled_at))}<small>{clock.format(new Date(row.scheduled_at))}</small></time>
            : row.platform ? platforms[row.platform] : row.body.slice(0,55)}</span>
          <span className="rowEnd">{row.status && <Status status={row.status}/>}<ArrowRight size={16} aria-hidden="true"/></span></Link></li>)}</ul>
      </> : <div className="empty"><span className="emptyIcon"><meta.icon size={28} strokeWidth={1.4}/></span><strong>{search || status ? 'Совпадений нет' : meta.empty}</strong>
        {(search || status) && <button className="quiet" type="button" onClick={() => { setSearch(''); setStatus(''); }}>Сбросить фильтры</button>}</div>}
    </div>
  </section>;
}

function Back({ kind }) {
  return <Link className="back" to={'/' + kind}><ArrowLeft size={16}/>{sections[kind].title}</Link>;
}

function Detail({ kind }) {
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

function Editor({ kind, create = false }) {
  const { id } = useParams();
  const result = useData(kind, create ? 'new' : id);
  const references = useData(!create && kind === 'posts' ? 'posts' : 'channels', 'new');
  const channels = create ? result.channels : references.channels;
  const templates = create ? result.templates : references.templates;
  const ready = create ? kind !== 'posts' || channels : result.data && (kind !== 'posts' || channels);
  return <section className="formPage"><Back kind={kind}/>
    <header className="pageHeading"><h1>{create ? sections[kind].action : 'Редактирование'}</h1></header>
    {!ready ? <Feedback result={result.error ? result : references}/> : <Fields key={kind + (id || 'new')} kind={kind} data={result.data} channels={channels} templates={templates}/>}
  </section>;
}

function Fields({ kind, data, channels = [], templates = [] }) {
  const navigate = useNavigate();
  const [body, setBody] = useState(data?.body || '');
  const [html, setHtml] = useState(data?.telegram_html || '');
  const [attachments, setAttachments] = useState(data?.attachments || []);
  const objectURLs = useRef([]);
  useEffect(() => () => objectURLs.current.forEach(url => URL.revokeObjectURL(url)), []);
  function addFiles(files) {
    if (attachments.length + files.length > 10 || [...attachments, ...files].reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024) {
      setError('До 10 файлов общим размером до 50 МБ'); return;
    }
    const added = files.map(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      let kind = 'document';
      if (['jpg','jpeg','png'].includes(ext) && file.type.startsWith('image/')) kind = 'photo';
      if (ext === 'gif' && file.type === 'image/gif') kind = 'animation';
      if (ext === 'mp4' && file.type === 'video/mp4') kind = 'video';
      if (['mp3','m4a'].includes(ext) && file.type.startsWith('audio/')) kind = 'audio';
      const url = URL.createObjectURL(file); objectURLs.current.push(url);
      return { file, name:file.name, mime:file.type, size:file.size, kind, url };
    });
    setAttachments([...attachments, ...added]); setError('');
  }
  const [platform, setPlatform] = useState(data?.platform || 'telegram');
  const [channelId, setChannelId] = useState(String(data?.channel_id || channels[0]?.id || ''));
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const currentChannel = channels.find(channel => String(channel.id) === channelId);
  const at = new Date(data?.scheduled_at || Date.now() + 10 * 60 * 1000);
  const localTime = new Date(at.getTime() - at.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  async function save(event) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    setPending(true);
    try {
      let payload = input;
      if (kind === 'posts') payload = {
        channel_id: Number(channelId), body,
        telegram_html: currentChannel?.platform === 'telegram' ? html || null : null,
        silent: input.silent === 'on', protect_content: input.protect_content === 'on',
        attachment_ids: currentChannel?.platform === 'telegram' ? attachments.filter(file => file.id).map(file => file.id) : [],
        image_url: input.image_url || null, scheduled_at: new Date(input.scheduled_at).toISOString(), status: input.status,
      };
      if (kind === 'channels') payload = {
        name: input.name, platform, destination: input.destination,
        ...(input.token ? { token: input.token } : {}),
      };
      if (kind === 'posts' && currentChannel?.platform === 'telegram' && attachments.some(item => item.file)) {
        const form = new FormData();
        form.set('payload', JSON.stringify(payload));
        attachments.filter(item => item.file).forEach(item => form.append('files', item.file));
        payload = form;
      }
      const row = await request(kind + (data ? '/' + data.id : ''), { method: data ? 'PUT' : 'POST', body: payload });
      navigate('/' + kind + '/' + row.id);
    } catch (error) {
      setError(error.message);
    } finally {
      setPending(false);
    }
  }
  if (kind === 'posts' && !channels.length) return <div className="formPanel">
    <p>Подключи канал, чтобы создать публикацию.</p><Link className="primary" to="/channels/new">Подключить канал</Link>
  </div>;
  return <form className="formPanel" onSubmit={save}>
    {kind !== 'posts' && <label>Название<input name="name" required maxLength={80} defaultValue={data?.name}/></label>}
    {kind === 'channels' ? <>
      <label>Платформа<select value={platform} disabled={Boolean(data)} onChange={event => setPlatform(event.target.value)}>
        <option value="telegram">Telegram</option><option value="instagram">Instagram</option></select></label>
      <label>{platform === 'telegram' ? 'Имя или ID канала' : 'ID профессионального аккаунта'}
        <input name="destination" required readOnly={Boolean(data)} defaultValue={data?.destination} placeholder={platform === 'telegram' ? '@my_channel' : undefined}/></label>
      <label>{data ? 'Новый токен (необязательно)' : 'Токен доступа'}<input type="password" autoComplete="off" name="token" required={!data}/></label>
      <p className="muted">{platform === 'telegram' ? 'Добавь своего бота администратором канала с правом публикации.' : 'Используй токен Instagram Login с правом публикации.'}</p>
    </> : <>
      {kind === 'posts' && <>
        <label>Канал<select value={channelId} onChange={event => setChannelId(event.target.value)}>
          {channels.map(item => <option key={item.id} value={item.id}>{item.name} · {platforms[item.platform]}</option>)}</select></label>
        {templates.length > 0 && <label>Подставить текст шаблона<select defaultValue="" onChange={event => {
          const selected = templates.find(item => String(item.id) === event.target.value);
          if (selected) { setBody(selected.body); setHtml(''); }
        }}><option value="">Выбрать шаблон</option>{templates.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
      </>}
      {kind === 'posts' && currentChannel?.platform === 'telegram' ? <div className="composerText"><label>Текст публикации</label>
        <RichText body={body} html={html} limit={attachments.length ? 1024 : 4096} onChange={value => { setBody(value.body); setHtml(value.html); }}/>
      </div> : <label>{kind === 'posts' ? 'Текст публикации' : 'Текст шаблона'}<textarea name="body" required rows={7} maxLength={currentChannel?.platform === 'instagram' ? 2200 : 4096} value={body} onChange={event => setBody(event.target.value)}/></label>}
      {kind === 'posts' && currentChannel?.platform === 'telegram' && <div className="mediaSection">
        <FilePicker onSelect={addFiles} disabled={pending}/>
        <p className="muted">До 10 файлов, всего до 50 МБ. Фото — до 10 МБ. Подпись — до 1024 символов.</p>
        <AttachmentList files={attachments} onRemove={index => setAttachments(attachments.filter((_,i) => i !== index))}/>
        {attachments.length > 1 && <p className="muted">Альбом — фото и видео вместе, только музыка или только документы. GIF отправляется отдельно.</p>}
        <label className="checkField"><input type="checkbox" name="silent" defaultChecked={data?.silent}/>Отправить без звука</label>
        <label className="checkField"><input type="checkbox" name="protect_content" defaultChecked={data?.protect_content}/>Запретить сохранение и пересылку</label>
      </div>}
      {kind === 'posts' && <>
        {currentChannel?.platform === 'instagram' && <label>HTTPS-ссылка на фото<input name="image_url" type="url" defaultValue={data?.image_url || ''} required/></label>}
        <div className="fieldRow">
          <label>Дата и время<input name="scheduled_at" type="datetime-local" defaultValue={localTime} required/></label>
          <label>Режим<select name="status" defaultValue={data?.status === 'scheduled' ? 'scheduled' : 'draft'}><option value="draft">Черновик</option><option value="scheduled">Запланировать</option></select></label>
        </div>
      </>}
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions"><button className="primary" disabled={pending}>{pending ? 'Сохраняется…' : 'Сохранить'}</button>
      <Link className="quiet" to={'/' + kind}>Отмена</Link></div>
  </form>;
}

function App() {
  const [session, setSession] = useState(() => JSON.parse(sessionStorage.getItem(sessionKey) || 'null'));
  function logout() {
    sessionStorage.removeItem(sessionKey);
    setSession(null);
  }
  useEffect(() => {
    window.addEventListener('session-expired', logout);
    return () => window.removeEventListener('session-expired', logout);
  }, []);
  return <BrowserRouter>{session ? <Layout session={session} logout={logout}/>
    : <Routes><Route path="/register" element={<Auth key="register" onLogin={setSession} register/>}/>
      <Route path="/login" element={<Auth key="login" onLogin={setSession}/>}/>
      <Route path="*" element={<Navigate to="/login" replace/>}/></Routes>}</BrowserRouter>;
}
createRoot(document.getElementById('root')).render(<App/>);
