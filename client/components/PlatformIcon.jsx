import React from 'react';
import { platforms } from '../config.js';
export function PlatformIcon({ platform }) {
  const label = platforms[platform] || 'Платформа';
  return (
    <span className={'platformIcon ' + platform} role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {platform === 'telegram' ? (
          <path
            fill="currentColor"
            d="m20.7 4.1-3.1 15c-.2 1.1-.9 1.4-1.8.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.8 8.8-8c.4-.3-.1-.5-.5-.2L5.7 13 1 11.5c-1-.3-1-1 .2-1.5L19.5 3c.9-.3 1.6.2 1.2 1.1Z"
          />
        ) : (
          <>
            <path
              fill="currentColor"
              d="M22 7.2a3.1 3.1 0 0 0-2.2-2.2C17.9 4.5 12 4.5 12 4.5s-5.9 0-7.8.5A3.1 3.1 0 0 0 2 7.2 32 32 0 0 0 1.5 12a32 32 0 0 0 .5 4.8A3.1 3.1 0 0 0 4.2 19c1.9.5 7.8.5 7.8.5s5.9 0 7.8-.5a3.1 3.1 0 0 0 2.2-2.2 32 32 0 0 0 .5-4.8 32 32 0 0 0-.5-4.8Z"
            />
            <path fill="var(--platform-surface)" d="m10 15.5 6-3.5-6-3.5z" />
          </>
        )}
      </svg>
    </span>
  );
}
