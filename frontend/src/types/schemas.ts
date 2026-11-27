export const ESTADOS_BRASIL = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
} as const;

export type UfBrasil = keyof typeof ESTADOS_BRASIL;

export const LISTA_UFS = Object.keys(ESTADOS_BRASIL) as UfBrasil[];

export type TipoUsuario = "google" | "visitante";

export interface UsuarioPerfil {
  user_id: string;
  nome: string;
  tipo: TipoUsuario;
  email: string | null;
  foto: string | null;
  expira_em: string | null;
}

export interface LoginResponse {
  usuario: UsuarioPerfil;
}

export type EstiloViagem = "cultural" | "gastronomico" | "ecoturismo" | "familia" | "romantico";

export type PreferenciaRota = "rapida" | "economica";

export type Propulsao = "combustao" | "eletrico";

export interface VeiculoCombustao {
  propulsao: "combustao";
  consumo_km_l: number;
  tanque_litros: number;
  preco_litro: number;
}

export interface VeiculoEletrico {
  propulsao: "eletrico";
  eficiencia_km_kwh: number;
  bateria_kwh: number;
  preco_kwh: number;
}

export type Veiculo = VeiculoCombustao | VeiculoEletrico;

export interface RoteiroRequest {
  origem_cidade: string;
  origem_uf: UfBrasil;
  destino_cidade: string;
  destino_uf: UfBrasil;
  dias_estadia: number;
  estilo_viagem: EstiloViagem;
  preferencia_rota: PreferenciaRota;
  passageiros: number;
  veiculo: Veiculo;
}

export interface Coordenada {
  lat: number;
  lon: number;
}

export interface MapaRotaRequest {
  origem: Coordenada;
  destino: Coordenada;
  origem_uf: UfBrasil;
  destino_uf: UfBrasil;
  veiculo: Veiculo;
  passageiros: number;
  alternativas: boolean;
}

export interface CustosRequest {
  distancia_km: number;
  origem_uf: UfBrasil;
  destino_uf: UfBrasil;
  veiculo: Veiculo;
  passageiros: number;
  penalizacao_pct: number;
}

export interface ClimaInfo {
  disponivel: boolean;
  temperatura_c: number | null;
  sensacao_c: number | null;
  umidade_pct: number | null;
  vento_kmh: number | null;
  condicao: string;
}

export interface GuiaStreamRequest {
  destino: string;
  dias_estadia: number;
  estilo_viagem: EstiloViagem;
  clima_info: ClimaInfo | null;
  atrativos: string[];
  gastronomia: string[];
}

export interface LocalInfo {
  cidade: string;
  uf: string;
  nome: string;
  lat: number;
  lon: number;
  encontrado: boolean;
}

export interface RotaInfo {
  disponivel: boolean;
  distancia_km: number | null;
  duracao_min: number | null;
  resumo: string;
  geometria: [number, number][];
}

export interface AltimetriaInfo {
  disponivel: boolean;
  ganho_m: number;
  perda_m: number;
  altitude_max_m: number | null;
  altitude_min_m: number | null;
  desnivel_liquido_m: number;
  penalizacao_pct: number;
  perfil: number[];
}

export interface Parada {
  ordem: number;
  tipo: "posto" | "eletroposto";
  km: number;
  lat: number;
  lon: number;
  nivel_chegada_pct: number;
}

export interface AutonomiaInfo {
  autonomia_nominal_km: number;
  autonomia_ajustada_km: number;
  reserva_pct: number;
  paradas: Parada[];
}

export interface CustosInfo {
  propulsao: Propulsao;
  quantidade_energia: number;
  unidade: "litros" | "kWh";
  custo_energia: number;
  custo_pedagio: number;
  custo_total: number;
  passageiros: number;
  por_passageiro: number;
  emissoes_kg_co2: number;
  observacao: string;
}

export interface RotaAlternativa {
  indice: number;
  rotulo: string;
  rota: RotaInfo;
  altimetria: AltimetriaInfo;
  autonomia: AutonomiaInfo;
  custos: CustosInfo;
}

export interface MapaRotaResponse {
  rotas: RotaAlternativa[];
}

export interface AtrativoItem {
  id: string;
  nome: string;
  descricao: string;
  tipo: "atrativo" | "gastronomia";
  visitado: boolean;
}

