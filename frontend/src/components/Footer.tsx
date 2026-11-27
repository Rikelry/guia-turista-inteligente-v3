export function Footer() {
  return (
    <footer className="app-footer" role="contentinfo">
      <div className="app-footer-inner">
        <p className="footer-brand">
          <strong>Guia do Turista Brasil</strong> — React 19 + TypeScript + Vite+ &amp; FastAPI
          Assíncrono
        </p>
        <p className="footer-meta">
          Dados geográficos via OpenStreetMap / OSRM · Clima via Open-Meteo · Relevo via
          Open-Elevation · Síntese com Google Gemini AI
        </p>
      </div>
    </footer>
  );
}
