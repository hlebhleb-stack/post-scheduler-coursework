import React from 'react';
import { DurationPicker } from '../ui/DurationPicker.jsx';

export function PublicationDateTime({ value, onChange, disabled, ...inputProps }) {
  const [date, time = '00:00'] = value.split('T');
  const [hours, minutes] = time.split(':').map(Number);
  return (
    <div className="publicationDateTime">
      <input
        {...inputProps}
        type="date"
        required
        disabled={disabled}
        value={date}
        onChange={(event) => onChange(`${event.target.value}T${time}`)}
      />
      <DurationPicker
        value={{ hours, minutes }}
        disabled={disabled}
        aria-label="Время публикации"
        onChange={({ hours, minutes }) =>
          onChange(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
        }
      />
    </div>
  );
}
