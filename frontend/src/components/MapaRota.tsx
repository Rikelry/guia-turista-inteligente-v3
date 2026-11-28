import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  DEFAULT_VEICULO_COMBUSTAO,
  DEFAULT_VEICULO_ELETRICO,
  formatarDuracao,
  formatarMoedaBRL,
  type PostoCombustivel,
  type MapaRotaResponse,
  type Propulsao,
  type RotaAlternativa,
  type RoteiroResponse,
  type Veiculo,
} from "../types/schemas.ts";

export interface MapaRotaProps {
  roteiro: RoteiroResponse;
  mapaRota: MapaRotaResponse | null;
  rotaSelecionadaIdx: number;
  carregandoMapa: boolean;
  veiculoAtual: Veiculo;
  passageiros: number;
  onSelecionarRota: (index: number) => void;
  onAlterarVeiculo: (veiculo: Veiculo) => Promise<void>;
  onAlterarPassageiros: (qtd: number) => Promise<void>;
}

function criarIconeMarcador(cor: string, texto: string): L.DivIcon {
  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `<div class="map-pin-badge" style="--pin-color:${cor}">${texto}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export function criarPopupPosto(posto: PostoCombustivel): HTMLElement {
  const container = document.createElement("div");

  const adicionarCampo = (rotulo: string, valor: string | null | undefined): void => {
    if (!valor) return;

    const linha = document.createElement("p");
    const titulo = document.createElement("strong");

    titulo.textContent = `${rotulo}: `;
    linha.append(titulo, document.createTextNode(valor));
    container.append(linha);
  };

  adicionarCampo("Posto", posto.nome_fantasia || posto.razao_social);

  if (posto.nome_fantasia) {
    adicionarCampo("Razão social", posto.razao_social);
  }
  adicionarCampo("CNPJ", posto.cnpj);
  adicionarCampo("Bandeira", posto.bandeira);
  adicionarCampo("Endereço", posto.endereco);
  adicionarCampo(
    "Localização",
    [posto.municipio, posto.uf].filter(Boolean).join(" - "),
  );
  adicionarCampo("Status SIGAF", posto.status_sigaf);
  adicionarCampo("Validação geográfica", posto.validacao_geografica);
  adicionarCampo(
    "Autorização publicada",
    posto.data_publicacao
      ? new Date(`${posto.data_publicacao}T00:00:00`).toLocaleDateString("pt-BR")
      : null,
  );
  adicionarCampo(
    "Combustíveis",
    posto.combustiveis.length > 0
      ? posto.combustiveis.join(", ")
      : "Não informados",
  );
  adicionarCampo("Distância da rota", `${posto.distancia_rota_km.toFixed(2)} km`);
  adicionarCampo(
    "Avaliação",
    posto.avaliacao !== null ? `${posto.avaliacao.toFixed(1)}/5` : "Não informada",
  );

  return container;
}

function classificarTerreno(penalizacaoPct: number): {
  rotulo: string;
  descricao: string;
} {
  if (penalizacaoPct >= 8) {
    return {
      rotulo: `Serra / Aclive Forte (+${penalizacaoPct.toFixed(1)}%)`,
      descricao: `Trecho montanhoso com forte ganho altimétrico. Acréscimo estimado de +${penalizacaoPct.toFixed(1)}% no consumo nominal.`,
    };
  }
  if (penalizacaoPct > 2) {
    return {
      rotulo: `Terreno Ondulado (+${penalizacaoPct.toFixed(1)}%)`,
      descricao: `Terreno ondulado com relevo dinâmico. Acréscimo de consumo de +${penalizacaoPct.toFixed(1)}% devido a retomadas de aceleração.`,
    };
  }
  if (penalizacaoPct < -1) {
    return {
      rotulo: `Descida Favorável (${penalizacaoPct.toFixed(1)}%)`,
      descricao: `Predomínio de descidas ao longo do trajeto, reduzindo o consumo estimado em ${Math.abs(penalizacaoPct).toFixed(1)}%.`,
    };
  }
  return {
    rotulo: `Terreno Plano (${penalizacaoPct >= 0 ? "+" : ""}${penalizacaoPct.toFixed(1)}%)`,
    descricao: "Relevo predominantemente plano com impacto mínimo sobre o consumo nominal.",
  };
}

function montarSvgPerfil(perfil: readonly number[]): {
  polylinePoints: string;
  areaPath: string;
} {
  if (perfil.length < 2) {
    return { polylinePoints: "", areaPath: "" };
  }
  const width = 600;
  const height = 110;
  const padX = 12;
  const padY = 14;
  const minVal = Math.min(...perfil);
  const maxVal = Math.max(...perfil);
  const span = Math.max(1, maxVal - minVal);

  const coords = perfil.map((val, idx) => {
    const x = padX + (idx / (perfil.length - 1)) * (width - padX * 2);
    const y = height - padY - ((val - minVal) / span) * (height - padY * 2);
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });

  const polylinePoints = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const first = coords[0];
  const last = coords[coords.length - 1];
  const areaPath =
    first && last
      ? `M ${first.x} ${height - padY} L ${coords.map((p) => `${p.x} ${p.y}`).join(" L ")} L ${last.x} ${height - padY} Z`
      : "";

  return { polylinePoints, areaPath };
}

export function MapaRota({
  roteiro,
  mapaRota,
  rotaSelecionadaIdx,
  carregandoMapa,
  veiculoAtual,
  passageiros,
  onSelecionarRota,
  onAlterarVeiculo,
  onAlterarPassageiros,
}: MapaRotaProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [relevoAberto, setRelevoAberto] = useState(true);
  const [rateioAberto, setRateioAberto] = useState(false);

  const rotas = mapaRota?.rotas ?? [];
  const rotaAtiva: RotaAlternativa | undefined = rotas[rotaSelecionadaIdx] ?? rotas[0];

  const geometriaAtiva = useMemo<[number, number][]>(() => {
    if (rotaAtiva?.rota.geometria && rotaAtiva.rota.geometria.length > 0) {
      return rotaAtiva.rota.geometria;
    }
    return roteiro.rota.geometria;
  }, [rotaAtiva, roteiro.rota.geometria]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (!mapInstanceRef.current) {
      try {
        const map = L.map(container, {
          center: [roteiro.origem.lat || -5.09, roteiro.origem.lon || -42.8],
          zoom: 6,
          scrollWheelZoom: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map);

        mapInstanceRef.current = map;
        layerGroupRef.current = L.layerGroup().addTo(map);
      } catch {
        // Ambiente sem canvas/DOM completo (ex.: JSDOM).
        return;
      }
    }

    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // Desenha rotas alternativas não selecionadas em cinza translúcido
    rotas.forEach((alt, idx) => {
      if (idx === rotaSelecionadaIdx || alt.rota.geometria.length < 2) return;
      L.polyline(alt.rota.geometria, {
        color: "#94a3b8",
        weight: 4,
        opacity: 0.65,
        dashArray: "6 8",
      }).addTo(group);
    });

    const boundsCoords: [number, number][] = [];

    if (geometriaAtiva.length >= 2) {
      L.polyline(geometriaAtiva, {
        color: "#2563eb",
        weight: 5,
        opacity: 0.92,
      }).addTo(group);
      boundsCoords.push(...geometriaAtiva);
    }

    if (roteiro.origem.lat !== 0 || roteiro.origem.lon !== 0) {
      const coord: [number, number] = [roteiro.origem.lat, roteiro.origem.lon];
      L.marker(coord, { icon: criarIconeMarcador("#16a34a", "O") })
        .bindPopup(`<strong>Origem:</strong> ${roteiro.origem.nome}`)
        .addTo(group);
      boundsCoords.push(coord);
    }

    if (roteiro.destino.lat !== 0 || roteiro.destino.lon !== 0) {
      const coord: [number, number] = [roteiro.destino.lat, roteiro.destino.lon];
      L.marker(coord, { icon: criarIconeMarcador("#dc2626", "🏁") })
        .bindPopup(`<strong>Destino:</strong> ${roteiro.destino.nome}`)
        .addTo(group);
      boundsCoords.push(coord);
    }

    if (rotaAtiva?.autonomia.paradas) {
      for (const parada of rotaAtiva.autonomia.paradas) {
        const coord: [number, number] = [parada.lat, parada.lon];
        const tipoLabel = parada.tipo === "eletroposto" ? "Eletroposto" : "Posto de Combustível";
        L.marker(coord, { icon: criarIconeMarcador("#ea580c", String(parada.ordem)) })
          .bindPopup(
            `<strong>Parada #${parada.ordem} (${tipoLabel})</strong><br/>Km ${parada.km.toFixed(1)} · Reserva ao chegar: ${parada.nivel_chegada_pct.toFixed(0)}%`,
          )
          .addTo(group);
        boundsCoords.push(coord);
      }
    }

    if (rotaAtiva?.postos) {
      for (const posto of rotaAtiva.postos) {
        const coord: [number, number] = [posto.lat, posto.lon];

        L.marker(coord, {
          icon: criarIconeMarcador("#0f766e", "P"),
        })
          .bindPopup(criarPopupPosto(posto))
          .addTo(group);

        boundsCoords.push(coord);
      }
    }

    if (boundsCoords.length >= 2) {
      map.fitBounds(L.latLngBounds(boundsCoords), { padding: [36, 36] });
    } else if (boundsCoords[0]) {
      map.setView(boundsCoords[0], 9);
    }

    window.setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [geometriaAtiva, rotaAtiva, rotaSelecionadaIdx, rotas, roteiro.destino, roteiro.origem]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  const trocarPropulsao = (novaPropulsao: Propulsao): void => {
    if (veiculoAtual.propulsao === novaPropulsao) return;
    const novoVeiculo =
      novaPropulsao === "eletrico" ? DEFAULT_VEICULO_ELETRICO : DEFAULT_VEICULO_COMBUSTAO;
    void onAlterarVeiculo(novoVeiculo);
  };

  const distanciaKm = rotaAtiva?.rota.distancia_km ?? roteiro.rota.distancia_km;
  const duracaoMin = rotaAtiva?.rota.duracao_min ?? roteiro.rota.duracao_min;
  const paradasCount = rotaAtiva?.autonomia.paradas.length ?? 0;
  const autonomiaKm = rotaAtiva?.autonomia.autonomia_ajustada_km ?? null;
  const altimetria = rotaAtiva?.altimetria;
  const custos = rotaAtiva?.custos;

  const terreno = classificarTerreno(altimetria?.penalizacao_pct ?? 0);
  const svgPerfil = useMemo(() => montarSvgPerfil(altimetria?.perfil ?? []), [altimetria?.perfil]);

  const consumoNominalTexto =
    veiculoAtual.propulsao === "eletrico"
      ? `${veiculoAtual.eficiencia_km_kwh.toFixed(1)} km/kWh`
      : `${veiculoAtual.consumo_km_l.toFixed(1)} km/l`;

  const rendimentoRealValor =
    veiculoAtual.propulsao === "eletrico"
      ? veiculoAtual.eficiencia_km_kwh / (1 + (altimetria?.penalizacao_pct ?? 0) / 100)
      : veiculoAtual.consumo_km_l / (1 + (altimetria?.penalizacao_pct ?? 0) / 100);

  const rendimentoRealTexto =
    veiculoAtual.propulsao === "eletrico"
      ? `${rendimentoRealValor.toFixed(1)} km/kWh`
      : `${rendimentoRealValor.toFixed(1)} km/l`;

  return (
    <section className="card map-route-card" aria-labelledby="map-route-heading">
      <div className="section-head">
        <h2 id="map-route-heading" className="section-title">
          <span aria-hidden="true">🗺️</span> Mapa da Rota &amp; Paradas
        </h2>
        <p className="section-subtitle">Traçado rodoviário e paradas calculadas por autonomia.</p>
      </div>

      <div className="map-toolbar">
        <div className="segmented-control" role="group" aria-label="Alternar propulsão no mapa">
          <button
            type="button"
            className={`seg-btn ${veiculoAtual.propulsao === "combustao" ? "is-active" : ""}`}
            onClick={() => trocarPropulsao("combustao")}
            disabled={carregandoMapa}
          >
            ⛽ Combustão
          </button>
          <button
            type="button"
            className={`seg-btn ${veiculoAtual.propulsao === "eletrico" ? "is-active" : ""}`}
            onClick={() => trocarPropulsao("eletrico")}
            disabled={carregandoMapa}
          >
            ⚡ Elétrico (EV)
          </button>
        </div>

        {rotas.length > 0 && (
          <div className="segmented-control" role="tablist" aria-label="Sugestões de rota">
            {rotas.map((alt, idx) => (
              <button
                key={alt.indice}
                type="button"
                role="tab"
                aria-selected={idx === rotaSelecionadaIdx}
                className={`seg-btn ${idx === rotaSelecionadaIdx ? "is-active" : ""}`}
                onClick={() => onSelecionarRota(idx)}
              >
                {idx === 0 ? "⚡" : "🛣️"} Sugestão {String(idx + 1).padStart(2, "0")}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="route-metrics-grid">
        <div className="route-metric-box">
          <span className="route-metric-icon" aria-hidden="true">
            📏
          </span>
          <span className="route-metric-label">DISTÂNCIA</span>
          <strong className="route-metric-value">
            {distanciaKm !== null ? `${distanciaKm.toFixed(1)} km` : "—"}
          </strong>
        </div>

        <div className="route-metric-box">
          <span className="route-metric-icon" aria-hidden="true">
            ⏱️
          </span>
          <span className="route-metric-label">DURAÇÃO</span>
          <strong className="route-metric-value">{formatarDuracao(duracaoMin)}</strong>
        </div>

        <div className="route-metric-box">
          <span className="route-metric-icon" aria-hidden="true">
            🛑
          </span>
          <span className="route-metric-label">PARADAS</span>
          <strong className="route-metric-value">
            {paradasCount} {paradasCount === 1 ? "parada" : "paradas"}
          </strong>
        </div>

        <div className="route-metric-box">
          <span className="route-metric-icon" aria-hidden="true">
            🔋
          </span>
          <span className="route-metric-label">AUTONOMIA</span>
          <strong className="route-metric-value">
            {autonomiaKm !== null ? `~${Math.round(autonomiaKm)} km` : "—"}
          </strong>
        </div>

        <div className="route-metric-box">
          <span className="route-metric-icon" aria-hidden="true">
            ⚡
          </span>
          <span className="route-metric-label">SUGESTÃO DE ROTA</span>
          <strong className="route-metric-value route-metric-value-sm">
            {rotaAtiva ? `Sugestão ${String(rotaAtiva.indice + 1).padStart(2, "0")}` : "Principal"}
          </strong>
        </div>

        <div className="route-metric-box">
          <span className="route-metric-icon" aria-hidden="true">
            ⛰️
          </span>
          <span className="route-metric-label">TOPOGRAFIA</span>
          <strong className="route-metric-value route-metric-value-sm">
            {altimetria?.disponivel
              ? `+${Math.round(altimetria.ganho_m)}m / -${Math.round(altimetria.perda_m)}m`
              : "Sem relevo"}
          </strong>
        </div>
      </div>

      {rotas.length > 0 && (
        <div className="route-alternatives-panel">
          <div className="route-alternatives-head">
            <strong>
              🛣️ Sugestões de Trajeto Rodoviário ({rotas.length}{" "}
              {rotas.length === 1 ? "opção disponível" : "opções disponíveis"})
            </strong>
            {rotaAtiva && (
              <p>
                {rotaAtiva.rotulo} selecionada (
                {rotaAtiva.rota.distancia_km !== null
                  ? `${rotaAtiva.rota.distancia_km.toFixed(1)} km`
                  : "—"}
                , {formatarDuracao(rotaAtiva.rota.duracao_min)}).
              </p>
            )}
          </div>

          <div className="route-alternatives-list">
            {rotas.map((alt, idx) => {
              const selecionada = idx === rotaSelecionadaIdx;
              return (
                <button
                  key={alt.indice}
                  type="button"
                  className={`route-alt-card ${selecionada ? "is-selected" : ""}`}
                  onClick={() => onSelecionarRota(idx)}
                >
                  <div className="route-alt-main">
                    <span className="route-alt-name">
                      {idx === 0 ? "⚡" : "🛣️"} {alt.rotulo}
                    </span>
                    <span className="route-alt-stats">
                      {alt.rota.distancia_km?.toFixed(1) ?? "—"} km ·{" "}
                      {formatarDuracao(alt.rota.duracao_min)}
                      {alt.altimetria.disponivel && ` · ⛰️ +${Math.round(alt.altimetria.ganho_m)}m`}
                    </span>
                  </div>
                  {selecionada && <span className="route-alt-badge">✓ Em exibição</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="leaflet-wrapper">
        {carregandoMapa && (
          <div className="map-loading-overlay" role="status">
            <span className="spinner-inline" aria-hidden="true" />
            <span>Calculando rotas OSRM, relevo e paradas...</span>
          </div>
        )}
        <div
          ref={mapContainerRef}
          className="leaflet-map-canvas"
          aria-label={`Mapa da rota entre ${roteiro.origem.nome} e ${roteiro.destino.nome}`}
        />
        <div className="map-legend-box" aria-label="Legenda do mapa">
          <span>
            <i className="legend-dot dot-origin" /> Origem
          </span>
          <span>
            <i className="legend-dot dot-dest" /> Destino
          </span>
          <span>
            <i className="legend-dot dot-route" /> Rota
          </span>
          <span>
            <i className="legend-dot dot-stop" /> Parada
          </span>
          <span>
            <i className="legend-dot dot-station" /> Posto ANP
          </span>
        </div>
      </div>

      {rotaAtiva && rotaAtiva.autonomia.paradas.length > 0 && (
        <div className="stops-summary-strip">
          <strong>
            {veiculoAtual.propulsao === "eletrico"
              ? "⚡ Paradas de Recarga Recomendadas"
              : "⛽ Paradas de Abastecimento Recomendadas"}{" "}
            (reserva de segurança {rotaAtiva.autonomia.reserva_pct}%):
          </strong>
          <div className="stops-pills">
            {rotaAtiva.autonomia.paradas.map((parada) => (
              <span key={parada.ordem} className="stop-pill">
                #{parada.ordem} · Km {parada.km.toFixed(0)} · Chegada com{" "}
                {parada.nivel_chegada_pct.toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {altimetria && (
        <div className="accordion-card elevation-card">
          <button
            type="button"
            className="accordion-trigger"
            onClick={() => setRelevoAberto((prev) => !prev)}
            aria-expanded={relevoAberto}
          >
            <span className="accordion-title-group">
              <span>📈 Topografia &amp; Relevo da Rota</span>
              {altimetria.disponivel && <span className="terrain-pill">{terreno.rotulo}</span>}
            </span>
            <span className="accordion-caret">
              {relevoAberto ? "Ocultar perfil ▴" : "Ver perfil ▾"}
            </span>
          </button>

          {relevoAberto && (
            <div className="elevation-body">
              {altimetria.disponivel ? (
                <>
                  <div className="elevation-consumption-row">
                    <span>
                      Consumo nominal: <strong>{consumoNominalTexto}</strong>
                    </span>
                    <span className="real-efficiency-badge">
                      Rendimento Real: <strong>{rendimentoRealTexto}</strong>
                    </span>
                  </div>

                  <div className="elevation-stats-line">
                    <span>
                      Subidas acumuladas: <strong>+{Math.round(altimetria.ganho_m)}m</strong>
                    </span>
                    <span>
                      Descidas acumuladas: <strong>-{Math.round(altimetria.perda_m)}m</strong>
                    </span>
                    <span>
                      Desnível líquido:{" "}
                      <strong>
                        {altimetria.desnivel_liquido_m >= 0 ? "+" : ""}
                        {Math.round(altimetria.desnivel_liquido_m)}m
                      </strong>
                    </span>
                  </div>

                  <p className="elevation-desc">{terreno.descricao}</p>

                  {altimetria.perfil.length >= 2 && (
                    <div className="elevation-chart-box">
                      <div className="elevation-chart-header">
                        <span className="cota-badge cota-min">
                          Cota Mín: {Math.round(altimetria.altitude_min_m ?? 0)}m
                        </span>
                        <span className="chart-caption">📈 Perfil Topográfico de Elevação</span>
                        <span className="cota-badge cota-max">
                          Cota Máx: {Math.round(altimetria.altitude_max_m ?? 0)}m
                        </span>
                      </div>
                      <svg
                        viewBox="0 0 600 110"
                        className="elevation-svg"
                        role="img"
                        aria-label="Gráfico de perfil topográfico de elevação ao longo da rota"
                      >
                        <defs>
                          <linearGradient id="elevationGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>
                        <path d={svgPerfil.areaPath} fill="url(#elevationGrad)" />
                        <polyline
                          points={svgPerfil.polylinePoints}
                          fill="none"
                          stroke="#0284c7"
                          strokeWidth="2.5"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  )}
                </>
              ) : (
                <p className="elevation-desc">
                  Perfil altimétrico indisponível para este trajeto no momento (Open-Elevation em
                  contingência).
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {custos && (
        <div className="costs-section">
          <div className="costs-summary-card">
            <div className="costs-total-col">
              <span className="costs-overline">
                CUSTO TOTAL PREVISTO (
                {custos.propulsao === "eletrico" ? "ELÉTRICO EV" : "COMBUSTÃO"})
              </span>
              <strong className="costs-total-value">{formatarMoedaBRL(custos.custo_total)}</strong>
            </div>

            <div className="costs-pills-col">
              <span className="cost-detail-pill">
                {custos.propulsao === "eletrico" ? "⚡ Energia:" : "⛽ Combustível:"}{" "}
                <strong>{formatarMoedaBRL(custos.custo_energia)}</strong> (
                {custos.quantidade_energia.toFixed(1)} {custos.unidade})
              </span>
              <span className="cost-detail-pill">
                🛣️ Pedágios: <strong>{formatarMoedaBRL(custos.custo_pedagio)}</strong>
              </span>
              <span className="cost-detail-pill">
                🌱 CO₂: <strong>{custos.emissoes_kg_co2.toFixed(1)} kg</strong>
              </span>
            </div>
          </div>

          <div className="accordion-card split-card">
            <button
              type="button"
              className="accordion-trigger"
              onClick={() => setRateioAberto((prev) => !prev)}
              aria-expanded={rateioAberto}
            >
              <span className="accordion-title-group">
                <span>👥 Divisão de Custos entre Passageiros</span>
                <span className="split-pill">
                  {passageiros} {passageiros === 1 ? "pessoa" : "pessoas"} ·{" "}
                  {formatarMoedaBRL(custos.por_passageiro)}/pessoa
                </span>
              </span>
              <span className="accordion-caret">{rateioAberto ? "Fechar ▴" : "Ajustar ▾"}</span>
            </button>

            {rateioAberto && (
              <div className="split-body">
                <p className="split-hint">
                  Selecione o número de viajantes (1 a 8) para recalcular a cota individual:
                </p>
                <div
                  className="passengers-selector"
                  role="group"
                  aria-label="Número de passageiros"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`passenger-btn ${passageiros === n ? "is-active" : ""}`}
                      onClick={() => void onAlterarPassageiros(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="split-observation">{custos.observacao}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
