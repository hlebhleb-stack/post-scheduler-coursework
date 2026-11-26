import React from 'react';
import { Paperclip } from 'lucide-react';

export function FilePicker({ onSelect, disabled }) {
  return (
    <label className={'filePicker' + (disabled ? ' disabled' : '')}>
      <Paperclip size={18} />
      <span>Прикрепить файлы</span>
      <input
        type="file"
        multiple
        disabled={disabled}
        onChange={(event) => {
          onSelect(Array.from(event.target.files));
          event.target.value = '';
        }}
      />
    </label>
  );
}
