import { useCallback, useEffect, useRef, useState } from "react";
import { VISITANTE_TTL_MS } from "../config.ts";
import {
  consultarSessaoApi,
  loginGoogleApi,
  loginVisitanteApi,
  logoutApi,
  logoutViaBeacon,
} from "../services/api.ts";
import {
  limparViagensVisitanteCache,
  obterGoogleUserSalvo,
  obterInicioSessaoSalvo,
  obterUsuarioAtivoSalvo,
  reiniciarInicioSessao,
  salvarGoogleUser,
  salvarUsuarioAtivo,
} from "../services/visitanteStorage.ts";
import type { UsuarioPerfil } from "../types/schemas.ts";

function criarVisitanteLocalFallback(): UsuarioPerfil {
  const aleatorio = Math.random().toString(16).slice(2, 14);
  return {
    user_id: `visitante-local-${aleatorio}`,
    nome: "Visitante",
    tipo: "visitante",
    email: null,
    foto: null,
    expira_em: new Date(Date.now() + VISITANTE_TTL_MS).toISOString(),
  };
}

export interface UseAuthOptions {
  onModeSwitch?: () => void;
  onNotify?: (
    tipo: "success" | "error" | "info" | "warning",
    titulo: string,
    mensagem?: string,
  ) => void;
}

export interface UseAuthReturn {
  usuario: UsuarioPerfil | null;
  savedGoogleUser: UsuarioPerfil | null;
  sessionStartMs: number;
  carregandoAuth: boolean;
  entrarComGoogle: (credential: string) => Promise<void>;
  alternarParaVisitante: () => Promise<void>;
  voltarParaGoogle: () => Promise<void>;
  sairDaContaGoogle: () => Promise<void>;
  renovarVisitante: () => Promise<UsuarioPerfil>;
}

