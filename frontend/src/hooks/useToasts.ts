import { useCallback, useRef, useState } from "react";

export type ToastTipo = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  tipo: ToastTipo;
  titulo: string;
  mensagem?: string;
}

export interface AddToastInput {
  tipo: ToastTipo;
  titulo: string;
  mensagem?: string;
  duracaoMs?: number;
}

export function useToasts(): {
  toasts: ToastItem[];
  addToast: (input: AddToastInput) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
} {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addToast = useCallback(
    ({ tipo, titulo, mensagem, duracaoMs = 4500 }: AddToastInput): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const novo: ToastItem =
        mensagem !== undefined ? { id, tipo, titulo, mensagem } : { id, tipo, titulo };
      setToasts((prev) => [...prev.slice(-4), novo]);

      if (duracaoMs > 0) {
        const timer = window.setTimeout(() => {
          timersRef.current.delete(id);
          setToasts((prev) => prev.filter((item) => item.id !== id));
        }, duracaoMs);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [],
  );

  const clearToasts = useCallback(() => {
    for (const timer of timersRef.current.values()) {
      window.clearTimeout(timer);
    }
    timersRef.current.clear();
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    dismissToast,
    clearToasts,
  };
}
