import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import type { SessionTimerState } from "../hooks/useSessionTimer.ts";
import type { UsuarioPerfil } from "../types/schemas.ts";
import { Header } from "./Header.tsx";

const MOCK_TIMER: SessionTimerState = {
  elapsedSeconds: 14,
  elapsedLabel: "14s",
  remainingSeconds: 7100,
  remainingLabel: "1h 58m 20s",
  isExpiringSoon: false,
  isExpired: false,
  inicioFormatado: "27/11/26 15:30:00",
};

const GOOGLE_USER: UsuarioPerfil = {
  user_id: "google-sub-123456",
  nome: "Maykol Sampaio",
  tipo: "google",
  email: "maykolsampaio@gmail.com",
  foto: null,
  expira_em: null,
};

const GUEST_USER: UsuarioPerfil = {
  user_id: "visitante-abc123",
  nome: "Visitante",
  tipo: "visitante",
  email: null,
  foto: null,
  expira_em: new Date(Date.now() + 7200_000).toISOString(),
};

describe("Header e Sessão Híbrida", () => {
  it("alterna tema e permite trocar da conta Google para Modo Visitante", async () => {
    const user = userEvent.setup();
    const onToggleTheme = vi.fn();
    const onAlternarVisitante = vi.fn().mockResolvedValue(undefined);

    render(
      <Header
        usuario={GOOGLE_USER}
        savedGoogleUser={GOOGLE_USER}
        googleLoginHabilitado={true}
        isDark={false}
        isOnline={true}
        sessionTimer={MOCK_TIMER}
        onToggleTheme={onToggleTheme}
        onEntrarGoogle={vi.fn().mockResolvedValue(undefined)}
        onAlternarVisitante={onAlternarVisitante}
        onVoltarParaGoogle={vi.fn().mockResolvedValue(undefined)}
        onSairGoogle={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Ativar tema escuro/i }));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Menu da sessão do usuário/i }));
    expect(screen.getByText("Maykol Sampaio")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /Alternar para Modo Visitante/i }));
    expect(onAlternarVisitante).toHaveBeenCalledTimes(1);
  });

  it("exibe botão de restauração em 1 clique quando está em Modo Visitante com conta Google preservada", async () => {
    const user = userEvent.setup();
    const onVoltarParaGoogle = vi.fn().mockResolvedValue(undefined);

    render(
      <Header
        usuario={GUEST_USER}
        savedGoogleUser={GOOGLE_USER}
        googleLoginHabilitado={true}
        isDark={false}
        isOnline={true}
        sessionTimer={MOCK_TIMER}
        onToggleTheme={vi.fn()}
        onEntrarGoogle={vi.fn().mockResolvedValue(undefined)}
        onAlternarVisitante={vi.fn().mockResolvedValue(undefined)}
        onVoltarParaGoogle={onVoltarParaGoogle}
        onSairGoogle={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const restoreBtn = screen.getByRole("button", { name: /Voltar para Maykol/i });
    await user.click(restoreBtn);
    expect(onVoltarParaGoogle).toHaveBeenCalledTimes(1);
  });
});
