import React, { useEffect, useState } from 'react';
import { X, File, Music, Film, Image, Download } from 'lucide-react';
import { request } from '../../services/api.js';
import { fileSize } from '../../lib/format.js';

function SavedPreview({ file }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let objectURL;
    request('attachments/' + file.id, {
      signal: controller.signal,
      response: 'blob',
    })
      .then((blob) => {
        objectURL = URL.createObjectURL(new Blob([blob], { type: file.mime }));
        setUrl(objectURL);
      })
      .catch(() => {});
    return () => {
      controller.abort();
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [file.id, file.mime]);
  return url ? <Preview file={file} url={url} /> : null;
}
function Preview({ file, url }) {
  if (file.kind === 'photo' || file.kind === 'animation')
    return <img className="mediaPreview" src={url} alt={file.name} />;
  if (file.kind === 'video')
    return <video className="mediaPreview" src={url} controls preload="metadata" />;
  if (file.kind === 'audio') return <audio src={url} controls preload="metadata" />;
  return null;
}
export function AttachmentList({ files, onRemove }) {
  const [error, setError] = useState('');
  async function download(file) {
    setError('');
    try {
      const blob = await request('attachments/' + file.id, { response: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Не удалось скачать файл. Попробуйте ещё раз.');
    }
  }
  return (
    <div className="attachmentList">
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {files.map((file, index) => {
        const Icon =
          { photo: Image, animation: Image, video: Film, audio: Music }[file.kind] || File;
        return (
          <div className="attachment" key={file.id || file.url || index}>
            <div className="attachmentInfo">
              <Icon size={19} />
              <span>
                <strong>{file.name}</strong>
                <small>
                  {fileSize(file.size)} ·{' '}
                  {file.kind === 'document'
                    ? 'Файл'
                    : { photo: 'Фото', video: 'Видео', audio: 'Музыка', animation: 'GIF' }[
                        file.kind
                      ]}
                </small>
              </span>
              {file.id && (
                <button
                  type="button"
                  className="quiet"
                  aria-label={'Скачать ' + file.name}
                  onClick={() => download(file)}
                >
                  <Download size={17} />
                </button>
              )}
              {onRemove && (
                <button
                  type="button"
                  className="quiet"
                  aria-label={'Удалить вложение ' + file.name}
                  onClick={() => onRemove(index)}
                >
                  <X size={17} />
                </button>
              )}
            </div>
            {file.url ? (
              <Preview file={file} url={file.url} />
            ) : file.id && file.kind !== 'document' ? (
              <SavedPreview file={file} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
