import { describe, expect, it } from "vite-plus/test";
import type { PostoCombustivel } from "../types/schemas.ts";
import { criarPopupPosto } from "./MapaRota.tsx";

const MOCK_POSTO: PostoCombustivel = {
    cnpj: "12345678000190",
    razao_social: "Posto Exemplo LTDA",
    nome_fantasia: "Posto Central",
    bandeira: "Bandeira Exemplo",
    endereco: "Avenida Principal, 100",
    municipio: "Teresina",
    uf: "PI",
    lat: -5.09,
    lon: -42.8,
    status_sigaf: "Ativo",
    validacao_geografica: "Validado",
    data_publicacao: "2025-01-15",
    combustiveis: ["Gasolina Comum", "Etanol", "Diesel"],
    distancia_rota_km: 2.35,
    avaliacao: null,
};

describe("criarPopupPosto", () => {
    it("exibe os dados cadastrais e regulatórios do posto", () => {
        const popup = criarPopupPosto(MOCK_POSTO);
        const texto = popup.textContent ?? "";

        expect(texto).toContain("Posto Central");
        expect(texto).toContain("Posto Exemplo LTDA");
        expect(texto).toContain("12345678000190");
        expect(texto).toContain("Bandeira Exemplo");
        expect(texto).toContain("Teresina - PI");
        expect(texto).toContain("Ativo");
        expect(texto).toContain("Validado");
        expect(texto).toContain("Gasolina Comum, Etanol, Diesel");
        expect(texto).toContain("2.35 km");
        expect(texto).toContain("Não informada");
    });

    it("trata dados externos como texto, sem interpretar HTML", () => {
        const posto = {
            ...MOCK_POSTO,
            nome_fantasia: '<img src="x" onerror="alert(1)">',
        };

        const popup = criarPopupPosto(posto);

        expect(popup.querySelector("img")).toBeNull();
        expect(popup.textContent).toContain('<img src="x" onerror="alert(1)">');
    });
    it("usa a razão social quando não há nome fantasia", () => {
        const posto = {
            ...MOCK_POSTO,
            nome_fantasia: null,
        };

        const popup = criarPopupPosto(posto);
        const texto = popup.textContent ?? "";

        expect(texto).toContain("Posto: Posto Exemplo LTDA");
        expect(texto).not.toContain("Razão social:");
    });
});
