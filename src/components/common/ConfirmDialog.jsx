import React, { useState, useEffect, useRef } from 'react';
import { registerConfirmHandler } from './confirmDialog.js';

export function ConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({
    title: '',
    message: '',
    confirmLabel: 'OK',
    cancelLabel: 'Abbrechen',
    destructive: false,
    onConfirm: null,
  });
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    registerConfirmHandler((options) => {
      previouslyFocused.current = document.activeElement;
      setState({
        title: options.title || 'Bestätigen',
        message: options.message || '',
        confirmLabel: options.confirmLabel || 'OK',
        cancelLabel: options.cancelLabel || 'Abbrechen',
        destructive: Boolean(options.destructive),
        onConfirm: typeof options.onConfirm === 'function' ? options.onConfirm : null,
      });
      setOpen(true);
    });
  }, []);

  const close = () => {
    setOpen(false);
    if (previouslyFocused.current && typeof previouslyFocused.current.focus === 'function') {
      previouslyFocused.current.focus({ preventScroll: true });
    }
  };

  const handleConfirm = () => {
    close();
    state.onConfirm?.();
  };

  // Focus trap could be added here similar to Alpine, for now basic focus management
  useEffect(() => {
    if (open && dialogRef.current) {
      const btn = dialogRef.current.querySelector('.primary');
      btn?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="confirm-backdrop" onClick={close}>
      <div
        className={`confirm-dialog ${state.destructive ? 'is-destructive' : ''}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{state.title}</h3>
        <p>{state.message}</p>
        <div className="confirm-actions">
          <button type="button" className="ghost" onClick={close}>
            {state.cancelLabel}
          </button>
          <button
            type="button"
            className={`primary ${state.destructive ? 'danger' : ''}`}
            onClick={handleConfirm}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
