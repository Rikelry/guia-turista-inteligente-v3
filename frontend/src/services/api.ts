import { API_BASE_URL, SUPPORT_API_KEY } from "../config.ts";
import type {
  CompartilharResponse,
  CustosInfo,
  CustosRequest,
  DestinoCatalogo,
  GuiaStreamRequest,
  LoginResponse,
  MapaRotaRequest,
  MapaRotaResponse,
  ReadyzResponse,
  RoteiroRequest,
  RoteiroResponse,
  TelemetriaBackend,
} from "../types/schemas.ts";

export class ApiError extends Error {
  readonly status: number;
  readonly requestId: string | null;

  constructor(message: string, status: number, requestId: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
  }
}

export interface ApiResultWithTelemetry<T> {
  data: T;
  processTimeMs: number | null;
  requestId: string | null;
  clientTimeMs: number;
}

function gerarRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function extrairMensagemErro(response: Response): Promise<string> {
  try {
    const corpo = (await response.json()) as {
      detail?: string | Array<{ msg?: string; loc?: string[] }>;
    };
    if (typeof corpo.detail === "string" && corpo.detail.trim()) {
      return corpo.detail;
    }
    if (Array.isArray(corpo.detail) && corpo.detail.length > 0) {
      const primeiro = corpo.detail[0];
      if (primeiro?.msg) {
        return primeiro.msg;
      }
    }
  } catch {
    // Corpo não é JSON.
  }

  if (response.status === 401) return "Sessão expirada ou ausente. Entre novamente.";
  if (response.status === 409) {
    return "Já existe um planejamento em andamento para esta mesma rota. Aguarde a conclusão.";
  }
  if (response.status === 404) return "Recurso não encontrado no servidor.";
  if (response.status >= 500) return "Erro temporário no servidor ao processar a solicitação.";
  return `Erro na requisição (HTTP ${response.status}).`;
}

function montarHeaders(options?: {
  userId?: string | null;
  contentType?: string;
  includeSupportKey?: boolean;
}): Headers {
  const headers = new Headers();
  headers.set("X-Request-ID", gerarRequestId());
  if (options?.contentType) {
    headers.set("Content-Type", options.contentType);
  }
  if (options?.userId) {
    headers.set("X-User-Id", options.userId);
  }
  if (options?.includeSupportKey && SUPPORT_API_KEY) {
    headers.set("X-Support-Key", SUPPORT_API_KEY);
  }
  return headers;
}

async function fetchComTelemetria<T>(
  path: string,
  init: RequestInit,
  options?: { userId?: string | null; includeSupportKey?: boolean },
): Promise<ApiResultWithTelemetry<T>> {
  const inicio = performance.now();
  const headers = montarHeaders({
    userId: options?.userId ?? null,
    ...(init.body !== undefined ? { contentType: "application/json" } : {}),
    ...(options?.includeSupportKey ? { includeSupportKey: true } : {}),
  });

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const clientTimeMs = Math.round((performance.now() - inicio) * 100) / 100;
  const rawProcessTime = response.headers.get("X-Process-Time");
  const parsedProcessTime =
    rawProcessTime !== null ? Number.parseFloat(rawProcessTime) : Number.NaN;
  const processTimeMs = Number.isFinite(parsedProcessTime) ? parsedProcessTime : null;
  const requestId = response.headers.get("X-Request-ID");

  if (!response.ok) {
    const mensagem = await extrairMensagemErro(response);
    throw new ApiError(mensagem, response.status, requestId);
  }

  if (response.status === 204) {
    return {
      data: undefined as T,
      processTimeMs,
      requestId,
      clientTimeMs,
    };
  }

  const data = (await response.json()) as T;
  return {
    data,
    processTimeMs,
    requestId,
    clientTimeMs,
  };
}

export async function loginGoogleApi(credential: string): Promise<LoginResponse> {
  const res = await fetchComTelemetria<LoginResponse>("/api/v1/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
  return res.data;
}

export async function loginVisitanteApi(): Promise<LoginResponse> {
  const res = await fetchComTelemetria<LoginResponse>("/api/v1/auth/visitante", {
    method: "POST",
  });
  return res.data;
}

export async function consultarSessaoApi(userId: string): Promise<LoginResponse> {
  const res = await fetchComTelemetria<LoginResponse>(
    "/api/v1/auth/sessao",
    { method: "GET" },
    { userId },
  );
  return res.data;
}

export async function logoutApi(userId: string): Promise<void> {
  await fetchComTelemetria<void>("/api/v1/auth/logout", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export function logoutViaBeacon(userId: string): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }
  const blob = new Blob([JSON.stringify({ user_id: userId })], {
    type: "text/plain;charset=UTF-8",
  });
  return navigator.sendBeacon(`${API_BASE_URL}/api/v1/auth/logout`, blob);
}

export async function planejarRoteiroApi(
  payload: RoteiroRequest,
  userId: string,
  signal?: AbortSignal,
): Promise<ApiResultWithTelemetry<RoteiroResponse>> {
  return fetchComTelemetria<RoteiroResponse>(
    "/api/v1/roteiros/planejar",
    {
      method: "POST",
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {}),
    },
    { userId },
  );
}

