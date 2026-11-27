import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import type { RoteiroResponse } from "../types/schemas.ts";
import { HistoricoViagens } from "./HistoricoViagens.tsx";

const VIAGEM_SAMPLE: RoteiroResponse = {
  id: "v-1",
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
    cidade: "Fortaleza",
    uf: "CE",
    nome: "Fortaleza - CE",
    lat: -3.717,
    lon: -38.543,
    encontrado: true,
  },
  dias_estadia: 2,
  estilo_viagem: "cultural",
  clima: {
    disponivel: true,
    temperatura_c: 28.2,
    sensacao_c: 30.0,
    umidade_pct: 70,
    vento_kmh: 22,
    condicao: "Parcialmente Nublado",
  },
  rota: {
    disponivel: true,
    distancia_km: 430.5,
    duracao_min: 384,
    resumo: "430.5 km em 6h 24min",
    geometria: [],
  },
  guia: "Guia",
  guia_fallback: false,
  atrativos: [],
  provedores: {},
};

describe("HistoricoViagens", () => {
  it("renderiza estado vazio quando não há viagens", () => {
    render(
      <HistoricoViagens
        viagens={[]}
        roteiroAtualId={null}
        onSelecionar={vi.fn()}
        onExcluir={vi.fn()}
      />,
    );
    expect(screen.getByText(/Nenhuma viagem salva ainda/i)).toBeInTheDocument();
  });

  it("seleciona e exclui viagens sem propagação indevida de clique", async () => {
    const user = userEvent.setup();
    const onSelecionar = vi.fn();
    const onExcluir = vi.fn();

    render(
      <HistoricoViagens
        viagens={[VIAGEM_SAMPLE]}
        roteiroAtualId={null}
        onSelecionar={onSelecionar}
        onExcluir={onExcluir}
      />,
    );

    await user.click(screen.getByText(/Piripiri - PI → Fortaleza - CE/i));
    expect(onSelecionar).toHaveBeenCalledWith(VIAGEM_SAMPLE);

    await user.click(
      screen.getByRole("button", { name: /Excluir viagem Piripiri para Fortaleza/i }),
    );
    expect(onExcluir).toHaveBeenCalledWith("v-1");
    expect(onSelecionar).toHaveBeenCalledTimes(1);
  });
});