export function useAuth(options: UseAuthOptions = {}): UseAuthReturn {
  const { onModeSwitch, onNotify } = options;
  const [usuario, setUsuario] = useState<UsuarioPerfil | null>(() => obterUsuarioAtivoSalvo());
  const [savedGoogleUser, setSavedGoogleUser] = useState<UsuarioPerfil | null>(() =>
    obterGoogleUserSalvo(),
  );
  const [sessionStartMs, setSessionStartMs] = useState<number>(() => obterInicioSessaoSalvo());
  const [carregandoAuth, setCarregandoAuth] = useState<boolean>(true);
  const usuarioRef = useRef<UsuarioPerfil | null>(usuario);

  useEffect(() => {
    usuarioRef.current = usuario;
  }, [usuario]);

  const iniciarNovaSessaoVisitante = useCallback(async (): Promise<UsuarioPerfil> => {
    try {
      const { usuario: visitante } = await loginVisitanteApi();
      salvarUsuarioAtivo(visitante);
      setUsuario(visitante);
      setSessionStartMs(reiniciarInicioSessao());
      return visitante;
    } catch {
      const local = criarVisitanteLocalFallback();
      salvarUsuarioAtivo(local);
      setUsuario(local);
      setSessionStartMs(reiniciarInicioSessao());
      return local;
    }
  }, []);

  useEffect(() => {
    let ativo = true;

    async function inicializarSessao(): Promise<void> {
      const salvo = obterUsuarioAtivoSalvo();
      if (salvo) {
        try {
          const { usuario: validado } = await consultarSessaoApi(salvo.user_id);
          if (!ativo) return;
          salvarUsuarioAtivo(validado);
          setUsuario(validado);
          if (validado.tipo === "google") {
            salvarGoogleUser(validado);
            setSavedGoogleUser(validado);
          }
          setCarregandoAuth(false);
          return;
        } catch {
          // Sessão expirou no servidor ou reiniciou: se era visitante, cria novo visitante.
          // Se era Google e servidor reiniciou, mantém salvo em savedGoogleUser e cria visitante.
          if (salvo.tipo === "google") {
            salvarGoogleUser(salvo);
            setSavedGoogleUser(salvo);
          }
        }
      }

      if (!ativo) return;
      await iniciarNovaSessaoVisitante();
      if (ativo) {
        setCarregandoAuth(false);
      }
    }

    void inicializarSessao();

    return () => {
      ativo = false;
    };
  }, [iniciarNovaSessaoVisitante]);

  useEffect(() => {
    const aoFecharJanela = (): void => {
      const atual = usuarioRef.current;
      if (atual && atual.tipo === "visitante" && !atual.user_id.startsWith("visitante-local-")) {
        logoutViaBeacon(atual.user_id);
      }
    };

    window.addEventListener("pagehide", aoFecharJanela);
    return () => {
      window.removeEventListener("pagehide", aoFecharJanela);
    };
  }, []);

  const entrarComGoogle = useCallback(
    async (credential: string): Promise<void> => {
      setCarregandoAuth(true);
      try {
        const anterior = usuarioRef.current;
        const { usuario: googleUser } = await loginGoogleApi(credential);
        if (anterior && anterior.tipo === "visitante") {
          limparViagensVisitanteCache(anterior.user_id);
          void logoutApi(anterior.user_id).catch(() => undefined);
        }
        salvarUsuarioAtivo(googleUser);
        salvarGoogleUser(googleUser);
        setUsuario(googleUser);
        setSavedGoogleUser(googleUser);
        setSessionStartMs(reiniciarInicioSessao());
        onModeSwitch?.();
        onNotify?.(
          "success",
          `Bem-vindo, ${googleUser.nome}!`,
          "Sua conta Google está conectada com histórico permanente.",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha na autenticação Google.";
        onNotify?.("error", "Não foi possível entrar com o Google", msg);
      } finally {
        setCarregandoAuth(false);
      }
    },
    [onModeSwitch, onNotify],
  );

  const alternarParaVisitante = useCallback(async (): Promise<void> => {
    const atual = usuarioRef.current;
    if (atual?.tipo === "google") {
      salvarGoogleUser(atual);
      setSavedGoogleUser(atual);
    }
    setCarregandoAuth(true);
    try {
      await iniciarNovaSessaoVisitante();
      onModeSwitch?.();
      onNotify?.(
        "info",
        "Modo Visitante ativado",
        atual?.tipo === "google"
          ? `Sua conta Google (${atual.nome}) foi preservada para restauração em 1 clique.`
          : "Sessão temporária iniciada com validade de 2 horas.",
      );
    } finally {
      setCarregandoAuth(false);
    }
  }, [iniciarNovaSessaoVisitante, onModeSwitch, onNotify]);

  const voltarParaGoogle = useCallback(async (): Promise<void> => {
    const salvo = savedGoogleUser ?? obterGoogleUserSalvo();
    if (!salvo) return;

    setCarregandoAuth(true);
    try {
      const atual = usuarioRef.current;
      try {
        const { usuario: validado } = await consultarSessaoApi(salvo.user_id);
        salvarUsuarioAtivo(validado);
        salvarGoogleUser(validado);
        setUsuario(validado);
        setSavedGoogleUser(validado);
      } catch {
        salvarUsuarioAtivo(salvo);
        setUsuario(salvo);
      }

      if (atual && atual.tipo === "visitante") {
        limparViagensVisitanteCache(atual.user_id);
        void logoutApi(atual.user_id).catch(() => undefined);
      }

      setSessionStartMs(reiniciarInicioSessao());
      onModeSwitch?.();
      onNotify?.(
        "success",
        `Sessão restaurada: ${salvo.nome}`,
        "Seu histórico permanente da conta Google está de volta.",
      );
    } finally {
      setCarregandoAuth(false);
    }
  }, [onModeSwitch, onNotify, savedGoogleUser]);

  const sairDaContaGoogle = useCallback(async (): Promise<void> => {
    const atual = usuarioRef.current;
    const googleAlvo = atual?.tipo === "google" ? atual : savedGoogleUser;
    setCarregandoAuth(true);
    try {
      if (googleAlvo) {
        void logoutApi(googleAlvo.user_id).catch(() => undefined);
      }
      salvarGoogleUser(null);
      setSavedGoogleUser(null);
      await iniciarNovaSessaoVisitante();
      onModeSwitch?.();
      onNotify?.("info", "Conta Google desconectada", "Você continua navegando em Modo Visitante.");
    } finally {
      setCarregandoAuth(false);
    }
  }, [iniciarNovaSessaoVisitante, onModeSwitch, onNotify, savedGoogleUser]);

  return {
    usuario,
    savedGoogleUser,
    sessionStartMs,
    carregandoAuth,
    entrarComGoogle,
    alternarParaVisitante,
    voltarParaGoogle,
    sairDaContaGoogle,
    renovarVisitante: iniciarNovaSessaoVisitante,
  };
}
