import type { NetworkStatus } from "../hooks/useNetworkStatus.ts";
import type { SessionTimerState } from "../hooks/useSessionTimer.ts";
import {
  mascararUserId,
  type ReadyzResponse,
  type TelemetriaBackend,
  type TelemetriaUltimaChamada,
  type UsuarioPerfil,
} from "../types/schemas.ts";

export interface TelemetriaCardProps {
  usuario: UsuarioPerfil | null;
  sessionTimer: SessionTimerState;
  networkStatus: NetworkStatus;
  apiOnline: boolean;
  readyz: ReadyzResponse | null;
  telemetriaBackend: TelemetriaBackend | null;
  ultimaTelemetria: TelemetriaUltimaChamada | null;
  meusRoteirosCount: number;
}

export function TelemetriaCard({
  usuario,
  sessionTimer,
  networkStatus,
  apiOnline,
  readyz,
  telemetriaBackend,
  ultimaTelemetria,
  meusRoteirosCount,
}: TelemetriaCardProps) {
  const provedores = ultimaTelemetria?.provedores ?? {};
  const tempoGeo = Math.round(provedores.geocoding?.tempo_ms ?? 0);
  const tempoClima = Math.round(provedores.clima?.tempo_ms ?? 0);
  const tempoRota = Math.round(provedores.rota?.tempo_ms ?? 0);
  const tempoGemini = Math.round(provedores.gemini?.tempo_ms ?? 0);

  const tempoExternoTotal = tempoGeo + Math.max(tempoClima, tempoRota) + tempoGemini;
  const tempoTotal =
    ultimaTelemetria?.serverProcessTimeMs ?? ultimaTelemetria?.clientTotalTimeMs ?? 0;
  const servidorLocalMs = Math.max(0, Math.round(tempoTotal - tempoExternoTotal));

  const alertaLatencia = ultimaTelemetria !== null && tempoTotal >= 1500;
  const maiorApi =
    tempoGemini >= tempoRota && tempoGemini >= tempoClima
      ? {
          nome: "Google Gemini (IA)",
          ms: tempoGemini,
          desc: "síntese generativa de roteiro na nuvem",
        }
      : tempoRota >= tempoClima
        ? { nome: "OSRM (Rotas)", ms: tempoRota, desc: "cálculo geoespacial rodoviário" }
        : { nome: "Open-Meteo (Clima)", ms: tempoClima, desc: "telemetria meteorológica externa" };

  const pctExterno =
    tempoTotal > 0 ? Math.min(100, Math.round((tempoExternoTotal / tempoTotal) * 100)) : 0;
  const pctMaior = tempoTotal > 0 ? Math.min(100, Math.round((maiorApi.ms / tempoTotal) * 100)) : 0;

  const provedoresAtivos = telemetriaBackend?.provedores_ativos ?? (apiOnline ? 4 : 0);
  const provedoresTotal = telemetriaBackend?.provedores_total ?? 4;
  const uptimeDisplay =
    telemetriaBackend?.uptime_segundos !== undefined
      ? `${telemetriaBackend.uptime_segundos.toFixed(1)}s`
      : `${sessionTimer.elapsedSeconds.toFixed(1)}s`;
  const roteirosTotais = telemetriaBackend?.total_roteiros_salvos ?? meusRoteirosCount;

  const isGoogle = usuario?.tipo === "google";

  return (
    <section className="card telemetry-card" aria-labelledby="telemetry-heading">
      <div className="telemetry-header">
        <h2 id="telemetry-heading" className="section-title section-title-sm">
          <span aria-hidden="true">📊</span> Telemetria &amp; Desempenho
        </h2>
        <span className="providers-badge" title="Provedores concorrentes disponíveis">
          {provedoresAtivos}/{provedoresTotal} ativos
        </span>
      </div>

      {alertaLatencia && (
        <div className="latency-warning-box" role="status">
          <h3 className="latency-warning-title">
            <span aria-hidden="true">⚠️</span> Aviso de Latência em APIs Externas (Rede)
          </h3>
          <ul className="latency-warning-list">
            <li>
              <strong>Latência de APIs Externas (Rede):</strong> Tempo total de{" "}
              {tempoTotal.toFixed(1)}ms decorreu de consultas externas à internet ({pctExterno}% em
              trânsito/nuvem).
            </li>
            <li>
              <strong>API que mais demorou:</strong> {maiorApi.nome} levou {maiorApi.ms.toFixed(1)}
              ms ({pctMaior}% do tempo total — {maiorApi.desc}).
            </li>
            <li>
              <strong>Servidor FastAPI Saudável:</strong> Processamento interno concluído em apenas{" "}
              {servidorLocalMs}ms (sem sobrecarga de CPU ou memória local).
            </li>
          </ul>
        </div>
      )}

      <div className="telemetry-section">
        <h3 className="telemetry-overline">
          ⚡ ÚLTIMA VIAGEM
          {ultimaTelemetria
            ? ` (${ultimaTelemetria.origemLabel.toUpperCase()} → ${ultimaTelemetria.destinoLabel.toUpperCase()})`
            : " (AGUARDANDO CONSULTA)"}
        </h3>

        <div className="telemetry-metrics-grid">
          <div className="telemetry-metric-tile">
            <span className="metric-tile-label">Tempo Total</span>
            <strong className={`metric-tile-value ${alertaLatencia ? "is-amber" : "is-blue"}`}>
              {ultimaTelemetria ? `${tempoTotal.toFixed(2)} ms` : "—"}
            </strong>
          </div>

          <div className="telemetry-metric-tile">
            <span className="metric-tile-label">Geocoding</span>
            <strong className="metric-tile-value is-blue">
              {ultimaTelemetria ? `${tempoGeo} ms` : "—"}
            </strong>
          </div>

          <div className="telemetry-metric-tile">
            <span className="metric-tile-label">APIs + IA Gemini</span>
            <strong className="metric-tile-value is-blue">
              {ultimaTelemetria ? `${tempoExternoTotal} ms` : "—"}
            </strong>
          </div>

          <div className="telemetry-metric-tile">
            <span className="metric-tile-label">Servidor Local</span>
            <strong className="metric-tile-value is-green">
              {ultimaTelemetria ? `${servidorLocalMs} ms` : "—"}
            </strong>
          </div>
        </div>

        <div className="telemetry-api-bar">
          <span className="api-bar-label">Detalhamento por API:</span>
          <span>
            🤖 Gemini: <strong>{tempoGemini}ms</strong>
          </span>
          <span>
            🛣️ OSRM: <strong>{tempoRota}ms</strong>
          </span>
          <span>
            ⛅ Clima: <strong>{tempoClima}ms</strong>
          </span>
        </div>

        {ultimaTelemetria && (
          <div className="telemetry-trace-meta">
            <span>
              Front-End: <strong>{ultimaTelemetria.clientTotalTimeMs.toFixed(0)}ms</strong>
            </span>
            {ultimaTelemetria.requestId && (
              <span title="Correlation-ID retornado no header X-Request-ID">
                Correlation-ID: <code>{ultimaTelemetria.requestId.slice(0, 12)}</code>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="telemetry-section">
        <h3 className="telemetry-overline">👤 SESSÃO DO USUÁRIO &amp; CONEXÃO</h3>

        <dl className="session-info-card">
          <div className="session-row">
            <dt>Usuário Ativo:</dt>
            <dd>
              <strong>{usuario?.nome ?? "Visitante"}</strong>{" "}
              <span className="session-subtag">
                {isGoogle
                  ? `(Google Conectado · ${mascararUserId(usuario.user_id)})`
                  : "(Visitante Temporário)"}
              </span>
            </dd>
          </div>

          <div className="session-row">
            <dt>Início da Sessão:</dt>
            <dd>{sessionTimer.inicioFormatado}</dd>
          </div>

          <div className="session-row">
            <dt>Tempo Total da Sessão:</dt>
            <dd className="text-info-strong">⏱️ {sessionTimer.elapsedLabel}</dd>
          </div>

          {!isGoogle && sessionTimer.remainingLabel && (
            <div className="session-row">
              <dt>Expira em (TTL 2h):</dt>
              <dd className={sessionTimer.isExpiringSoon ? "text-warning-strong" : ""}>
                ⏳ {sessionTimer.remainingLabel}
              </dd>
            </div>
          )}

          <div className="session-row">
            <dt>Persistência dos Dados:</dt>
            <dd className={isGoogle ? "text-success-strong" : "text-warning-strong"}>
              {isGoogle ? "💾 Permanente (Conta Google)" : "⚡ Memória Temporária (Visitante)"}
            </dd>
          </div>

          <div className="session-row">
            <dt>Meus Roteiros:</dt>
            <dd className="text-info-strong">📁 {meusRoteirosCount}</dd>
          </div>

          <div className="session-row">
            <dt>Qualidade da Conexão:</dt>
            <dd>
              <span
                className={`connection-pill ${networkStatus.isOnline ? "is-good" : "is-offline"}`}
              >
                📶{" "}
                {networkStatus.isOnline
                  ? `${networkStatus.effectiveType} • RTT: ${networkStatus.rttMs}ms (${networkStatus.qualidadeLabel})`
                  : "Sem conexão (Offline)"}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="telemetry-footer-grid">
        <div className="telemetry-mini-card">
          <span className="metric-tile-label">Status da API</span>
          <strong className={`api-status-val ${apiOnline ? "is-online" : "is-offline"}`}>
            <span className="status-dot" aria-hidden="true" />
            {apiOnline ? "ONLINE" : "OFFLINE"}
          </strong>
        </div>

        <div className="telemetry-mini-card">
          <span className="metric-tile-label">Uptime Backend</span>
          <strong className="metric-tile-value is-blue">{uptimeDisplay}</strong>
        </div>

        <div className="telemetry-mini-card">
          <span className="metric-tile-label">Roteiros Totais</span>
          <strong className="metric-tile-value is-blue">{roteirosTotais}</strong>
        </div>
      </div>

      <p className="telemetry-providers-caption">
        <strong>
          Provedores Concorrentes ({provedoresAtivos}/{provedoresTotal}):
        </strong>{" "}
        Open-Meteo, OSRM, {readyz?.gemini === false ? "Gemini (Contingência)" : "Google Gemini"},
        Open-Elevation
      </p>
    </section>
  );
}