export interface ProvedorTelemetria {
  tempo_ms: number;
  fallback: boolean;
}

export interface RoteiroResponse {
  id: string;
  criado_em: string;
  origem: LocalInfo;
  destino: LocalInfo;
  dias_estadia: number;
  estilo_viagem: EstiloViagem;
  clima: ClimaInfo;
  rota: RotaInfo;
  guia: string;
  guia_fallback: boolean;
  atrativos: AtrativoItem[];
  provedores: Record<string, ProvedorTelemetria>;
}

export interface DestinoCatalogo {
  cidade: string;
  uf: UfBrasil;
  lat: number;
  lon: number;
  resumo: string;
}

export interface ReadyzResponse {
  status: "pronto" | "indisponivel";
  google_login: boolean;
  gemini: boolean;
  sessoes_ativas: Record<string, number>;
}

export interface CircuitBreakerStatus {
  nome: string;
  estado: "fechado" | "aberto" | "meio_aberto";
  falhas_consecutivas: number;
  ultimo_erro?: string | null;
}

export interface TelemetriaBackend {
  uptime_segundos: number;
  requisicoes_total: number;
  latencia_media_ms: number | null;
  latencia_recente_ms: number | null;
  latencia_p95_ms: number | null;
  conexoes_ativas: number;
  roteiros_gerados: number;
  total_roteiros_salvos: number;
  provedores_ativos: number;
  provedores_total: number;
  circuit_breakers: CircuitBreakerStatus[];
  sessoes_ativas: Record<string, number>;
}

export interface TelemetriaUltimaChamada {
  requestId: string | null;
  serverProcessTimeMs: number | null;
  clientTotalTimeMs: number;
  origemLabel: string;
  destinoLabel: string;
  provedores: Record<string, ProvedorTelemetria>;
  registradoEm: string;
}

export interface CompartilharResponse {
  status: string;
  link_whatsapp: string;
}

export interface FormValidationResult {
  valido: boolean;
  erros: Record<string, string>;
}

export const DEFAULT_VEICULO_COMBUSTAO: VeiculoCombustao = {
  propulsao: "combustao",
  consumo_km_l: 12.0,
  tanque_litros: 50.0,
  preco_litro: 6.2,
};

export const DEFAULT_VEICULO_ELETRICO: VeiculoEletrico = {
  propulsao: "eletrico",
  eficiencia_km_kwh: 6.5,
  bateria_kwh: 60.0,
  preco_kwh: 1.2,
};

export const PERFIS_VIAJANTE: ReadonlyArray<{
  id: EstiloViagem;
  label: string;
  rotuloCurto: string;
  icone: string;
}> = [
  { id: "cultural", label: "Cultural & Histórico", rotuloCurto: "Cultural", icone: "🏛️" },
  { id: "gastronomico", label: "Gastronômico", rotuloCurto: "Gastronômico", icone: "🍲" },
  { id: "ecoturismo", label: "Ecoturismo & Aventura", rotuloCurto: "Ecoturismo", icone: "🌿" },
  { id: "familia", label: "Família", rotuloCurto: "Família", icone: "👨‍👩‍👧‍👦" },
  { id: "romantico", label: "Romântico / Econômico", rotuloCurto: "Econômico", icone: "🎒" },
];

const PADRAO_CIDADE = /^[\p{L}][\p{L}\s.'-]*(?:[\s.'-]+[\p{L}]+)*\.?$/u;

export function sanitizarCidade(valor: string): string {
  const semTags = valor.replace(/<[^>]*>/g, "");
  const semControle = Array.from(semTags)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
  return semControle.replace(/\s+/g, " ").trim();
}

export function validarCidade(valor: string): string | null {
  const limpa = sanitizarCidade(valor);
  if (limpa.length < 2 || limpa.length > 80) {
    return "A cidade deve ter entre 2 e 80 caracteres.";
  }
  if (!PADRAO_CIDADE.test(limpa)) {
    return "Use apenas letras, espaços, hífen e apóstrofo no nome da cidade.";
  }
  return null;
}

export function isUfValida(valor: string): valor is UfBrasil {
  return valor.trim().toUpperCase() in ESTADOS_BRASIL;
}

export function normalizarUf(valor: string): UfBrasil | null {
  const sigla = valor.trim().toUpperCase();
  return isUfValida(sigla) ? sigla : null;
}

