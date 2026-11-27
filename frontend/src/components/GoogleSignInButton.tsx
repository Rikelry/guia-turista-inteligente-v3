import { useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID } from "../config.ts";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with";
      shape?: "rectangular" | "pill";
      width?: number;
      locale?: string;
    },
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

// O SDK do Google só aceita um callback global: inicializamos uma vez e
// encaminhamos a credencial para o botão montado no momento.
let gsiInicializado = false;
let callbackAtual: ((credential: string) => void) | null = null;

export interface GoogleSignInButtonProps {
  isDark: boolean;
  text?: "signin_with" | "continue_with";
  width?: number;
  onCredential: (credential: string) => void;
}

export function GoogleSignInButton({
  isDark,
  text = "continue_with",
  width = 260,
  onCredential,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    callbackAtual = onCredential;
    return () => {
      if (callbackAtual === onCredential) callbackAtual = null;
    };
  }, [onCredential]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let tentativas = 0;
    let timer: number | undefined;

    const renderizar = (): void => {
      const gsi = window.google?.accounts?.id;
      const container = containerRef.current;
      if (!container) return;

      // O script do Google carrega com async/defer: aguarda até ~10s.
      if (!gsi) {
        if (tentativas++ < 50) timer = window.setTimeout(renderizar, 200);
        return;
      }

      if (!gsiInicializado) {
        gsi.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (res) => {
            if (res.credential) callbackAtual?.(res.credential);
          },
        });
        gsiInicializado = true;
      }

      container.innerHTML = "";
      gsi.renderButton(container, {
        theme: isDark ? "filled_black" : "outline",
        size: "large",
        text,
        shape: "pill",
        width,
        locale: "pt-BR",
      });
    };

    renderizar();
    return () => window.clearTimeout(timer);
  }, [isDark, text, width]);

  return (
    <div className="google-signin-container">
      <div ref={containerRef} />
    </div>
  );
}
