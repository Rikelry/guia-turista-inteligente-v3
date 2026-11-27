import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import type { RoteiroResponse } from "../types/schemas.ts";
import { RoteiroResult } from "./RoteiroResult.tsx";

const MOCK_ROTEIRO: RoteiroResponse = {
  id: "rot-001",
  criado_em: "2026-11-27T15:00:00Z",
  origem: {
    cidade: "Piripiri",
    uf: "PI",
    nome: "Piripiri - PI",
    lat: -4.272,
    lon: -41.777,
    encontrado: true,
  },
  destino: {
    cidade: "Natal",
    uf: "RN",
    nome: "Natal - RN",
    lat: -5.795,
    lon: -35.209,
    encontrado: true,
  },
  dias_estadia: 1,
  estilo_viagem: "cultural",
  clima: {
    disponivel: true,
    temperatura_c: 27.1,
    sensacao_c: 28.8,
    umidade_pct: 68,
    vento_kmh: 19,
    condicao: "Céu Limpo",
  },
  rota: {
    disponivel: true,
    distancia_km: 932.5,
    duracao_min: 842,
    resumo: "932.5 km em 14h 2min",
    geometria: [
      [-4.272, -41.777],
      [-5.795, -35.209],
    ],
  },
  guia: [
    "📍 IDENTIDADE: Natal combina dunas, história colonial e praias ensolaradas.",
    "🗓️ ROTEIRO:",
    "Manhã: Visite o Forte dos Reis Magos e a Ponte Newton Navarro.",
    "Tarde: Curta a Praia de Ponta Negra e o Morro do Careca.",
    "Noite: Jante frutos do mar na orla potiguar.",
    "🍽️ GASTRONOMIA: Prove carne de sol com macaxeira e ginga com tapioca.",
    "🌤️ CLIMA E DICAS: Com 27°C e céu limpo, use protetor solar e roupas leves.",
  ].join("\n"),
  guia_fallback: false,
  atrativos: [
    {
      id: "atrativo-ponta-negra",
      nome: "Praia de Ponta Negra",
      descricao: "Morro do Careca",
      tipo: "atrativo",
      visitado: false,
    },
    {
      id: "gastronomia-ginga",
      nome: "Ginga com tapioca",
      descricao: "Mercado da Redinha",
      tipo: "gastronomia",
      visitado: true,
    },
  ],
  provedores: {
    geocoding: { tempo_ms: 12, fallback: false },
    clima: { tempo_ms: 88, fallback: false },
    rota: { tempo_ms: 150, fallback: false },
    gemini: { tempo_ms: 1200, fallback: false },
  },
};

describe("RoteiroResult", () => {
  it("exibe clima, seções do guia, recolher/expandir e permite marcar atrativo como visitado", async () => {
    const user = userEvent.setup();
    const onAlternarVisita = vi.fn().mockResolvedValue(undefined);
    const onRegerarGuiaStream = vi.fn().mockResolvedValue(undefined);

    render(
      <RoteiroResult
        roteiro={MOCK_ROTEIRO}
        streamingGuia={false}
        guiaStreamTexto={null}
        onRegerarGuiaStream={onRegerarGuiaStream}
        onAlternarVisita={onAlternarVisita}
      />,
    );

    expect(screen.getByText(/27\.1°C · Céu Limpo/i)).toBeInTheDocument();
    expect(screen.getByText(/Identidade e Atmosfera Local/i)).toBeInTheDocument();
    expect(screen.getByText(/Roteiro Sugerido \(1 Dia\)/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Praia de Ponta Negra/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Recolher detalhes do guia/i }));
    expect(screen.queryByText(/Tradições Gastronômicas/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Marcar como visitado/i }));
    expect(onAlternarVisita).toHaveBeenCalledWith("rot-001", "atrativo-ponta-negra", true);

    await user.click(screen.getByRole("button", { name: /Atualizar via Streaming IA/i }));
    expect(onRegerarGuiaStream).toHaveBeenCalledTimes(1);
  });
});
