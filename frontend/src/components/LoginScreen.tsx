import { useState } from "react";
import { GOOGLE_CLIENT_ID } from "../config.ts";
import type { UsuarioPerfil } from "../types/schemas.ts";
import { GoogleSignInButton } from "./GoogleSignInButton.tsx";

export interface LoginScreenProps {
  savedGoogleUser: UsuarioPerfil | null;
  googleLoginHabilitado: boolean;
  carregando: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onEntrarGoogle: (credential: string) => Promise<void>;
  onEntrarVisitante: () => Promise<void>;
  onVoltarParaGoogle: () => Promise<void>;
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export function LoginScreen({
  savedGoogleUser,
  googleLoginHabilitado,
  carregando,
  isDark,
  onToggleTheme,
  onEntrarGoogle,
  onEntrarVisitante,
  onVoltarParaGoogle,
}: LoginScreenProps) {
  const [enviando, setEnviando] = useState(false);
  const bloqueado = carregando || enviando;

  const executar = async (acao: () => Promise<void>): Promise<void> => {
    if (bloqueado) return;
    setEnviando(true);
    try {
      await acao();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main id="conteudo-principal" className="login-screen">
      <button
        type="button"
        className="btn-theme-toggle login-theme-toggle"
        onClick={onToggleTheme}
        aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
        aria-pressed={isDark}
      >
        <span aria-hidden="true" className="theme-icon">
          {isDark ? "☀️" : "🌙"}
        </span>
      </button>

      <section className="card login-card" aria-labelledby="login-titulo">
        <div className="brand-logo login-logo" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M6 4v16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M6 5h12l-2.4 4.8L18 14.5H6V5z" fill="currentColor" />
          </svg>
        </div>
        <p className="login-brand">Guia do Turista Brasil</p>

        <h1 id="login-titulo" className="login-title">
          Autenticação Necessária
        </h1>
        <p className="login-subtitle">
          Faça login com sua Conta Google para acessar o planejador de viagens.
        </p>

        <div className="login-actions" aria-busy={bloqueado}>
          {savedGoogleUser && (
            <button
              type="button"
              className="dropdown-mode-card dropdown-mode-card-restore"
              disabled={bloqueado}
              onClick={() => void executar(onVoltarParaGoogle)}
            >
              <span className="dropdown-mode-icon" aria-hidden="true">
                🔄
              </span>
              <span className="dropdown-mode-copy">
                <strong>Continuar como {primeiroNome(savedGoogleUser.nome)}</strong>
                <small>Restaurar conta Google em 1 clique</small>
              </span>
              <span className="dropdown-mode-arrow" aria-hidden="true">
                →
              </span>
            </button>
          )}

          {GOOGLE_CLIENT_ID ? (
            <GoogleSignInButton
              isDark={isDark}
              text="signin_with"
              width={280}
              onCredential={(credential) => void executar(() => onEntrarGoogle(credential))}
            />
          ) : (
            <p className="google-config-hint">
              {googleLoginHabilitado
                ? "Configure VITE_GOOGLE_CLIENT_ID no frontend/.env para habilitar o botão Google Sign-In."
                : "Login com Google indisponível no momento. Você pode entrar como visitante."}
            </p>
          )}

          <div className="login-divider" role="separator">
            <span>ou</span>
          </div>

          <button
            type="button"
            className="btn-login-guest"
            disabled={bloqueado}
            onClick={() => void executar(onEntrarVisitante)}
          >
            👤 Entrar como Visitante
          </button>
          <p className="login-guest-hint">
            Sessão temporária de 2 horas. As viagens não ficam salvas na sua conta.
          </p>
        </div>
      </section>
    </main>
  );
}
