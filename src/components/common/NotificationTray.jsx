import React, { useState, useEffect, useMemo } from 'react';
import { subscribeToToasts } from './toast.js';
import { useSession } from '../../hooks/useSession.js';
import { getSystemHints } from '../../app/store/hints.js';

export function NotificationTray() {
  const session = useSession();
  const [toasts, setToasts] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [lastCount, setLastCount] = useState(0);

  useEffect(() => {
    return subscribeToToasts((toast) => {
      const newToast = { ...toast, id: toast.id || `toast-${Date.now()}`, isToast: true };
      setToasts((prev) => [newToast, ...prev]); 
      setIsOpen(true);
      
      if (toast.duration !== Infinity) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, toast.duration || 5000);
      }
    });
  }, []);

  const hints = useMemo(() => getSystemHints(session), [session]);
  
  // Combine toasts and hints. Toasts on top? Or mixed?
  // Let's put toasts on top as they are "new/urgent".
  const allNotifications = [...toasts, ...hints];

  useEffect(() => {
    // If count increases (new hint or toast), auto-open
    // Note: Toasts already auto-open in their effect.
    // This catches new hints.
    if (allNotifications.length > lastCount) {
        // Only open if we actually have something new. 
        // Logic might be tricky if one removed and one added same tick.
        // But hints are stable ids.
        setIsOpen(true);
    }
    setLastCount(allNotifications.length);
  }, [allNotifications.length]); // ESLint might want lastCount, but logic relies on prev.

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toggle = () => setIsOpen(!isOpen);

  if (allNotifications.length === 0) return null;

  return (
    <div className="notification-tray">
      <div className={`notification-stack ${isOpen ? 'is-open' : ''}`}>
        {allNotifications.map((item) => (
          <div key={item.id} className={`notification-item tone-${item.tone || 'info'}`} role="status">
            <div className="notification-content">
              {item.title && <strong>{item.title}</strong>}
              <p>{item.message}</p>
            </div>
            {item.isToast && (
              <button 
                onClick={() => dismissToast(item.id)} 
                className="notification-close" 
                aria-label="Schließen"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <button 
        className={`notification-toggle ${isOpen ? 'is-active' : ''} ${!isOpen ? 'animate-pulse' : ''}`} 
        onClick={toggle}
        aria-label={isOpen ? "Benachrichtigungen verbergen" : "Benachrichtigungen anzeigen"}
        aria-expanded={isOpen}
      >
        {isOpen ? '×' : 'i'}
        {!isOpen && (
          <span className="notification-badge">{allNotifications.length}</span>
        )}
      </button>
    </div>
  );
}
