import React from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

export default function ToastStack({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Icon size={16} className="toast-icon" />
            <span className="toast-msg">{t.message}</span>
            <button onClick={() => removeToast(t.id)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
