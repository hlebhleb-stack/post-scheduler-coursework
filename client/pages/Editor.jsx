import React,{useState,useEffect,useRef} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {sections,platforms} from '../config.js';
import {request} from '../services/api.js';
import {useData} from '../hooks/useData.js';
import {Feedback,Back} from '../components/Common.jsx';
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
        media_ids: currentChannel?.platform === 'telegram' ? attachments.filter(file=>file.media_id).map(file=>file.media_id) : [],
        silent: input.silent === 'on', protect_content: input.protect_content === 'on',
        attachment_ids: currentChannel?.platform === 'telegram' ? attachments.filter(file => file.id && !file.media_id).map(file => file.id) : [],
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
      </>}
      {kind === 'posts' && currentChannel?.platform === 'telegram' ? <div className="composerText"><label>Текст публикации</label>
        <RichText body={body} html={html} limit={attachments.length ? 1024 : 4096} onChange={value => { setBody(value.body); setHtml(value.html); }}/>
      </div> : <label>{kind === 'posts' ? 'Текст публикации' : 'Текст публикации'}<textarea name="body" required rows={7} maxLength={currentChannel?.platform === 'instagram' ? 2200 : 4096} value={body} onChange={event => setBody(event.target.value)}/></label>}
      {kind === 'posts' && currentChannel?.platform === 'telegram' && <div className="mediaSection">
        <div className="attachmentActions"><FilePicker onSelect={addFiles} disabled={pending}/>
          <MediaSelector selectedIds={attachments.filter(file=>file.media_id).map(file=>file.media_id)} onSelect={file=>{
            if (attachments.length>=10 || attachments.reduce((sum,item)=>sum+item.size,0)+file.size>50*1024*1024) { setError('До 10 файлов общим размером до 50 МБ'); return; }
            setAttachments([...attachments,{...file,media_id:file.id}]);setError('');
          }}/></div>
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

