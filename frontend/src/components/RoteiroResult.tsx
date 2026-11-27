import { useMemo, useState } from "react";
import { labelEstiloViagem, type AtrativoItem, type RoteiroResponse } from "../types/schemas.ts";

export interface RoteiroResultProps {
  roteiro: RoteiroResponse;
  streamingGuia: boolean;
  guiaStreamTexto: string | null;
  onRegerarGuiaStream: () => Promise<void>;
  onAlternarVisita: (roteiroId: string, atrativoId: string, visitado: boolean) => Promise<void>;
}

interface SecaoGuia {
  titulo: string;
  linhas: string[];
  isTurnos: boolean;
}

function iconeClima(condicao: string): string {
  const texto = condicao.toLowerCase();
  if (texto.includes("chuva") || texto.includes("tempest") || texto.includes("garoa")) return "🌧️";
  if (texto.includes("nublado") || texto.includes("encoberto")) return "⛅";
  if (texto.includes("neblina") || texto.includes("névoa")) return "🌫️";
  return "☀️";
}

function parsearGuiaEmSecoes(texto: string, diasEstadia: number): SecaoGuia[] {
  const linhasBrutas = texto
    .split("\n")
    .map((ln) => ln.trim())
    .filter(Boolean);

  const secoes: SecaoGuia[] = [];
  let atual: SecaoGuia | null = null;

  const mapearCabecalho = (
    linha: string,
  ): { titulo: string; resto: string; isTurnos: boolean } | null => {
    const matchIdent = /^(?:📍\s*)?IDENTIDADE\s*:\s*(.*)$/i.exec(linha);
    if (matchIdent) {
      return {
        titulo: "Identidade e Atmosfera Local",
        resto: matchIdent[1]?.trim() ?? "",
        isTurnos: false,
      };
    }
    const matchRot = /^(?:🗓️?\s*)?ROTEIRO(?:\s+SUGERIDO.*?)?\s*:\s*(.*)$/i.exec(linha);
    if (matchRot) {
      return {
        titulo: `Roteiro Sugerido (${diasEstadia} ${diasEstadia === 1 ? "Dia" : "Dias"})`,
        resto: matchRot[1]?.trim() ?? "",
        isTurnos: true,
      };
    }
    const matchGast = /^(?:🍽️?\s*)?GASTRONOMIA\s*:\s*(.*)$/i.exec(linha);
    if (matchGast) {
      return {
        titulo: "Tradições Gastronômicas",
        resto: matchGast[1]?.trim() ?? "",
        isTurnos: false,
      };
    }
    const matchClima = /^(?:🌤️?\s*)?CLIMA(?:\s+E\s+DICAS)?\s*:\s*(.*)$/i.exec(linha);
    if (matchClima) {
      return {
        titulo: "Orientações Práticas e Clima",
        resto: matchClima[1]?.trim() ?? "",
        isTurnos: false,
      };
    }
    return null;
  };

  for (const linha of linhasBrutas) {
    const cabecalho = mapearCabecalho(linha);
    if (cabecalho) {
      atual = {
        titulo: cabecalho.titulo,
        linhas: cabecalho.resto ? [cabecalho.resto] : [],
        isTurnos: cabecalho.isTurnos,
      };
      secoes.push(atual);
    } else if (atual) {
      atual.linhas.push(linha);
    } else {
      atual = {
        titulo: "Identidade e Atmosfera Local",
        linhas: [linha],
        isTurnos: false,
      };
      secoes.push(atual);
    }
  }

  return secoes;
}

function renderLinhaTurno(linha: string, idx: number) {
  const match = /^((?:Manhã|Tarde|Noite|Dia\s+\d+))\s*:\s*(.+)$/i.exec(linha);
  if (match) {
    return (
      <div key={idx} className="guide-shift-item">
        <strong>{match[1]}:</strong> <span>{match[2]}</span>
      </div>
    );
  }
  return (
    <div key={idx} className="guide-shift-item">
      <span>{linha}</span>
    </div>
  );
}

function categoriaAtrativo(item: AtrativoItem): { icone: string; rotulo: string } {
  const texto = `${item.nome} ${item.descricao}`.toLowerCase();
  if (item.tipo === "gastronomia") {
    if (texto.includes("bar") || texto.includes("bebida") || texto.includes("cajuína")) {
      return { icone: "🍸", rotulo: "BAR & BEBIDA" };
    }
    return { icone: "🍽️", rotulo: "COZINHA TÍPICA" };
  }
  if (
    texto.includes("praia") ||
    texto.includes("duna") ||
    texto.includes("lagoa") ||
    texto.includes("mar")
  ) {
    return { icone: "🏖️", rotulo: "PRAIA & NATUREZA" };
  }
  if (
    texto.includes("parque") ||
    texto.includes("mirante") ||
    texto.includes("serra") ||
    texto.includes("gruta")
  ) {
    return { icone: "🌿", rotulo: "MIRANTE & PARQUE" };
  }
  if (
    texto.includes("museu") ||
    texto.includes("igreja") ||
    texto.includes("forte") ||
    texto.includes("histór")
  ) {
    return { icone: "🏛️", rotulo: "CULTURA & HISTÓRIA" };
  }
  return { icone: "📍", rotulo: "ATRATIVO LOCAL" };
}

