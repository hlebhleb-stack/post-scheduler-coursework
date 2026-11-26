import { toast } from '../ui/Toast.jsx';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { request } from '../../services/api.js';
import { FormField, validateForm, focusFirstError } from '../FormField.jsx';

const oauthMessages = {
  state: 'Подключение истекло. Нажмите «Подключить через Google» ещё раз в этом браузере.',
  cancelled: 'Подключение отменено. Повторите его, когда будете готовы.',
  access:
    'Не удалось получить доступ. Проверьте тестового пользователя в Google Cloud, выберите аккаунт с каналом и разрешите оба права YouTube.',
  channel: 'Выбран другой YouTube-канал. При обновлении доступа выберите ранее подключённый канал.',
  server: 'Не удалось сохранить подключение. Попробуйте ещё раз.',
};

export function ChannelForm({ data }) {
  const navigate = useNavigate();
  const oauthError = new URLSearchParams(window.location.search).get('youtube_error');
  const [platform, setPlatform] = useState(data?.platform || (oauthError ? 'youtube' : 'telegram'));
  const [error, setError] = useState(oauthMessages[oauthError] || '');
  const [fieldErrors, setFieldErrors] = useState({});
  const [pending, setPending] = useState(false);
  async function connectYouTube(form) {
    const name = form.elements.namedItem('name').value.trim();
    if (!name) {
      setFieldErrors({ name: 'Введите название канала' });
      focusFirstError(form, { name: true });
      return;
    }
    setPending(true);
    setError('');
    try {
      const { url } = await request('youtube/connect', {
        method: 'POST',
        body: { name, ...(data ? { channel_id: data.id } : {}) },
      });
      window.location.assign(url);
    } catch (error) {
      setError(error.message);
      setPending(false);
    }
  }
  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (platform === 'youtube' && !data) {
      await connectYouTube(form);
      return;
    }
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
      const payload = {
        name: input.name,
        platform,
        destination: input.destination,
        ...(input.token ? { token: input.token } : {}),
      };
      const row = await request('channels' + (data ? '/' + data.id : ''), {
        method: data ? 'PUT' : 'POST',
        body: payload,
      });
      toast.success(data ? 'Канал сохранён' : 'Канал подключён');
      navigate('/channels/' + row.id);
    } catch (error) {
      setFieldErrors(error.fields || {});
      setError(Object.keys(error.fields || {}).length ? '' : error.message);
      focusFirstError(form, error.fields || {});
    } finally {
      setPending(false);
    }
  }
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
      <FormField name="name" label="Название" message={fieldErrors.name}>
        <input required maxLength={80} defaultValue={data?.name} />
      </FormField>
      <FormField name="platform" label="Платформа" message={fieldErrors.platform}>
        <select
          value={platform}
          disabled={Boolean(data)}
          onChange={(event) => setPlatform(event.target.value)}
        >
          <option value="telegram">Telegram</option>
          <option value="youtube">YouTube</option>
        </select>
      </FormField>
      {platform === 'youtube' ? (
        <>
          {data && <p className="muted">ID канала: {data.destination}</p>}
          <p className="muted">
            Выберите Google-аккаунт с нужным YouTube-каналом и разрешите просмотр канала и загрузку
            видео.
          </p>
          {data && (
            <button
              className="secondary"
              type="button"
              disabled={pending}
              onClick={(event) => connectYouTube(event.currentTarget.form)}
            >
              Обновить доступ через Google
            </button>
          )}
          {data && <input type="hidden" name="destination" value={data.destination} />}
        </>
      ) : (
        <>
          <FormField name="destination" label="Имя или ID канала" message={fieldErrors.destination}>
            <input
              required
              readOnly={Boolean(data)}
              defaultValue={data?.destination}
              placeholder="@my_channel"
            />
          </FormField>
          <FormField
            name="token"
            label={data ? 'Новый токен (необязательно)' : 'Токен доступа'}
            message={fieldErrors.token}
          >
            <input type="password" autoComplete="off" required={!data} />
          </FormField>
          <p className="muted">Добавь своего бота администратором канала с правом публикации.</p>
        </>
      )}
      {error && (
        <p className="inlineError" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="primary" disabled={pending}>
          {pending
            ? 'Подождите…'
            : platform === 'youtube' && !data
              ? 'Подключить через Google'
              : 'Сохранить'}
        </button>
        <Link className="quiet" to="/channels">
          Отмена
        </Link>
      </div>
    </form>
  );
}
