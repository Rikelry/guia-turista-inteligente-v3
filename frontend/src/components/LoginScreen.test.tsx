import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import type { UsuarioPerfil } from "../types/schemas.ts";
import { LoginScreen } from "./LoginScreen.tsx";

const GOOGLE_USER: UsuarioPerfil = {
  user_id: "google-sub-123456",
  nome: "Maykol Sampaio",
  tipo: "google",
  email: "maykolsampaio@gmail.com",
  foto: null,
  expira_em: null,
};

function renderLogin(overrides: Partial<Parameters<typeof LoginScreen>[0]> = {}) {
  const props = {
    savedGoogleUser: null,
    googleLoginHabilitado: false,
    carregando: false,
    isDark: false,
    onToggleTheme: vi.fn(),
    onEntrarGoogle: vi.fn().mockResolvedValue(undefined),
    onEntrarVisitante: vi.fn().mockResolvedValue(undefined),
    onVoltarParaGoogle: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<LoginScreen {...props} />);
  return props;
}

describe("LoginScreen", () => {
  it("exige autenticação e permite entrar como visitante", async () => {
    const user = userEvent.setup();
    const props = renderLogin();

    expect(screen.getByRole("heading", { name: /Autenticação Necessária/i })).toBeInTheDocument();
    expect(screen.queryByText(/Continuar como/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Entrar como Visitante/i }));
    expect(props.onEntrarVisitante).toHaveBeenCalledTimes(1);
  });

  it("oferece restaurar a conta Google preservada em 1 clique", async () => {
    const user = userEvent.setup();
    const props = renderLogin({ savedGoogleUser: GOOGLE_USER });

    await user.click(screen.getByRole("button", { name: /Continuar como Maykol/i }));
    expect(props.onVoltarParaGoogle).toHaveBeenCalledTimes(1);
  });

  it("bloqueia as ações enquanto a autenticação está em andamento", () => {
    renderLogin({ carregando: true });
    expect(screen.getByRole("button", { name: /Entrar como Visitante/i })).toBeDisabled();
  });
});