export async function obterMapaRotaApi(
  payload: MapaRotaRequest,
  userId: string,
  signal?: AbortSignal,
): Promise<ApiResultWithTelemetry<MapaRotaResponse>> {
  return fetchComTelemetria<MapaRotaResponse>(
    "/api/v1/roteiros/mapa-rota",
    {
      method: "POST",
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {}),
    },
    { userId },
  );
}

export async function calcularCustosApi(
  payload: CustosRequest,
  signal?: AbortSignal,
): Promise<CustosInfo> {
  const res = await fetchComTelemetria<CustosInfo>("/api/v1/roteiros/custos", {
    method: "POST",
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  });
  return res.data;
}

export async function streamGuiaIaApi(
  payload: GuiaStreamRequest,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/roteiros/stream-guia`, {
    method: "POST",
    headers: montarHeaders({ contentType: "application/json" }),
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    const msg = await extrairMensagemErro(response);
    throw new ApiError(msg, response.status, response.headers.get("X-Request-ID"));
  }

  if (!response.body) {
    throw new ApiError("O navegador não retornou um ReadableStream para o guia.", 500);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const eventos = buffer.split("\n\n");
      buffer = eventos.pop() ?? "";

      for (const bloco of eventos) {
        const linhas = bloco.split("\n");
        for (const linha of linhas) {
          if (!linha.startsWith("data:")) continue;
          const jsonTexto = linha.slice(5).trim();
          if (!jsonTexto) continue;
          try {
            const parsed = JSON.parse(jsonTexto) as { chunk?: string; done?: boolean };
            if (typeof parsed.chunk === "string" && parsed.chunk.length > 0) {
              onChunk(parsed.chunk);
            }
            if (parsed.done) {
              return;
            }
          } catch {
            // Ignora frame malformado isolado.
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function listarMinhasViagensApi(userId: string): Promise<RoteiroResponse[]> {
  const res = await fetchComTelemetria<RoteiroResponse[]>(
    "/api/v1/roteiros/minhas-viagens",
    { method: "GET" },
    { userId },
  );
  return res.data;
}

export async function excluirRoteiroApi(roteiroId: string, userId: string): Promise<void> {
  await fetchComTelemetria<void>(
    `/api/v1/roteiros/${encodeURIComponent(roteiroId)}`,
    { method: "DELETE" },
    { userId },
  );
}

export async function marcarVisitaApi(
  roteiroId: string,
  atrativoId: string,
  visitado: boolean,
  userId: string,
): Promise<RoteiroResponse> {
  const res = await fetchComTelemetria<RoteiroResponse>(
    `/api/v1/roteiros/${encodeURIComponent(roteiroId)}/visitas`,
    {
      method: "PATCH",
      body: JSON.stringify({ atrativo_id: atrativoId, visitado }),
    },
    { userId },
  );
  return res.data;
}

export async function compartilharRoteiroApi(
  roteiroId: string,
  canal: "whatsapp" | "email",
  userId: string,
  destinatario?: string,
): Promise<CompartilharResponse> {
  const body = destinatario ? { canal, destinatario } : { canal };
  const res = await fetchComTelemetria<CompartilharResponse>(
    `/api/v1/roteiros/${encodeURIComponent(roteiroId)}/compartilhar`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    { userId },
  );
  return res.data;
}

export async function exportarGpxApi(
  roteiroId: string,
  userId: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/roteiros/exportar/gpx`, {
    method: "POST",
    headers: montarHeaders({ userId, contentType: "application/json" }),
    body: JSON.stringify({ roteiro_id: roteiroId }),
  });

  if (!response.ok) {
    const msg = await extrairMensagemErro(response);
    throw new ApiError(msg, response.status, response.headers.get("X-Request-ID"));
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `roteiro-${roteiroId.slice(0, 8)}.gpx`;
  const blob = await response.blob();
  return { blob, filename };
}

export async function listarDestinosApi(): Promise<DestinoCatalogo[]> {
  const res = await fetchComTelemetria<DestinoCatalogo[]>("/api/v1/roteiros/destinos", {
    method: "GET",
  });
  return res.data;
}

export async function consultarReadyzApi(): Promise<ReadyzResponse> {
  const res = await fetchComTelemetria<ReadyzResponse>("/readyz", {
    method: "GET",
  });
  return res.data;
}

export async function consultarTelemetriaApi(): Promise<TelemetriaBackend | null> {
  try {
    const res = await fetchComTelemetria<TelemetriaBackend>(
      "/api/v1/telemetria",
      { method: "GET" },
      { includeSupportKey: true },
    );
    return res.data;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
      return null;
    }
    throw err;
  }
}
