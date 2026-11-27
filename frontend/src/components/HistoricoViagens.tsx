import { formatarDuracao, type RoteiroResponse } from "../types/schemas.ts";

export interface HistoricoViagensProps {
  viagens: readonly RoteiroResponse[];
  roteiroAtualId: string | null;
  onSelecionar: (roteiro: RoteiroResponse) => void;
  onExcluir: (roteiroId: string) => void;
}

function iconeClimaCurto(condicao: string): string {
  const texto = condicao.toLowerCase();
  if (texto.includes("chuva") || texto.includes("tempest") || texto.includes("garoa")) return "🌧️";
  if (texto.includes("nublado") || texto.includes("encoberto")) return "⛅";
  if (texto.includes("neblina") || texto.includes("névoa")) return "🌫️";
  return "☀️";
}

export function HistoricoViagens({
  viagens,
  roteiroAtualId,
  onSelecionar,
  onExcluir,
}: HistoricoViagensProps) {
  return (
    <aside className="card history-card" aria-labelledby="saved-trips-heading">
      <div className="section-head section-head-compact">
        <h2 id="saved-trips-heading" className="section-title section-title-sm">
          <span aria-hidden="true">🧳</span> Viagens Salvas
        </h2>
        <p className="section-subtitle">Histórico de viagens salvas</p>
      </div>

      {viagens.length === 0 ? (
        <div className="empty-history-state">
          <span className="empty-history-icon" aria-hidden="true">
            🧭
          </span>
          <p>Nenhuma viagem salva ainda.</p>
          <small>Planeje seu primeiro roteiro ao lado para vê-lo aqui instantaneamente.</small>
        </div>
      ) : (
        <ul className="history-list" aria-label="Lista de viagens salvas">
          {viagens.map((viagem) => {
            const selecionada = viagem.id === roteiroAtualId;
            const tempTexto =
              viagem.clima.disponivel && viagem.clima.temperatura_c !== null
                ? `${viagem.clima.temperatura_c.toFixed(1)}°C`
                : "—";
            const distTexto =
              viagem.rota.disponivel && viagem.rota.distancia_km !== null
                ? `${viagem.rota.distancia_km.toFixed(1)} km`
                : "Sem rota";

            return (
              <li key={viagem.id}>
                <div
                  className={`history-item-card ${selecionada ? "is-active" : ""}`}
                  onClick={() => onSelecionar(viagem)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelecionar(viagem);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-current={selecionada ? "true" : undefined}
                >
                  <div className="history-item-top">
                    <span className="history-route-title">
                      <span aria-hidden="true">🚗</span> {viagem.origem.cidade} - {viagem.origem.uf}{" "}
                      → {viagem.destino.cidade} - {viagem.destino.uf}
                    </span>
                    <span className="history-duration-badge">
                      ⚡ {formatarDuracao(viagem.rota.duracao_min)}
                    </span>
                  </div>

                  <div className="history-item-bottom">
                    <span className="history-meta">
                      {iconeClimaCurto(viagem.clima.condicao)} {tempTexto} • 🛣️ {distTexto}
                    </span>

                    <button
                      type="button"
                      className="btn-history-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExcluir(viagem.id);
                      }}
                      aria-label={`Excluir viagem ${viagem.origem.cidade} para ${viagem.destino.cidade}`}
                    >
                      <span aria-hidden="true">🗑️</span> Excluir
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
