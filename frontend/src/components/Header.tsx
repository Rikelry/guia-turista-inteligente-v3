import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID } from "../config.ts";
import type { SessionTimerState } from "../hooks/useSessionTimer.ts";
import type { UsuarioPerfil } from "../types/schemas.ts";
import { GoogleSignInButton } from "./GoogleSignInButton.tsx";

export interface HeaderProps {
  usuario: UsuarioPerfil | null;
  savedGoogleUser: UsuarioPerfil | null;
  googleLoginHabilitado: boolean;
  isDark: boolean;
  isOnline: boolean;
  sessionTimer: SessionTimerState;
  onToggleTheme: () => void;
  onEntrarGoogle: (credential: string) => Promise<void>;
  onAlternarVisitante: () => Promise<void>;
  onVoltarParaGoogle: () => Promise<void>;
  onSairGoogle: () => Promise<void>;
  onEncerrarSessao?: () => Promise<void>;
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

function iniciaisNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "V";
  const segunda = partes[1]?.[0] ?? "";
  return (primeira + segunda).toUpperCase();
}

export function Header({
  usuario,
  savedGoogleUser,
  googleLoginHabilitado,
  isDark,
  isOnline,
  sessionTimer,
  onToggleTheme,
  onEntrarGoogle,
  onAlternarVisitante,
  onVoltarParaGoogle,
  onSairGoogle,
  onEncerrarSessao,
}: HeaderProps) {
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const aoClicarFora = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAberto(false);
      }
    };
    const aoPressionarEsc = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setMenuAberto(false);
    };
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoPressionarEsc);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoPressionarEsc);
    };
  }, []);

  const isGoogle = usuario?.tipo === "google";
  const nomeCurto = usuario ? primeiroNome(usuario.nome) : "Visitante";

  return (
    <header className="app-header" role="banner">
      <div className="app-header-inner">
        <div className="brand-block">
          <div className="brand-logo" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M6 4v16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M6 5h12l-2.4 4.8L18 14.5H6V5z" fill="currentColor" />
            </svg>
          </div>
          <div className="brand-copy">
            <h1 className="brand-title">Guia do Turista Brasil</h1>
            <p className="brand-subtitle">
              Consultor inteligente de viagens com rotas, clima e guia turístico gerado com Python e
              IA
            </p>
          </div>
        </div>

        <div className="header-actions">
          {!isOnline && (
            <span className="status-pill status-pill-offline" role="status">
              ● Offline
            </span>
          )}

          {!isGoogle && savedGoogleUser && (
            <button
              type="button"
              className="btn-restore-google"
              onClick={() => void onVoltarParaGoogle()}
              title="Restaurar sua conta Google em 1 clique"
            >
              ↩ Voltar para {primeiroNome(savedGoogleUser.nome)}
            </button>
          )}

          <button
            type="button"
            className="btn-theme-toggle"
            onClick={onToggleTheme}
            aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
            aria-pressed={isDark}
            title={isDark ? "Alternar para modo claro" : "Alternar para modo escuro"}
          >
            {isDark ? (
              <span aria-hidden="true" className="theme-icon">
                ☀️
              </span>
            ) : (
              <span aria-hidden="true" className="theme-icon">
                🌙
              </span>
            )}
          </button>

          <div className="user-menu-wrapper" ref={menuRef}>
            <button
              type="button"
              className="user-pill-btn"
              onClick={() => setMenuAberto((prev) => !prev)}
              aria-expanded={menuAberto}
              aria-haspopup="menu"
              aria-label="Menu da sessão do usuário"
            >
              {usuario?.foto ? (
                <img
                  src={usuario.foto}
                  alt={usuario.nome}
                  className="user-avatar-img"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className={`user-avatar-fallback ${isGoogle ? "is-google" : ""}`}>
                  {iniciaisNome(usuario?.nome ?? "Visitante")}
                </span>
              )}
              <span className="user-pill-name">{nomeCurto}</span>
              <span className="user-pill-caret" aria-hidden="true">
                {menuAberto ? "▲" : "▼"}
              </span>
            </button>

            {menuAberto && (
              <div className="user-dropdown" role="menu" aria-label="Opções de sessão">
                <div className="user-dropdown-profile">
                  {usuario?.foto ? (
                    <img
                      src={usuario.foto}
                      alt={usuario.nome}
                      className="user-dropdown-avatar"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`user-dropdown-avatar-fallback ${isGoogle ? "is-google" : ""}`}>
                      {iniciaisNome(usuario?.nome ?? "Visitante")}
                    </div>
                  )}
                  <div className="user-dropdown-info">
                    <strong className="user-dropdown-name">{usuario?.nome ?? "Visitante"}</strong>
                    <span className="user-dropdown-email">
                      {usuario?.email ??
                        (sessionTimer.remainingLabel
                          ? `Sessão expira em ${sessionTimer.remainingLabel}`
                          : "Sessão temporária de 2 horas")}
                    </span>
                    <span
                      className={`session-badge ${isGoogle ? "session-badge-google" : "session-badge-guest"}`}
                    >
                      {isGoogle ? "🔒 Conta Google Conectada" : "⏳ Modo Visitante Temporário"}
                    </span>
                  </div>
                </div>

                <div className="user-dropdown-divider" />

                <p className="user-dropdown-section-label">ALTERNAR MODO DE NAVEGAÇÃO</p>

                {isGoogle ? (
                  <>
                    <button
                      type="button"
                      className="dropdown-mode-card"
                      role="menuitem"
                      onClick={() => {
                        setMenuAberto(false);
                        void onAlternarVisitante();
                      }}
                    >
                      <span className="dropdown-mode-icon" aria-hidden="true">
                        👤
                      </span>
                      <span className="dropdown-mode-copy">
                        <strong>Alternar para Modo Visitante</strong>
                        <small>Navegação temporária sem vincular conta</small>
                      </span>
                      <span className="dropdown-mode-arrow" aria-hidden="true">
                        →
                      </span>
                    </button>

                    <div className="user-dropdown-divider" />

                    <button
                      type="button"
                      className="dropdown-logout-btn"
                      role="menuitem"
                      onClick={() => {
                        setMenuAberto(false);
                        void onSairGoogle();
                      }}
                    >
                      <span aria-hidden="true">🚪</span>
                      <span>Sair da Conta Google</span>
                    </button>
                  </>
                ) : (
                  <div className="dropdown-guest-actions">
                    {savedGoogleUser && (
                      <button
                        type="button"
                        className="dropdown-mode-card dropdown-mode-card-restore"
                        role="menuitem"
                        onClick={() => {
                          setMenuAberto(false);
                          void onVoltarParaGoogle();
                        }}
                      >
                        <span className="dropdown-mode-icon" aria-hidden="true">
                          🔄
                        </span>
                        <span className="dropdown-mode-copy">
                          <strong>Voltar para {primeiroNome(savedGoogleUser.nome)}</strong>
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
                        onCredential={(credential) => {
                          setMenuAberto(false);
                          void onEntrarGoogle(credential);
                        }}
                      />
                    ) : (
                      <p className="google-config-hint">
                        {googleLoginHabilitado
                          ? "Configure VITE_GOOGLE_CLIENT_ID no frontend/.env para habilitar o botão Google Sign-In."
                          : "Login com Google opcional: você pode planejar viagens livremente em Modo Visitante."}
                      </p>
                    )}

                    {onEncerrarSessao && (
                      <>
                        <div className="user-dropdown-divider" />
                        <button
                          type="button"
                          className="dropdown-logout-btn"
                          role="menuitem"
                          onClick={() => {
                            setMenuAberto(false);
                            void onEncerrarSessao();
                          }}
                        >
                          <span aria-hidden="true">🚪</span>
                          <span>Encerrar sessão de visitante</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
