import { useEffect, useRef, useState } from "react";

export interface SessionTimerState {
  elapsedSeconds: number;
  elapsedLabel: string;
  remainingSeconds: number | null;
  remainingLabel: string | null;
  isExpiringSoon: boolean;
  isExpired: boolean;
  inicioFormatado: string;
}

function formatarSegundos(totalSegundos: number): string {
  const clamped = Math.max(0, Math.floor(totalSegundos));
  const horas = Math.floor(clamped / 3600);
  const minutos = Math.floor((clamped % 3600) / 60);
  const segundos = clamped % 60;

  if (horas > 0) {
    return `${horas}h ${String(minutos).padStart(2, "0")}m ${String(segundos).padStart(2, "0")}s`;
  }
  if (minutos > 0) {
    return `${minutos}m ${String(segundos).padStart(2, "0")}s`;
  }
  return `${segundos}s`;
}

function formatarDataHoraCurta(timestampMs: number): string {
  const data = new Date(timestampMs);
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = String(data.getFullYear()).slice(-2);
  const hora = String(data.getHours()).padStart(2, "0");
  const min = String(data.getMinutes()).padStart(2, "0");
  const seg = String(data.getSeconds()).padStart(2, "0");
  return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
}

export function useSessionTimer(
  sessionStartMs: number,
  expiraEmIso: string | null,
  onExpired?: () => void,
): SessionTimerState {
  const [agora, setAgora] = useState<number>(() => Date.now());
  const expiredFiredRef = useRef(false);

  useEffect(() => {
    expiredFiredRef.current = false;
  }, [expiraEmIso, sessionStartMs]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setAgora(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsedSeconds = Math.max(0, Math.floor((agora - sessionStartMs) / 1000));

  let remainingSeconds: number | null = null;
  if (expiraEmIso) {
    const expiraMs = Date.parse(expiraEmIso);
    if (Number.isFinite(expiraMs)) {
      remainingSeconds = Math.max(0, Math.floor((expiraMs - agora) / 1000));
    }
  }

  const isExpired = remainingSeconds !== null && remainingSeconds <= 0;
  const isExpiringSoon =
    remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= 600;

  useEffect(() => {
    if (isExpired && !expiredFiredRef.current && onExpired) {
      expiredFiredRef.current = true;
      onExpired();
    }
  }, [isExpired, onExpired]);

  return {
    elapsedSeconds,
    elapsedLabel: formatarSegundos(elapsedSeconds),
    remainingSeconds,
    remainingLabel: remainingSeconds !== null ? formatarSegundos(remainingSeconds) : null,
    isExpiringSoon,
    isExpired,
    inicioFormatado: formatarDataHoraCurta(sessionStartMs),
  };
}
