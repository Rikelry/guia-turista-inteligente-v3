import { useCallback, useEffect, useState } from "react";
import { obterTemaSalvo, salvarTema } from "../services/visitanteStorage.ts";

export type Tema = "light" | "dark";

function detectarTemaInicial(): Tema {
  const salvo = obterTemaSalvo();
  if (salvo) return salvo;
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function useTheme(): {
  theme: Tema;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (tema: Tema) => void;
} {
  const [theme, setThemeState] = useState<Tema>(detectarTemaInicial);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    salvarTema(theme);
  }, [theme]);

  const setTheme = useCallback((novoTema: Tema) => {
    setThemeState(novoTema);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((atual) => (atual === "dark" ? "light" : "dark"));
  }, []);

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme,
    setTheme,
  };
}
