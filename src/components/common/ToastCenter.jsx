import React, { useState, useEffect } from 'react';
import { subscribeToToasts } from './toast.js';

const TOAST_DURATION_MS = 5000;

export function ToastCenter() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToToasts((toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.duration || TOAST_DURATION_MS);
    });
  }, []);

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="toast-center">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          <strong>{toast.title}</strong>
          <p>{toast.message}</p>
          <button
            type="button"
            className="toast-close"
            onClick={() => dismissToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
