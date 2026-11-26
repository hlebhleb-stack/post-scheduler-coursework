import React, { useState, useEffect } from 'react';
import { Upload, FolderOpen } from 'lucide-react';
import { request } from '../services/api.js';
import { FormField } from '../components/FormField.jsx';
import { AttachmentList } from '../components/editor/AttachmentList.jsx';
export default function MediaLibrary() {
  const [files, setFiles] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    request('media', { signal: controller.signal })
      .then(setFiles)
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [loadAttempt]);
  async function upload(selected) {
    if (!selected.length) return;
    const oversized = selected.find((file) => file.size > 50 * 1024 * 1024);
    if (oversized) {
      setError('Файл «' + oversized.name + '» превышает 50 МБ');
      return;
    }
    const largePhoto = selected.find(
      (file) =>
        /\.(jpe?g|png)$/i.test(file.name) &&
        file.type.startsWith('image/') &&
        file.size > 10 * 1024 * 1024,
    );
    if (largePhoto) {
      setError('Фото «' + largePhoto.name + '» превышает 10 МБ');
      return;
    }
    if (
      selected.length > 10 ||
      selected.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024
    ) {
      setError('Выберите до 10 файлов общим размером до 50 МБ');
      return;
    }
    setPending(true);
    setError('');
    try {
      const form = new FormData();
      form.set('payload', '{}');
      selected.forEach((file) => form.append('files', file));
      const added = await request('media', { method: 'POST', body: form });
      setFiles((current) => [...added.reverse(), ...(current || [])]);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }
  async function rename(event, file) {
    event.preventDefault();
    setNameError('');
    if (!name.trim()) {
      setNameError('Введите имя файла');
      return;
    }
    setPending(true);
    setError('');
    try {
      const updated = await request('media/' + file.id, { method: 'PUT', body: { name } });
      setFiles((current) => current.map((item) => (item.id === file.id ? updated : item)));
      setEditing(null);
    } catch (err) {
      if (err.fields?.name) setNameError(err.fields.name);
      else setError(err.message);
    } finally {
      setPending(false);
    }
  }
  async function remove(file) {
    if (!window.confirm('Удалить файл «' + file.name + '» из медиатеки?')) return;
    setPending(true);
    setError('');
    try {
      await request('media/' + file.id, { method: 'DELETE' });
      setFiles((current) => current.filter((item) => item.id !== file.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-label="Медиатека">
      <h1 className="visuallyHidden">Медиатека</h1>
      <header className="pageHeading compactHeading">
        <p className="pageCount">Файлов — {files?.length || 0} · до 50 МБ за загрузку</p>
        <div className="uploadControl">
          <label className="primary libraryUpload">
            <Upload size={17} />
            {pending ? 'Загрузка…' : 'Загрузить файлы'}
            <input
              type="file"
              multiple
              disabled={pending || files === null}
              onChange={(event) => {
                upload(Array.from(event.target.files));
                event.target.value = '';
              }}
            />
          </label>
          {error && (
            <p className="inlineError uploadError" role="alert">
              {error}
            </p>
          )}
        </div>
      </header>
      {!files ? (
        <div>
          <p role="status">{error ? 'Не удалось загрузить медиатеку' : 'Загрузка…'}</p>
          {error && (
            <button
              type="button"
              className="secondary"
              onClick={() => setLoadAttempt((value) => value + 1)}
            >
              Повторить
            </button>
          )}
        </div>
      ) : !files.length ? (
        <div className="empty">
          <FolderOpen size={32} strokeWidth={1.4} />
          <strong>В медиатеке пока нет файлов</strong>
        </div>
      ) : (
        <div className="libraryGrid">
          {files.map((file) => (
            <article className="libraryItem" key={file.id}>
              <AttachmentList files={[file]} />
              {editing === file.id ? (
                <form className="renameForm" noValidate onSubmit={(event) => rename(event, file)}>
                  <FormField name={'name-' + file.id} label="Имя файла" message={nameError}>
                    <input
                      autoFocus
                      value={name}
                      maxLength={255}
                      required
                      onChange={(event) => {
                        setName(event.target.value);
                        setNameError('');
                      }}
                    />
                  </FormField>
                  <div className="actions">
                    <button className="primary" disabled={pending}>
                      Сохранить
                    </button>
                    <button type="button" className="quiet" onClick={() => setEditing(null)}>
                      Отмена
                    </button>
                  </div>
                </form>
              ) : (
                <div className="libraryActions">
                  <button
                    className="quiet"
                    disabled={pending}
                    onClick={() => {
                      setEditing(file.id);
                      setName(file.name);
                      setNameError('');
                    }}
                  >
                    Переименовать
                  </button>
                  <button className="danger" disabled={pending} onClick={() => remove(file)}>
                    Удалить
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
