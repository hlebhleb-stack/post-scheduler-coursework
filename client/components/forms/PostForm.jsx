import { toast } from '../ui/Toast.jsx';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { platforms } from '../../config.js';
import { request } from '../../services/api.js';
import { localDateTime } from '../../lib/format.js';
import { FormField, FieldError, validateForm, focusFirstError } from '../FormField.jsx';
import { MediaSelector } from '../MediaSelector.jsx';
import { RichText } from '../editor/RichText.jsx';
import { AttachmentList } from '../editor/AttachmentList.jsx';
import { FilePicker } from '../editor/FilePicker.jsx';
import { PublicationDateTime } from '../editor/PublicationDateTime.jsx';

export function PostForm({ data, channels = [] }) {
  const navigate = useNavigate();
  const [body, setBody] = useState(data?.body || '');
  const [html, setHtml] = useState(data?.telegram_html || '');
  const [attachments, setAttachments] = useState(data?.attachments || []);
  const [channelId, setChannelId] = useState(String(data?.channel_id || channels[0]?.id || ''));
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [pending, setPending] = useState(false);
  const currentChannel = channels.find((channel) => String(channel.id) === channelId);
  const [scheduledAt, setScheduledAt] = useState(() =>
    localDateTime(data?.scheduled_at || Date.now() + 600000),
  );
  const objectURLs = useRef([]);
  useEffect(() => () => objectURLs.current.forEach((url) => URL.revokeObjectURL(url)), []);
  function addFiles(files) {
    if (
      currentChannel?.platform === 'youtube' &&
      (attachments.length + files.length !== 1 ||
        files.some((file) => file.type !== 'video/mp4' || !/\.mp4$/i.test(file.name)))
    ) {
      setError('Для YouTube выберите одно MP4-видео до 50 МБ');
      return;
    }
    if (
      attachments.length + files.length > 10 ||
      [...attachments, ...files].reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024
    ) {
      setError('До 10 файлов общим размером до 50 МБ');
      return;
    }
    const added = files.map((file) => {
      const ext = file.name.split('.').pop().toLowerCase();
      let kind = 'document';
      if (['jpg', 'jpeg', 'png'].includes(ext) && file.type.startsWith('image/')) kind = 'photo';
      if (ext === 'gif' && file.type === 'image/gif') kind = 'animation';
      if (ext === 'mp4' && file.type === 'video/mp4') kind = 'video';
      if (['mp3', 'm4a'].includes(ext) && file.type.startsWith('audio/')) kind = 'audio';
      const url = URL.createObjectURL(file);
      objectURLs.current.push(url);
      return { file, name: file.name, mime: file.type, size: file.size, kind, url };
    });
    setAttachments([...attachments, ...added]);
    setError('');
  }
  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const invalid = validateForm(form);
    setFieldErrors(invalid);
    if (Object.keys(invalid).length) {
      focusFirstError(form, invalid);
      return;
    }
    const input = Object.fromEntries(new FormData(form));
    setError('');
    setPending(true);
    try {
      let payload = {
        channel_id: Number(channelId),
        body,
        telegram_html: currentChannel?.platform === 'telegram' ? html || null : null,
        media_ids: attachments.filter((file) => file.media_id).map((file) => file.media_id),
        attachment_ids: attachments
          .filter((file) => file.id && !file.media_id)
          .map((file) => file.id),
        silent: input.silent === 'on',
        protect_content: input.protect_content === 'on',
        youtube_title: input.youtube_title || '',
        youtube_privacy: input.youtube_privacy || 'unlisted',
        youtube_made_for_kids: input.youtube_made_for_kids === 'true',
        scheduled_at: new Date(scheduledAt).toISOString(),
        status: input.status,
      };
      if (attachments.some((item) => item.file)) {
        const formData = new FormData();
        formData.set('payload', JSON.stringify(payload));
        attachments
          .filter((item) => item.file)
          .forEach((item) => formData.append('files', item.file));
        payload = formData;
      }
      const row = await request('posts' + (data ? '/' + data.id : ''), {
        method: data ? 'PUT' : 'POST',
        body: payload,
      });
      toast.success(data ? 'Публикация сохранена' : 'Публикация создана');
      navigate('/posts/' + row.id);
    } catch (error) {
      setFieldErrors(error.fields || {});
      setError(Object.keys(error.fields || {}).length ? '' : error.message);
      focusFirstError(form, error.fields || {});
    } finally {
      setPending(false);
    }
  }
  if (!channels.length)
    return (
      <div className="formPanel">
        <p>Подключи канал, чтобы создать публикацию.</p>
        <Link className="primary" to="/channels/new">
          Подключить канал
        </Link>
      </div>
    );
  return (
    <form
      className="formPanel"
      noValidate
      onSubmit={save}
      onChange={(event) => {
        const name = event.target.name;
        if (name) setFieldErrors((current) => ({ ...current, [name]: undefined }));
      }}
    >
      <FormField name="channel_id" label="Канал" message={fieldErrors.channel_id}>
        <select value={channelId} onChange={(event) => setChannelId(event.target.value)}>
          {channels.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {platforms[item.platform]}
            </option>
          ))}
        </select>
      </FormField>
      {currentChannel?.platform === 'youtube' && (
        <>
          <FormField
            name="youtube_title"
            label="Название видео"
            message={fieldErrors.youtube_title}
          >
            <input required maxLength={100} defaultValue={data?.youtube_title || ''} />
          </FormField>
          <FormField
            name="youtube_privacy"
            label="Доступ к видео"
            message={fieldErrors.youtube_privacy}
          >
            <select defaultValue={data?.youtube_privacy || 'unlisted'}>
              <option value="unlisted">По ссылке</option>
              <option value="private">Только мне</option>
              <option value="public">Для всех</option>
            </select>
          </FormField>
          <FormField
            name="youtube_made_for_kids"
            label="Видео предназначено для детей?"
            message={fieldErrors.youtube_made_for_kids}
          >
            <select required defaultValue={data ? String(Boolean(data.youtube_made_for_kids)) : ''}>
              <option value="" disabled>
                Выберите аудиторию
              </option>
              <option value="false">Нет, не для детей</option>
              <option value="true">Да, для детей</option>
            </select>
          </FormField>
        </>
      )}
      {currentChannel?.platform === 'telegram' ? (
        <div className="composerText">
          <label>Текст публикации</label>
          <RichText
            body={body}
            html={html}
            invalid={Boolean(fieldErrors.body)}
            limit={attachments.length ? 1024 : 4096}
            onChange={(value) => {
              setBody(value.body);
              setHtml(value.html);
              setFieldErrors((current) => ({ ...current, body: undefined }));
            }}
          />
          <FieldError name="body" message={fieldErrors.body} />
        </div>
      ) : (
        <FormField
          name="body"
          label={currentChannel?.platform === 'youtube' ? 'Описание видео' : 'Текст публикации'}
          message={fieldErrors.body}
        >
          <textarea
            required={currentChannel?.platform !== 'youtube'}
            rows={7}
            maxLength={currentChannel?.platform === 'youtube' ? 5000 : 4096}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </FormField>
      )}
      <div className="mediaSection">
        <div className="attachmentActions">
          <FilePicker onSelect={addFiles} disabled={pending} />
          <MediaSelector
            selectedIds={attachments.filter((file) => file.media_id).map((file) => file.media_id)}
            onSelect={(file) => {
              if (
                currentChannel?.platform === 'youtube' &&
                (attachments.length || file.kind !== 'video' || file.mime !== 'video/mp4')
              ) {
                setError('Для YouTube выберите одно MP4-видео до 50 МБ');
                return;
              }
              if (
                attachments.length >= 10 ||
                attachments.reduce((sum, item) => sum + item.size, 0) + file.size > 50 * 1024 * 1024
              ) {
                setError('До 10 файлов общим размером до 50 МБ');
                return;
              }
              setAttachments([...attachments, { ...file, media_id: file.id }]);
              setError('');
            }}
          />
        </div>
        <p className="muted">
          {currentChannel?.platform === 'youtube'
            ? 'Одно MP4-видео до 50 МБ. После загрузки YouTube потребуется время на обработку.'
            : 'До 10 файлов, всего до 50 МБ. Фото — до 10 МБ. Подпись — до 1024 символов.'}
        </p>
        <AttachmentList
          files={attachments}
          onRemove={(index) => setAttachments(attachments.filter((_, i) => i !== index))}
        />
        {currentChannel?.platform === 'telegram' && attachments.length > 1 && (
          <p className="muted">
            Альбом — фото и видео вместе, только музыка или только документы. GIF отправляется
            отдельно.
          </p>
        )}
        {currentChannel?.platform === 'telegram' && (
          <>
            <label className="checkField">
              <input type="checkbox" name="silent" defaultChecked={data?.silent} />
              Отправить без звука
            </label>
            <label className="checkField">
              <input
                type="checkbox"
                name="protect_content"
                defaultChecked={data?.protect_content}
              />
              Запретить сохранение и пересылку
            </label>
          </>
        )}
      </div>
      <div className="fieldRow">
        <FormField name="scheduled_at" label="Дата и время" message={fieldErrors.scheduled_at}>
          <PublicationDateTime
            value={scheduledAt}
            onChange={(value) => {
              setScheduledAt(value);
              setFieldErrors((current) => ({ ...current, scheduled_at: undefined }));
            }}
            disabled={pending}
          />
        </FormField>
        <FormField name="status" label="Режим" message={fieldErrors.status}>
          <select defaultValue={data?.status === 'scheduled' ? 'scheduled' : 'draft'}>
            <option value="draft">Черновик</option>
            <option value="scheduled">Запланировать</option>
          </select>
        </FormField>
      </div>
      {error && (
        <p className="inlineError" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="primary" disabled={pending}>
          {pending ? 'Подождите…' : 'Сохранить'}
        </button>
        <Link className="quiet" to="/posts">
          Отмена
        </Link>
      </div>
    </form>
  );
}
