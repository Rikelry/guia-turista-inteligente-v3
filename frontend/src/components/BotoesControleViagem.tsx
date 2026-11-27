import type { RoteiroResponse } from "../types/schemas.ts";

export interface BotoesControleViagemProps {
  roteiro: RoteiroResponse;
  onCompartilharWhatsApp: (roteiroId: string) => void;
  onExportarGpx: (roteiroId: string) => void;
  onExcluir: (roteiroId: string) => void;
}

export function BotoesControleViagem({
  roteiro,
  onCompartilharWhatsApp,
  onExportarGpx,
  onExcluir,
}: BotoesControleViagemProps) {
  const origemParam = encodeURIComponent(`${roteiro.origem.cidade}, ${roteiro.origem.uf}, Brasil`);
  const destinoParam = encodeURIComponent(
    `${roteiro.destino.cidade}, ${roteiro.destino.uf}, Brasil`,
  );
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origemParam}&destination=${destinoParam}&travelmode=driving`;

  return (
    <div className="trip-actions-bar" role="toolbar" aria-label="Ações rápidas do roteiro">
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="action-pill action-pill-maps"
      >
        <span aria-hidden="true">🗺️</span> Abrir no Maps
      </a>

      <button
        type="button"
        className="action-pill action-pill-whatsapp"
        onClick={() => onCompartilharWhatsApp(roteiro.id)}
      >
        <span aria-hidden="true">💬</span> WhatsApp
      </button>

      <button
        type="button"
        className="action-pill action-pill-gpx"
        onClick={() => onExportarGpx(roteiro.id)}
      >
        <span aria-hidden="true">📍</span> Baixar GPX 1.1
      </button>

      <button
        type="button"
        className="action-pill action-pill-print"
        onClick={() => window.print()}
      >
        <span aria-hidden="true">🖨️</span> Imprimir
      </button>

      <button
        type="button"
        className="action-pill action-pill-delete"
        onClick={() => onExcluir(roteiro.id)}
      >
        <span aria-hidden="true">🗑️</span> Excluir
      </button>
    </div>
  );
}