export function validarRoteiroForm(input: {
  origem_cidade: string;
  origem_uf: string;
  destino_cidade: string;
  destino_uf: string;
  dias_estadia: number;
  passageiros: number;
  veiculo: Veiculo;
}): FormValidationResult {
  const erros: Record<string, string> = {};

  const errOrigem = validarCidade(input.origem_cidade);
  if (errOrigem) erros.origem_cidade = errOrigem;

  const errDestino = validarCidade(input.destino_cidade);
  if (errDestino) erros.destino_cidade = errDestino;

  const ufO = normalizarUf(input.origem_uf);
  if (!ufO) erros.origem_uf = "Selecione uma UF brasileira válida.";

  const ufD = normalizarUf(input.destino_uf);
  if (!ufD) erros.destino_uf = "Selecione uma UF brasileira válida.";

  if (
    !errOrigem &&
    !errDestino &&
    ufO &&
    ufD &&
    sanitizarCidade(input.origem_cidade).toLowerCase() ===
      sanitizarCidade(input.destino_cidade).toLowerCase() &&
    ufO === ufD
  ) {
    erros.destino_cidade = "Origem e destino precisam ser cidades diferentes.";
  }

  if (!Number.isInteger(input.dias_estadia) || input.dias_estadia < 1 || input.dias_estadia > 5) {
    erros.dias_estadia = "A duração deve ficar entre 1 e 5 dias.";
  }

  if (!Number.isInteger(input.passageiros) || input.passageiros < 1 || input.passageiros > 8) {
    erros.passageiros = "Informe entre 1 e 8 passageiros.";
  }

  if (input.veiculo.propulsao === "combustao") {
    if (!(input.veiculo.consumo_km_l > 0 && input.veiculo.consumo_km_l <= 50)) {
      erros.consumo_km_l = "Consumo deve estar entre 0,1 e 50 km/l.";
    }
    if (!(input.veiculo.tanque_litros > 0 && input.veiculo.tanque_litros <= 200)) {
      erros.tanque_litros = "Tanque deve estar entre 1 e 200 litros.";
    }
    if (!(input.veiculo.preco_litro > 0 && input.veiculo.preco_litro <= 20)) {
      erros.preco_litro = "Preço por litro deve estar entre R$ 0,01 e R$ 20,00.";
    }
  } else {
    if (!(input.veiculo.eficiencia_km_kwh > 0 && input.veiculo.eficiencia_km_kwh <= 15)) {
      erros.eficiencia_km_kwh = "Eficiência deve estar entre 0,1 e 15 km/kWh.";
    }
    if (!(input.veiculo.bateria_kwh > 0 && input.veiculo.bateria_kwh <= 250)) {
      erros.bateria_kwh = "Bateria deve estar entre 1 e 250 kWh.";
    }
    if (!(input.veiculo.preco_kwh >= 0 && input.veiculo.preco_kwh <= 10)) {
      erros.preco_kwh = "Preço por kWh deve estar entre R$ 0,00 e R$ 10,00.";
    }
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

export function isUsuarioPerfil(data: unknown): data is UsuarioPerfil {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.user_id === "string" &&
    obj.user_id.length > 0 &&
    typeof obj.nome === "string" &&
    (obj.tipo === "google" || obj.tipo === "visitante")
  );
}

export function isRoteiroResponse(data: unknown): data is RoteiroResponse {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.guia === "string" &&
    typeof obj.origem === "object" &&
    obj.origem !== null &&
    typeof obj.destino === "object" &&
    obj.destino !== null
  );
}

export function formatarDuracao(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined || !Number.isFinite(minutos) || minutos <= 0) {
    return "—";
  }
  const totalMin = Math.round(minutos);
  const horas = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (horas === 0) return `${mins}min`;
  return `${horas}h ${mins}min`;
}

export function formatarMoedaBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function mascararUserId(userId: string): string {
  if (userId.length <= 8) return userId;
  return `${userId.slice(0, 4)}…${userId.slice(-4)}`;
}

export function labelEstiloViagem(estilo: EstiloViagem): { label: string; icone: string } {
  const encontrado = PERFIS_VIAJANTE.find((p) => p.id === estilo);
  return encontrado
    ? { label: encontrado.label, icone: encontrado.icone }
    : { label: "Cultural & Histórico", icone: "🏛️" };
}
