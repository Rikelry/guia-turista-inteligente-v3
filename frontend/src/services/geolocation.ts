import type { Coordenada, DestinoCatalogo, UfBrasil } from "../types/schemas.ts";

export interface SugestaoDestino extends DestinoCatalogo {
  distanciaKm: number;
}

export const DESTINOS_PADRAO: readonly DestinoCatalogo[] = [
  {
    cidade: "Teresina",
    uf: "PI",
    lat: -5.089,
    lon: -42.802,
    resumo: "Capital do Piauí, entre os rios Poti e Parnaíba.",
  },
  {
    cidade: "Piripiri",
    uf: "PI",
    lat: -4.272,
    lon: -41.777,
    resumo: "Porta de entrada do Parque Nacional de Sete Cidades.",
  },
  {
    cidade: "Parnaíba",
    uf: "PI",
    lat: -2.905,
    lon: -41.776,
    resumo: "Litoral do Piauí e porta do Delta do Parnaíba.",
  },
  {
    cidade: "São Raimundo Nonato",
    uf: "PI",
    lat: -9.015,
    lon: -42.699,
    resumo: "Base para o Parque Nacional Serra da Capivara.",
  },
  {
    cidade: "Juazeiro do Norte",
    uf: "CE",
    lat: -7.213,
    lon: -39.315,
    resumo: "Polo cultural, religioso e artesanal do Cariri cearense.",
  },
  {
    cidade: "Canoa Quebrada",
    uf: "CE",
    lat: -4.524,
    lon: -37.701,
    resumo: "Falésias avermelhadas e praias no litoral leste do Ceará.",
  },
  {
    cidade: "Jijoca de Jericoacoara",
    uf: "CE",
    lat: -2.796,
    lon: -40.512,
    resumo: "Vila de praia entre dunas e lagoas cristalinas.",
  },
  {
    cidade: "Fortaleza",
    uf: "CE",
    lat: -3.717,
    lon: -38.543,
    resumo: "Capital cearense de praias urbanas e cultura nordestina.",
  },
  {
    cidade: "Natal",
    uf: "RN",
    lat: -5.795,
    lon: -35.209,
    resumo: "Capital potiguar de dunas, falésias e praias.",
  },
  {
    cidade: "São Luís",
    uf: "MA",
    lat: -2.53,
    lon: -44.306,
    resumo: "Centro histórico tombado pela UNESCO.",
  },
  {
    cidade: "Barreirinhas",
    uf: "MA",
    lat: -2.757,
    lon: -42.826,
    resumo: "Portão dos Lençóis Maranhenses.",
  },
  {
    cidade: "Recife",
    uf: "PE",
    lat: -8.048,
    lon: -34.877,
    resumo: "Capital pernambucana de pontes, cultura e frevo.",
  },
  {
    cidade: "Salvador",
    uf: "BA",
    lat: -12.977,
    lon: -38.501,
    resumo: "Primeira capital do Brasil, história e gastronomia baiana.",
  },
  {
    cidade: "Ouro Preto",
    uf: "MG",
    lat: -20.385,
    lon: -43.503,
    resumo: "Cidade histórica do ciclo do ouro e arte barroca.",
  },
  {
    cidade: "Rio de Janeiro",
    uf: "RJ",
    lat: -22.907,
    lon: -43.173,
    resumo: "Paisagens icônicas entre serra e mar.",
  },
  {
    cidade: "Gramado",
    uf: "RS",
    lat: -29.379,
    lon: -50.874,
    resumo: "Serra gaúcha de clima europeu e gastronomia.",
  },
  {
    cidade: "Bonito",
    uf: "MS",
    lat: -21.121,
    lon: -56.482,
    resumo: "Ecoturismo de águas cristalinas e grutas.",
  },
];

export const CIDADES_AUTOCOMPLETE: ReadonlyArray<{ cidade: string; uf: UfBrasil }> = [
  ...DESTINOS_PADRAO.map((d) => ({ cidade: d.cidade, uf: d.uf })),
  { cidade: "Ubajara", uf: "CE" },
  { cidade: "Barra Grande", uf: "PI" },
  { cidade: "São Paulo", uf: "SP" },
  { cidade: "Brodowski", uf: "SP" },
  { cidade: "Belo Horizonte", uf: "MG" },
  { cidade: "Curitiba", uf: "PR" },
  { cidade: "Florianópolis", uf: "SC" },
  { cidade: "Brasília", uf: "DF" },
  { cidade: "João Pessoa", uf: "PB" },
  { cidade: "Maceió", uf: "AL" },
  { cidade: "Aracaju", uf: "SE" },
  { cidade: "Belém", uf: "PA" },
  { cidade: "Manaus", uf: "AM" },
  { cidade: "Porto Alegre", uf: "RS" },
  { cidade: "Vitória", uf: "ES" },
  { cidade: "Goiânia", uf: "GO" },
  { cidade: "Campo Grande", uf: "MS" },
  { cidade: "Cuiabá", uf: "MT" },
];

export function calcularHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const raioTerraKm = 6371;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(raioTerraKm * c);
}

export function obterPosicaoAtualNavegador(timeoutMs = 5000): Promise<Coordenada | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: 5 * 60 * 1000,
      },
    );
  });
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function buscarCoordenadaCatalogo(
  cidade: string,
  uf: string,
  catalogo: readonly DestinoCatalogo[],
): Coordenada | null {
  const alvoCidade = normalizarTexto(cidade);
  const alvoUf = uf.trim().toUpperCase();
  const encontrado = catalogo.find(
    (d) => normalizarTexto(d.cidade) === alvoCidade && d.uf === alvoUf,
  );
  return encontrado ? { lat: encontrado.lat, lon: encontrado.lon } : null;
}

export function mesclarCatalogosDestinos(remoto: readonly DestinoCatalogo[]): DestinoCatalogo[] {
  const mapa = new Map<string, DestinoCatalogo>();
  for (const item of DESTINOS_PADRAO) {
    mapa.set(`${normalizarTexto(item.cidade)}-${item.uf}`, item);
  }
  for (const item of remoto) {
    mapa.set(`${normalizarTexto(item.cidade)}-${item.uf}`, item);
  }
  return Array.from(mapa.values());
}

export function sugerirDestinosAcimaDe400Km(
  referencia: Coordenada,
  catalogo: readonly DestinoCatalogo[],
  distanciaMinimaKm = 400,
  limite = 4,
): SugestaoDestino[] {
  const comDistancia: SugestaoDestino[] = catalogo
    .map((dest) => ({
      ...dest,
      distanciaKm: calcularHaversineKm(referencia.lat, referencia.lon, dest.lat, dest.lon),
    }))
    .filter((dest) => dest.distanciaKm >= distanciaMinimaKm)
    .sort((a, b) => a.distanciaKm - b.distanciaKm);

  return comDistancia.slice(0, limite);
}
