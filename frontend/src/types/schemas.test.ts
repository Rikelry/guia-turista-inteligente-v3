import { describe, expect, it } from "vite-plus/test";
import {
  calcularHaversineKm,
  DESTINOS_PADRAO,
  sugerirDestinosAcimaDe400Km,
} from "../services/geolocation.ts";
import {
  DEFAULT_VEICULO_COMBUSTAO,
  DEFAULT_VEICULO_ELETRICO,
  formatarDuracao,
  normalizarUf,
  sanitizarCidade,
  validarRoteiroForm,
} from "./schemas.ts";

describe("schemas e validação defensiva", () => {
  it("sanitiza tags HTML e espaços excedentes no nome da cidade", () => {
    expect(sanitizarCidade("  <b>São   Luís</b>  ")).toBe("São Luís");
  });

  it("valida UFs brasileiras corretamente", () => {
    expect(normalizarUf("pi")).toBe("PI");
    expect(normalizarUf("RN")).toBe("RN");
    expect(normalizarUf("XX")).toBeNull();
  });

  it("rejeita origem e destino idênticos no formulário", () => {
    const res = validarRoteiroForm({
      origem_cidade: "Piripiri",
      origem_uf: "PI",
      destino_cidade: "Piripiri",
      destino_uf: "PI",
      dias_estadia: 2,
      passageiros: 2,
      veiculo: DEFAULT_VEICULO_COMBUSTAO,
    });
    expect(res.valido).toBe(false);
    expect(res.erros.destino_cidade).toContain("diferentes");
  });

  it("aceita configuração válida para veículo 100% elétrico", () => {
    const res = validarRoteiroForm({
      origem_cidade: "Piripiri",
      origem_uf: "PI",
      destino_cidade: "Natal",
      destino_uf: "RN",
      dias_estadia: 3,
      passageiros: 4,
      veiculo: DEFAULT_VEICULO_ELETRICO,
    });
    expect(res.valido).toBe(true);
    expect(res.erros).toEqual({});
  });

  it("formata durações em horas e minutos", () => {
    expect(formatarDuracao(862)).toBe("14h 22min");
    expect(formatarDuracao(45)).toBe("45min");
    expect(formatarDuracao(null)).toBe("—");
  });
});

describe("geolocalização e Haversine", () => {
  it("calcula distância geodésica aproximada entre Piripiri e Natal", () => {
    const dist = calcularHaversineKm(-4.272, -41.777, -5.795, -35.209);
    expect(dist).toBeGreaterThan(700);
    expect(dist).toBeLessThan(780);
  });

  it("sugere até 4 destinos acima de 400 km ordenados por proximidade", () => {
    const sugestoes = sugerirDestinosAcimaDe400Km(
      { lat: -4.272, lon: -41.777 },
      DESTINOS_PADRAO,
      400,
      4,
    );
    expect(sugestoes).toHaveLength(4);
    for (let i = 0; i < sugestoes.length; i += 1) {
      const atual = sugestoes[i];
      expect(atual?.distanciaKm).toBeGreaterThanOrEqual(400);
      if (i > 0) {
        const anterior = sugestoes[i - 1];
        expect(atual!.distanciaKm).toBeGreaterThanOrEqual(anterior!.distanciaKm);
      }
    }
  });
});
