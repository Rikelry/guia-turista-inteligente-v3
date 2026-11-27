import { STORAGE_KEYS } from "../config.ts";
import {
  isRoteiroResponse,
  isUsuarioPerfil,
  type RoteiroResponse,
  type UsuarioPerfil,
} from "../types/schemas.ts";

function lerJsonSeguro<T>(chave: string): T | null {
  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return null;
    return JSON.parse(bruto) as T;
  } catch {
    return null;
  }
}

function gravarJsonSeguro(chave: string, valor: unknown): void {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Quota excedida ou navegação privada restritiva: degradar sem quebrar a UI.
  }
}

function removerSeguro(chave: string): void {
  try {
    window.localStorage.removeItem(chave);
  } catch {
    // Ignorar falha de acesso ao storage.
  }
}

export function obterUsuarioAtivoSalvo(): UsuarioPerfil | null {
  const dados = lerJsonSeguro<unknown>(STORAGE_KEYS.ACTIVE_USER);
  if (!isUsuarioPerfil(dados)) return null;
  if (dados.tipo === "visitante" && dados.expira_em) {
    const expiraMs = Date.parse(dados.expira_em);
    if (Number.isFinite(expiraMs) && expiraMs <= Date.now()) {
      removerSeguro(STORAGE_KEYS.ACTIVE_USER);
      return null;
    }
  }
  return dados;
}

export function salvarUsuarioAtivo(usuario: UsuarioPerfil | null): void {
  if (!usuario) {
    removerSeguro(STORAGE_KEYS.ACTIVE_USER);
    return;
  }
  gravarJsonSeguro(STORAGE_KEYS.ACTIVE_USER, usuario);
}

export function obterGoogleUserSalvo(): UsuarioPerfil | null {
  const dados = lerJsonSeguro<unknown>(STORAGE_KEYS.SAVED_GOOGLE_USER);
  if (!isUsuarioPerfil(dados) || dados.tipo !== "google") return null;
  return dados;
}

export function salvarGoogleUser(usuario: UsuarioPerfil | null): void {
  if (!usuario) {
    removerSeguro(STORAGE_KEYS.SAVED_GOOGLE_USER);
    return;
  }
  gravarJsonSeguro(STORAGE_KEYS.SAVED_GOOGLE_USER, usuario);
}

export function obterInicioSessaoSalvo(): number {
  const salvo = lerJsonSeguro<unknown>(STORAGE_KEYS.SESSION_START);
  if (typeof salvo === "number" && Number.isFinite(salvo) && salvo > 0) {
    return salvo;
  }
  const agora = Date.now();
  gravarJsonSeguro(STORAGE_KEYS.SESSION_START, agora);
  return agora;
}

export function reiniciarInicioSessao(): number {
  const agora = Date.now();
  gravarJsonSeguro(STORAGE_KEYS.SESSION_START, agora);
  return agora;
}

export function obterViagensVisitanteCache(userId: string): RoteiroResponse[] {
  const cache = lerJsonSeguro<Record<string, unknown>>(STORAGE_KEYS.GUEST_TRIPS_CACHE);
  if (!cache || typeof cache !== "object") return [];
  const lista = cache[userId];
  if (!Array.isArray(lista)) return [];
  return lista.filter(isRoteiroResponse);
}

export function salvarViagensVisitanteCache(userId: string, viagens: RoteiroResponse[]): void {
  const cache =
    lerJsonSeguro<Record<string, RoteiroResponse[]>>(STORAGE_KEYS.GUEST_TRIPS_CACHE) ?? {};
  cache[userId] = viagens.slice(0, 20);
  gravarJsonSeguro(STORAGE_KEYS.GUEST_TRIPS_CACHE, cache);
}

export function limparViagensVisitanteCache(userId?: string): void {
  if (!userId) {
    removerSeguro(STORAGE_KEYS.GUEST_TRIPS_CACHE);
    return;
  }
  const cache = lerJsonSeguro<Record<string, RoteiroResponse[]>>(STORAGE_KEYS.GUEST_TRIPS_CACHE);
  if (!cache || typeof cache !== "object") return;
  delete cache[userId];
  gravarJsonSeguro(STORAGE_KEYS.GUEST_TRIPS_CACHE, cache);
}

export function obterTemaSalvo(): "light" | "dark" | null {
  try {
    const tema = window.localStorage.getItem(STORAGE_KEYS.THEME);
    if (tema === "light" || tema === "dark") return tema;
    return null;
  } catch {
    return null;
  }
}

export function salvarTema(tema: "light" | "dark"): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.THEME, tema);
  } catch {
    // Ignorar falha de acesso ao storage.
  }
}
