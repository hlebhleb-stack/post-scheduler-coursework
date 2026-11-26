import React,{useState,useEffect,useRef} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {sections,platforms} from '../config.js';
import {request} from '../services/api.js';
import {useData} from '../hooks/useData.js';
import {Feedback,Back} from '../components/Common.jsx';
import {FormField,FieldError,validateForm,focusFirstError} from '../components/FormField.jsx';
import {MediaSelector} from '../components/MediaSelector.jsx';
import {RichText,AttachmentList,FilePicker} from '../Composer.jsx';
export default function Editor({ kind, create = false }) {
  const { id } = useParams();
  const result = useData(kind, create ? 'new' : id);
  const references = useData(!create && kind === 'posts' ? 'posts' : 'channels', 'new');
  const channels = create ? result.channels : references.channels;
  const ready = create ? kind !== 'posts' || channels : result.data && (kind !== 'posts' || channels);
  return <section className="formPage"><Back kind={kind}/>
    <header className="pageHeading"><h1>{create ? sections[kind].action : 'Редактирование'}</h1></header>
    {!ready ? <Feedback result={result.error ? result : references}/> : <Fields key={kind + (id || 'new')} kind={kind} data={result.data} channels={channels}/>}
  </section>;
}

function Fields({ kind, data, channels = [] }) {
  const navigate = useNavigate();
  const [body, setBody] = useState(data?.body || '');
  const [html, setHtml] = useState(data?.telegram_html || '');
  const [attachments, setAttachments] = useState(data?.attachments || []);
  const objectURLs = useRef([]);
  useEffect(() => () => objectURLs.current.forEach(url => URL.revokeObjectURL(url)), []);
  function addFiles(files) {
    if (currentChannel?.platform === 'youtube' && (attachments.length + files.length !== 1 || files.some(file=>file.type !== 'video/mp4' || !/\.mp4$/i.test(file.name)))) { setError('Для YouTube выберите одно MP4-видео до 50 МБ'); return; }
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
  const oauthError = new URLSearchParams(window.location.search).get('youtube_error');
  const [platform, setPlatform] = useState(data?.platform || (oauthError ? 'youtube' : 'telegram'));
  const oauthMessages = {state:'Подключение истекло. Нажмите «Подключить через Google» ещё раз в этом браузере.',cancelled:'Подключение отменено. Повторите его, когда будете готовы.',access:'Не удалось получить доступ. Проверьте тестового пользователя в Google Cloud, выберите аккаунт с каналом и разрешите оба права YouTube.',channel:'Выбран другой YouTube-канал. При обновлении доступа выберите ранее подключённый канал.',server:'Не удалось сохранить подключение. Попробуйте ещё раз.'};
  const [channelId, setChannelId] = useState(String(data?.channel_id || channels[0]?.id || ''));
  const [error, setError] = useState(oauthMessages[oauthError] || '');
  const [fieldErrors,setFieldErrors]=useState({});
  const [pending, setPending] = useState(false);
  const currentChannel = channels.find(channel => String(channel.id) === channelId);
  const at = new Date(data?.scheduled_at || Date.now() + 10 * 60 * 1000);
  const localTime = new Date(at.getTime() - at.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  async function connectYouTube(form) {
    const name = form.elements.namedItem('name').value.trim();
    if (!name) { setFieldErrors({name:'Введите название канала'}); focusFirstError(form,{name:true}); return; }
    setPending(true);setError('');
    try {
      const {url} = await request('youtube/connect',{method:'POST',body:{name,...(data ? {channel_id:data.id} : {})}});
      window.location.assign(url);
    } catch (error) { setError(error.message);setPending(false); }
  }
  async function save(event) {
    event.preventDefault();
    const form=event.currentTarget;
    if (kind === 'channels' && platform === 'youtube' && !data) { await connectYouTube(form); return; }
    const invalid=validateForm(form);setFieldErrors(invalid);
    if(Object.keys(invalid).length){focusFirstError(form,invalid);return;}
    const input = Object.fromEntries(new FormData(form));
    setError('');
    setPending(true);
    try {
      let payload = input;
      if (kind === 'posts') payload = {
        channel_id: Number(channelId), body,
        telegram_html: currentChannel?.platform === 'telegram' ? html || null : null,
        media_ids: ['telegram','youtube'].includes(currentChannel?.platform) ? attachments.filter(file=>file.media_id).map(file=>file.media_id) : [],
        silent: input.silent === 'on', protect_content: input.protect_content === 'on',
        attachment_ids: ['telegram','youtube'].includes(currentChannel?.platform) ? attachments.filter(file => file.id && !file.media_id).map(file => file.id) : [],
        youtube_title: input.youtube_title || '', youtube_privacy:input.youtube_privacy || 'unlisted', youtube_made_for_kids:input.youtube_made_for_kids === 'true',
        image_url: input.image_url || null, scheduled_at: new Date(input.scheduled_at).toISOString(), status: input.status,
      };
      if (kind === 'channels') payload = {
        name: input.name, platform, destination: input.destination,
        ...(input.token ? { token: input.token } : {}),
      };
      if (kind === 'posts' && ['telegram','youtube'].includes(currentChannel?.platform) && attachments.some(item => item.file)) {
        const form = new FormData();
        form.set('payload', JSON.stringify(payload));
        attachments.filter(item => item.file).forEach(item => form.append('files', item.file));
        payload = form;
      }
      const row = await request(kind + (data ? '/' + data.id : ''), { method: data ? 'PUT' : 'POST', body: payload });
      navigate('/' + kind + '/' + row.id);
    } catch (error) {
      setFieldErrors(error.fields || {});
      setError(Object.keys(error.fields || {}).length?'':error.message);
      focusFirstError(form,error.fields || {});
    } finally {
      setPending(false);
    }
  }
  if (kind === 'posts' && !channels.length) return <div className="formPanel">
    <p>Подключи канал, чтобы создать публикацию.</p><Link className="primary" to="/channels/new">Подключить канал</Link>
  </div>;
  return <form className="formPanel" noValidate onSubmit={save} onChange={event=>{const name=event.target.name;if(name)setFieldErrors(current=>({...current,[name]:undefined}));}}>
    {kind !== 'posts' && <FormField name="name" label="Название" message={fieldErrors.name}><input required maxLength={80} defaultValue={data?.name}/></FormField>}
    {kind === 'channels' ? <>
      <FormField name="platform" label="Платформа" message={fieldErrors.platform}><select value={platform} disabled={Boolean(data)} onChange={event => setPlatform(event.target.value)}>
        <option value="telegram">Telegram</option><option value="instagram">Instagram</option><option value="youtube">YouTube</option></select></FormField>
      {platform === 'youtube' ? <>
        {data && <p className="muted">ID канала: {data.destination}</p>}
        <p className="muted">Выберите Google-аккаунт с нужным YouTube-каналом и разрешите просмотр канала и загрузку видео.</p>
        {data && <button className="secondary" type="button" disabled={pending} onClick={event=>connectYouTube(event.currentTarget.form)}>Обновить доступ через Google</button>}
        {data && <input type="hidden" name="destination" value={data.destination}/>}
      </> : <>
      <FormField name="destination" label={platform === 'telegram' ? 'Имя или ID канала' : 'ID профессионального аккаунта'} message={fieldErrors.destination}>
        <input required readOnly={Boolean(data)} defaultValue={data?.destination} placeholder={platform === 'telegram' ? '@my_channel' : 'Например, 17841400000000000'}/></FormField>
      <FormField name="token" label={data ? 'Новый токен (необязательно)' : 'Токен доступа'} message={fieldErrors.token}><input type="password" autoComplete="off" required={!data}/></FormField>
      <p className="muted">{platform === 'telegram' ? 'Добавь своего бота администратором канала с правом публикации.' : 'Используй токен Instagram Login с правом публикации.'}</p>
      </>}
    </> : <>
      {kind === 'posts' && <>
        <FormField name="channel_id" label="Канал" message={fieldErrors.channel_id}><select value={channelId} onChange={event => setChannelId(event.target.value)}>
          {channels.map(item => <option key={item.id} value={item.id}>{item.name} · {platforms[item.platform]}</option>)}</select></FormField>
      </>}
      {currentChannel?.platform === 'youtube' && <>
        <FormField name="youtube_title" label="Название видео" message={fieldErrors.youtube_title}><input required maxLength={100} defaultValue={data?.youtube_title || ''}/></FormField>
        <FormField name="youtube_privacy" label="Доступ к видео" message={fieldErrors.youtube_privacy}><select defaultValue={data?.youtube_privacy || 'unlisted'}><option value="unlisted">По ссылке</option><option value="private">Только мне</option><option value="public">Для всех</option></select></FormField>
        <FormField name="youtube_made_for_kids" label="Видео предназначено для детей?" message={fieldErrors.youtube_made_for_kids}><select required defaultValue={data ? String(Boolean(data.youtube_made_for_kids)) : ''}><option value="" disabled>Выберите аудиторию</option><option value="false">Нет, не для детей</option><option value="true">Да, для детей</option></select></FormField>
      </>}
      {kind === 'posts' && currentChannel?.platform === 'telegram' ? <div className="composerText"><label>Текст публикации</label>
        <RichText body={body} html={html} invalid={Boolean(fieldErrors.body)} limit={attachments.length ? 1024 : 4096} onChange={value => { setBody(value.body); setHtml(value.html);setFieldErrors(current=>({...current,body:undefined})); }}/>
        <FieldError name="body" message={fieldErrors.body}/>
      </div> : <FormField name="body" label={currentChannel?.platform === 'youtube' ? 'Описание видео' : 'Текст публикации'} message={fieldErrors.body}><textarea required={currentChannel?.platform !== 'youtube'} rows={7} maxLength={currentChannel?.platform === 'youtube' ? 5000 : currentChannel?.platform === 'instagram' ? 2200 : 4096} value={body} onChange={event => setBody(event.target.value)}/></FormField>}
      {kind === 'posts' && ['telegram','youtube'].includes(currentChannel?.platform) && <div className="mediaSection">
        <div className="attachmentActions"><FilePicker onSelect={addFiles} disabled={pending}/>
          <MediaSelector selectedIds={attachments.filter(file=>file.media_id).map(file=>file.media_id)} onSelect={file=>{
            if (currentChannel?.platform === 'youtube' && (attachments.length || file.kind !== 'video' || file.mime !== 'video/mp4')) { setError('Для YouTube выберите одно MP4-видео до 50 МБ'); return; }
            if (attachments.length>=10 || attachments.reduce((sum,item)=>sum+item.size,0)+file.size>50*1024*1024) { setError('До 10 файлов общим размером до 50 МБ'); return; }
            setAttachments([...attachments,{...file,media_id:file.id}]);setError('');
          }}/></div>
        <p className="muted">{currentChannel?.platform === 'youtube' ? 'Одно MP4-видео до 50 МБ. После загрузки YouTube потребуется время на обработку.' : 'До 10 файлов, всего до 50 МБ. Фото — до 10 МБ. Подпись — до 1024 символов.'}</p>
        <AttachmentList files={attachments} onRemove={index => setAttachments(attachments.filter((_,i) => i !== index))}/>
        {currentChannel?.platform === 'telegram' && attachments.length > 1 && <p className="muted">Альбом — фото и видео вместе, только музыка или только документы. GIF отправляется отдельно.</p>}
        {currentChannel?.platform === 'telegram' && <>
        <label className="checkField"><input type="checkbox" name="silent" defaultChecked={data?.silent}/>Отправить без звука</label>
        <label className="checkField"><input type="checkbox" name="protect_content" defaultChecked={data?.protect_content}/>Запретить сохранение и пересылку</label>
        </>}
      </div>}
      {kind === 'posts' && <>
        {currentChannel?.platform === 'instagram' && <FormField name="image_url" label="HTTPS-ссылка на фото" message={fieldErrors.image_url}><input type="url" defaultValue={data?.image_url || ''} required/></FormField>}
        <div className="fieldRow">
          <FormField name="scheduled_at" label="Дата и время" message={fieldErrors.scheduled_at}><input type="datetime-local" defaultValue={localTime} required/></FormField>
          <FormField name="status" label="Режим" message={fieldErrors.status}><select defaultValue={data?.status === 'scheduled' ? 'scheduled' : 'draft'}><option value="draft">Черновик</option><option value="scheduled">Запланировать</option></select></FormField>
        </div>
      </>}
    </>}
    {error && <p className="inlineError" role="alert">{error}</p>}
    <div className="actions"><button className="primary" disabled={pending}>{pending ? 'Подождите…' : kind === 'channels' && platform === 'youtube' && !data ? 'Подключить через Google' : 'Сохранить'}</button>
      <Link className="quiet" to={'/' + kind}>Отмена</Link></div>
  </form>;
}

