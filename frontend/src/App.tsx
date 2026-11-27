import { useCallback, useRef, useState } from "react";
import { BotoesControleViagem } from "./components/BotoesControleViagem.tsx";
import { Footer } from "./components/Footer.tsx";
import { Header } from "./components/Header.tsx";
import { HistoricoViagens } from "./components/HistoricoViagens.tsx";
import { LoginScreen } from "./components/LoginScreen.tsx";
import { MapaRota } from "./components/MapaRota.tsx";
import { RoteiroForm } from "./components/RoteiroForm.tsx";
import { RoteiroResult } from "./components/RoteiroResult.tsx";
import { TelemetriaCard } from "./components/TelemetriaCard.tsx";
import { ToastContainer } from "./components/Toast.tsx";
import { useAuth } from "./hooks/useAuth.ts";
import { useNetworkStatus } from "./hooks/useNetworkStatus.ts";
import { useSessionTimer } from "./hooks/useSessionTimer.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { useToasts } from "./hooks/useToasts.ts";
import { useViagem } from "./hooks/useViagem.ts";

type AbaResultado = "visao_geral" | "mapa" | "guia";

export function App() {
  const { isDark, toggleTheme } = useTheme();
  const { toasts, addToast, dismissToast } = useToasts();
  const networkStatus = useNetworkStatus();
  const [abaAtiva, setAbaAtiva] = useState<AbaResultado>("visao_geral");
  const limparEstadoRef = useRef<() => void>(() => undefined);

  const notificar = useCallback(
    (tipo: "success" | "error" | "info" | "warning", titulo: string, mensagem?: string) => {
      addToast(mensagem !== undefined ? { tipo, titulo, mensagem } : { tipo, titulo });
    },
    [addToast],
  );

  const handleModeSwitch = useCallback(() => {
    limparEstadoRef.current();
  }, []);

  const auth = useAuth({
    onModeSwitch: handleModeSwitch,
    onNotify: notificar,
  });

  const handleSessionExpired = useCallback(() => {
    if (auth.usuario?.tipo === "visitante") {
      notificar(
        "warning",
        "Sessão de visitante expirada",
        "Iniciando automaticamente uma nova sessão temporária de 2 horas.",
      );
      void auth.renovarVisitante();
    }
  }, [auth, notificar]);

  const sessionTimer = useSessionTimer(
    auth.sessionStartMs,
    auth.usuario?.expira_em ?? null,
    handleSessionExpired,
  );

  const viagem = useViagem({
    usuario: auth.usuario,
    renovarVisitante: auth.renovarVisitante,
    onNotify: notificar,
  });

  limparEstadoRef.current = viagem.limparEstadoAtual;

  if (!auth.usuario) {
    return (
      <div className="app-shell">
        {!auth.sessaoVerificada ? (
          <main id="conteudo-principal" className="login-loading" aria-busy="true">
            <p>Verificando sessão…</p>
          </main>
        ) : (
          <LoginScreen
            savedGoogleUser={auth.savedGoogleUser}
            googleLoginHabilitado={viagem.readyz?.google_login ?? false}
            carregando={auth.carregandoAuth}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            onEntrarGoogle={auth.entrarComGoogle}
            onEntrarVisitante={auth.alternarParaVisitante}
            onVoltarParaGoogle={auth.voltarParaGoogle}
          />
        )}
        <Footer />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <a href="#conteudo-principal" className="skip-link">
        Ir para o conteúdo principal
      </a>

      <Header
        usuario={auth.usuario}
        savedGoogleUser={auth.savedGoogleUser}
        googleLoginHabilitado={viagem.readyz?.google_login ?? false}
        isDark={isDark}
        isOnline={networkStatus.isOnline}
        sessionTimer={sessionTimer}
        onToggleTheme={toggleTheme}
        onEntrarGoogle={auth.entrarComGoogle}
        onAlternarVisitante={auth.alternarParaVisitante}
        onVoltarParaGoogle={auth.voltarParaGoogle}
        onSairGoogle={auth.sairDaContaGoogle}
        onEncerrarSessao={auth.encerrarSessao}
      />

      <main id="conteudo-principal" className="dashboard-container">
        <div className="dashboard-main-column">
          <RoteiroForm
            destinosCatalogo={viagem.destinosCatalogo}
            planejando={viagem.planejando}
            onPlanejar={viagem.planejarViagem}
            onCancelar={viagem.cancelarPlanejamento}
          />

          {viagem.roteiroAtual ? (
            <div className="results-workspace">
              <div className="results-tabs-bar" role="tablist" aria-label="Visualização do roteiro">
                <button
                  type="button"
                  role="tab"
                  aria-selected={abaAtiva === "visao_geral"}
                  className={`view-tab-btn ${abaAtiva === "visao_geral" ? "is-active" : ""}`}
                  onClick={() => setAbaAtiva("visao_geral")}
                >
                  ✨ Visão Geral
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={abaAtiva === "mapa"}
                  className={`view-tab-btn ${abaAtiva === "mapa" ? "is-active" : ""}`}
                  onClick={() => setAbaAtiva("mapa")}
                >
                  🗺️ Mapa &amp; Paradas
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={abaAtiva === "guia"}
                  className={`view-tab-btn ${abaAtiva === "guia" ? "is-active" : ""}`}
                  onClick={() => setAbaAtiva("guia")}
                >
                  📖 Guia &amp; Clima
                </button>
              </div>

              <BotoesControleViagem
                roteiro={viagem.roteiroAtual}
                onCompartilharWhatsApp={(id) => void viagem.compartilharWhatsApp(id)}
                onExportarGpx={(id) => void viagem.exportarGpx(id)}
                onExcluir={(id) => void viagem.excluirViagem(id)}
              />

              {(abaAtiva === "visao_geral" || abaAtiva === "mapa") && (
                <MapaRota
                  roteiro={viagem.roteiroAtual}
                  mapaRota={viagem.mapaRota}
                  rotaSelecionadaIdx={viagem.rotaSelecionadaIdx}
                  carregandoMapa={viagem.carregandoMapa}
                  veiculoAtual={viagem.veiculoMapa}
                  passageiros={viagem.passageiros}
                  onSelecionarRota={viagem.setRotaSelecionadaIdx}
                  onAlterarVeiculo={viagem.atualizarVeiculoNoMapa}
                  onAlterarPassageiros={viagem.atualizarPassageiros}
                />
              )}

              {(abaAtiva === "visao_geral" || abaAtiva === "guia") && (
                <RoteiroResult
                  roteiro={viagem.roteiroAtual}
                  streamingGuia={viagem.streamingGuia}
                  guiaStreamTexto={viagem.guiaStreamTexto}
                  onRegerarGuiaStream={viagem.regerarGuiaStreaming}
                  onAlternarVisita={viagem.alternarVisita}
                />
              )}
            </div>
          ) : (
            <section className="card welcome-empty-card" aria-label="Instruções iniciais">
              <div className="welcome-empty-inner">
                <span className="welcome-empty-icon" aria-hidden="true">
                  🗺️
                </span>
                <h3>Pronto para traçar sua próxima viagem?</h3>
                <p>
                  Escolha a cidade de origem e destino acima — ou clique em uma das sugestões acima
                  de 400 km — para gerar o mapa rodoviário OSRM, paradas estratégicas, perfil
                  altimétrico, clima em tempo real e guia personalizado com IA.
                </p>
              </div>
            </section>
          )}
        </div>

        <div className="dashboard-sidebar-column">
          <TelemetriaCard
            usuario={auth.usuario}
            sessionTimer={sessionTimer}
            networkStatus={networkStatus}
            apiOnline={viagem.apiOnline}
            readyz={viagem.readyz}
            telemetriaBackend={viagem.telemetriaBackend}
            ultimaTelemetria={viagem.ultimaTelemetria}
            meusRoteirosCount={viagem.historico.length}
          />

          <HistoricoViagens
            viagens={viagem.historico}
            roteiroAtualId={viagem.roteiroAtual?.id ?? null}
            onSelecionar={(roteiro) => void viagem.selecionarViagem(roteiro)}
            onExcluir={(id) => void viagem.excluirViagem(id)}
          />
        </div>
      </main>

      <Footer />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
