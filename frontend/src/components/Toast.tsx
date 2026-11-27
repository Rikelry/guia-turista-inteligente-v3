import type { ToastItem, ToastTipo } from "../hooks/useToasts.ts";

export interface ToastContainerProps {
  toasts: readonly ToastItem[];
  onDismiss: (id: string) => void;
}

const ICONES_TOAST: Record<ToastTipo, string> = {
  success: "✅",
  error: "❌",
  info: "ℹ️",
  warning: "⚠️",
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="toast-container"
      aria-live="polite"
      aria-atomic="false"
      role="region"
      aria-label="Notificações"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item toast-${toast.tipo}`} role="status">
          <span className="toast-icon" aria-hidden="true">
            {ICONES_TOAST[toast.tipo]}
          </span>
          <div className="toast-body">
            <strong className="toast-title">{toast.titulo}</strong>
            {toast.mensagem && <p className="toast-message">{toast.mensagem}</p>}
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Fechar notificação"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
