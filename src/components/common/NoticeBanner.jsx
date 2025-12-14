import React from 'react';

export function NoticeBanner({ tone = 'info', title, message, assertive = false }) {
  return (
    <div
      className={`notice notice--${tone}`}
      role="status"
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="notice-body">
        {title && <strong>{title}</strong>}
        {message && <p>{message}</p>}
      </div>
    </div>
  );
}
