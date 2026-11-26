import React, { useState } from 'react';
import { useData } from '../hooks/useData.js';
import { Feedback } from './Common.jsx';
import { fileSize } from '../lib/format.js';
export function MediaSelector({ selectedIds, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mediaSelector">
      <button
        className="secondary"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Из медиатеки
      </button>
      {open && <MediaOptions selectedIds={selectedIds} onSelect={onSelect} />}
    </div>
  );
}
function MediaOptions({ selectedIds, onSelect }) {
  const result = useData('media');
  return (
    <div className="mediaOptions">
      {!result.data ? (
        <Feedback result={result} />
      ) : result.data.length ? (
        result.data.map((file) => (
          <button
            type="button"
            key={file.id}
            disabled={selectedIds.includes(file.id)}
            onClick={() => onSelect(file)}
          >
            <span>{file.name}</span>
            <small>{selectedIds.includes(file.id) ? 'Добавлено' : fileSize(file.size)}</small>
          </button>
        ))
      ) : (
        <p className="muted">Медиатека пока пуста. Загрузите файлы в разделе «Медиатека».</p>
      )}
    </div>
  );
}