export function RoteiroResult({
  roteiro,
  streamingGuia,
  guiaStreamTexto,
  onRegerarGuiaStream,
  onAlternarVisita,
}: RoteiroResultProps) {
  const [guiaExpandido, setGuiaExpandido] = useState(true);

  const textoGuiaExibido = guiaStreamTexto !== null ? guiaStreamTexto : roteiro.guia;
  const secoes = useMemo(
    () => parsearGuiaEmSecoes(textoGuiaExibido, roteiro.dias_estadia),
    [textoGuiaExibido, roteiro.dias_estadia],
  );

  const estiloInfo = labelEstiloViagem(roteiro.estilo_viagem);
  const pontosTuristicos = roteiro.atrativos.filter((a) => a.tipo === "atrativo");
  const gastronomia = roteiro.atrativos.filter((a) => a.tipo === "gastronomia");

  const secoesVisiveis = guiaExpandido || streamingGuia ? secoes : secoes.slice(0, 1);
  const ocultasCount = Math.max(0, secoes.length - 1);

  const linkMapsLocal = (nomeLocal: string): string =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${nomeLocal}, ${roteiro.destino.cidade} - ${roteiro.destino.uf}`,
    )}`;

  return (
    <div className="roteiro-result-stack">
      <div className="trip-hero-banner">
        <span className="trip-style-pill">
          <span aria-hidden="true">{estiloInfo.icone}</span> {estiloInfo.label} ·{" "}
          {roteiro.dias_estadia} {roteiro.dias_estadia === 1 ? "Dia" : "Dias"}
        </span>
        <h2 className="trip-route-heading">
          <span aria-hidden="true">🚗</span> {roteiro.origem.cidade} - {roteiro.origem.uf} →{" "}
          {roteiro.destino.cidade} - {roteiro.destino.uf}
        </h2>
      </div>

      <section className="weather-banner" aria-label="Clima no destino">
        <div className="weather-main">
          <span className="weather-emoji" aria-hidden="true">
            {iconeClima(roteiro.clima.condicao)}
          </span>
          <div>
            <span className="weather-overline">
              CLIMA NO DESTINO ({roteiro.destino.cidade.toUpperCase()} - {roteiro.destino.uf})
            </span>
            <strong className="weather-temp">
              {roteiro.clima.disponivel && roteiro.clima.temperatura_c !== null
                ? `${roteiro.clima.temperatura_c.toFixed(1)}°C · ${roteiro.clima.condicao}`
                : roteiro.clima.condicao}
            </strong>
          </div>
        </div>

        {roteiro.clima.disponivel && (
          <div className="weather-extra">
            {roteiro.clima.sensacao_c !== null && (
              <span>Sensação: {roteiro.clima.sensacao_c.toFixed(1)}°C</span>
            )}
            {roteiro.clima.vento_kmh !== null && (
              <span>Vento: {roteiro.clima.vento_kmh.toFixed(0)} km/h</span>
            )}
            {roteiro.clima.umidade_pct !== null && (
              <span>Umidade: {Math.round(roteiro.clima.umidade_pct)}%</span>
            )}
          </div>
        )}
      </section>

      <section className="card guide-card" aria-labelledby="guide-heading">
        <div className="guide-card-header">
          <h3 id="guide-heading" className="section-title section-title-sm">
            <span aria-hidden="true">🧭</span> Guia do Viajante
          </h3>
          <div className="guide-header-actions">
            {roteiro.guia_fallback && !streamingGuia && (
              <span className="guide-mode-pill" title="Gerado com catálogo local + clima real">
                Modo Contingência
              </span>
            )}
            <button
              type="button"
              className="btn-stream-guide"
              onClick={() => void onRegerarGuiaStream()}
              disabled={streamingGuia}
              aria-busy={streamingGuia}
            >
              {streamingGuia ? (
                <>
                  <span className="spinner-inline spinner-dark" aria-hidden="true" /> Transmitindo
                  SSE...
                </>
              ) : (
                <>✨ Atualizar via Streaming IA</>
              )}
            </button>
          </div>
        </div>

        <div className="guide-content-box" aria-live="polite">
          {secoesVisiveis.length === 0 ? (
            <p className="guide-paragraph">
              {streamingGuia ? "Sintetizando guia em tempo real..." : textoGuiaExibido}
            </p>
          ) : (
            secoesVisiveis.map((secao, idx) => (
              <div key={`${secao.titulo}-${idx}`} className="guide-section-block">
                <h4 className="guide-section-title">{secao.titulo}</h4>
                {secao.isTurnos ? (
                  <div className="guide-shifts-list">
                    {secao.linhas.map((linha, lIdx) => renderLinhaTurno(linha, lIdx))}
                  </div>
                ) : (
                  secao.linhas.map((linha, lIdx) => (
                    <p key={lIdx} className="guide-paragraph">
                      {linha}
                    </p>
                  ))
                )}
              </div>
            ))
          )}

          {streamingGuia && <span className="stream-cursor" aria-hidden="true" />}

          {ocultasCount > 0 && !streamingGuia && (
            <div className="guide-expand-footer">
              <button
                type="button"
                className="btn-guide-toggle"
                onClick={() => setGuiaExpandido((prev) => !prev)}
                aria-expanded={guiaExpandido}
              >
                {guiaExpandido
                  ? "▲ Recolher detalhes do guia"
                  : `▼ Ver roteiro completo dia a dia (${ocultasCount} ${ocultasCount === 1 ? "seção" : "seções"})`}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="card catalog-card" aria-labelledby="attractions-heading">
        <div className="catalog-card-header">
          <div>
            <h3 id="attractions-heading" className="section-title section-title-sm">
              <span aria-hidden="true">📍</span> Pontos Turísticos &amp; Atrativos
            </h3>
            <p className="section-subtitle">Principais atrativos selecionados no destino.</p>
          </div>
          <span className="count-badge">
            {pontosTuristicos.length} {pontosTuristicos.length === 1 ? "local" : "locais"}
          </span>
        </div>

        <div className="catalog-grid">
          {pontosTuristicos.map((item) => {
            const cat = categoriaAtrativo(item);
            return (
              <article
                key={item.id}
                className={`catalog-item-card ${item.visitado ? "is-visited" : ""}`}
              >
                <div className="catalog-item-top">
                  <span className="catalog-category-tag">
                    <span aria-hidden="true">{cat.icone}</span> {cat.rotulo}
                  </span>
                  <a
                    href={linkMapsLocal(item.nome)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="catalog-maps-link"
                  >
                    Maps ↗
                  </a>
                </div>
                <h4 className="catalog-item-name">{item.nome}</h4>
                <p className="catalog-item-desc">Destaque: {item.descricao}</p>
                <button
                  type="button"
                  className={`visit-toggle-btn ${item.visitado ? "is-visited" : ""}`}
                  onClick={() => void onAlternarVisita(roteiro.id, item.id, !item.visitado)}
                  aria-pressed={item.visitado}
                >
                  {item.visitado ? "✓ Visitado" : "○ Marcar como visitado"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card catalog-card" aria-labelledby="gastronomy-heading">
        <div className="catalog-card-header">
          <div>
            <h3 id="gastronomy-heading" className="section-title section-title-sm">
              <span aria-hidden="true">🍽️</span> Restaurantes &amp; Gastronomia
            </h3>
            <p className="section-subtitle">Sugestões gastronômicas recomendadas no destino.</p>
          </div>
          <span className="count-badge">
            {gastronomia.length} {gastronomia.length === 1 ? "opção" : "opções"}
          </span>
        </div>

        <div className="catalog-grid">
          {gastronomia.map((item) => {
            const cat = categoriaAtrativo(item);
            return (
              <article
                key={item.id}
                className={`catalog-item-card ${item.visitado ? "is-visited" : ""}`}
              >
                <div className="catalog-item-top">
                  <span className="catalog-category-tag">
                    <span aria-hidden="true">{cat.icone}</span> {cat.rotulo}
                  </span>
                  <a
                    href={linkMapsLocal(item.nome)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="catalog-maps-link"
                  >
                    Maps ↗
                  </a>
                </div>
                <h4 className="catalog-item-name">{item.nome}</h4>
                <p className="catalog-item-desc">Destaque: {item.descricao}</p>
                <button
                  type="button"
                  className={`visit-toggle-btn ${item.visitado ? "is-visited" : ""}`}
                  onClick={() => void onAlternarVisita(roteiro.id, item.id, !item.visitado)}
                  aria-pressed={item.visitado}
                >
                  {item.visitado ? "✓ Visitado" : "○ Marcar como visitado"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
