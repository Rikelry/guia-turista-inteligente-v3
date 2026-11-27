import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  calcularCustosApi,
  compartilharRoteiroApi,
  consultarReadyzApi,
  consultarTelemetriaApi,
  excluirRoteiroApi,
  exportarGpxApi,
  listarDestinosApi,
  listarMinhasViagensApi,
  marcarVisitaApi,
  obterMapaRotaApi,
  planejarRoteiroApi,
  streamGuiaIaApi,
} from "../services/api.ts";
import { DESTINOS_PADRAO, mesclarCatalogosDestinos } from "../services/geolocation.ts";
import {
  obterViagensVisitanteCache,
  salvarViagensVisitanteCache,
} from "../services/visitanteStorage.ts";
import {
  DEFAULT_VEICULO_COMBUSTAO,
  normalizarUf,
  type DestinoCatalogo,
  type MapaRotaResponse,
  type ReadyzResponse,
  type RoteiroRequest,
  type RoteiroResponse,
  type TelemetriaBackend,
  type TelemetriaUltimaChamada,
  type UsuarioPerfil,
  type Veiculo,
} from "../types/schemas.ts";

export interface UseViagemOptions {
  usuario: UsuarioPerfil | null;
  renovarVisitante: () => Promise<UsuarioPerfil>;
  onNotify: (
    tipo: "success" | "error" | "info" | "warning",
    titulo: string,
    mensagem?: string,
  ) => void;
}

export interface UseViagemReturn {
  roteiroAtual: RoteiroResponse | null;
  mapaRota: MapaRotaResponse | null;
  rotaSelecionadaIdx: number;
  setRotaSelecionadaIdx: (idx: number) => void;
  historico: RoteiroResponse[];
  destinosCatalogo: DestinoCatalogo[];
  telemetriaBackend: TelemetriaBackend | null;
  readyz: ReadyzResponse | null;
  apiOnline: boolean;
  ultimaTelemetria: TelemetriaUltimaChamada | null;
  planejando: boolean;
  carregandoMapa: boolean;
  streamingGuia: boolean;
  guiaStreamTexto: string | null;
  veiculoMapa: Veiculo;
  passageiros: number;
  planejarViagem: (payload: RoteiroRequest) => Promise<void>;
  cancelarPlanejamento: () => void;
  selecionarViagem: (roteiro: RoteiroResponse) => Promise<void>;
  excluirViagem: (roteiroId: string) => Promise<void>;
  alternarVisita: (roteiroId: string, atrativoId: string, visitado: boolean) => Promise<void>;
  regerarGuiaStreaming: () => Promise<void>;
  atualizarVeiculoNoMapa: (veiculo: Veiculo) => Promise<void>;
  atualizarPassageiros: (qtd: number) => Promise<void>;
  exportarGpx: (roteiroId: string) => Promise<void>;
  compartilharWhatsApp: (roteiroId: string) => Promise<void>;
  limparEstadoAtual: () => void;
  atualizarTelemetria: () => Promise<void>;
}

export function useViagem({
  usuario,
  renovarVisitante,
  onNotify,
}: UseViagemOptions): UseViagemReturn {
  const [roteiroAtual, setRoteiroAtual] = useState<RoteiroResponse | null>(null);
  const [mapaRota, setMapaRota] = useState<MapaRotaResponse | null>(null);
  const [rotaSelecionadaIdx, setRotaSelecionadaIdx] = useState<number>(0);
  const [historico, setHistorico] = useState<RoteiroResponse[]>([]);
  const [destinosCatalogo, setDestinosCatalogo] = useState<DestinoCatalogo[]>(() => [
    ...DESTINOS_PADRAO,
  ]);
  const [telemetriaBackend, setTelemetriaBackend] = useState<TelemetriaBackend | null>(null);
  const [readyz, setReadyz] = useState<ReadyzResponse | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean>(true);
  const [ultimaTelemetria, setUltimaTelemetria] = useState<TelemetriaUltimaChamada | null>(null);
  const [planejando, setPlanejando] = useState<boolean>(false);
  const [carregandoMapa, setCarregandoMapa] = useState<boolean>(false);
  const [streamingGuia, setStreamingGuia] = useState<boolean>(false);
  const [guiaStreamTexto, setGuiaStreamTexto] = useState<string | null>(null);
  const [veiculoMapa, setVeiculoMapa] = useState<Veiculo>(DEFAULT_VEICULO_COMBUSTAO);
  const [passageiros, setPassageiros] = useState<number>(1);

  const planAbortRef = useRef<AbortController | null>(null);
  const mapAbortRef = useRef<AbortController | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const atualizarTelemetria = useCallback(async (): Promise<void> => {
    try {
      const [readyData, telData] = await Promise.all([
        consultarReadyzApi(),
        consultarTelemetriaApi().catch(() => null),
      ]);
      setReadyz(readyData);
      setApiOnline(readyData.status === "pronto");
      if (telData) {
        setTelemetriaBackend(telData);
      }
    } catch {
      setApiOnline(false);
    }
  }, []);

  useEffect(() => {
    void atualizarTelemetria();
    void listarDestinosApi()
      .then((remotos) => {
        setDestinosCatalogo(mesclarCatalogosDestinos(remotos));
      })
      .catch(() => undefined);

    const intervalId = window.setInterval(() => {
      void atualizarTelemetria();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [atualizarTelemetria]);

  const carregarMapaParaRoteiro = useCallback(
    async (
      roteiro: RoteiroResponse,
      userId: string,
      veiculo: Veiculo,
      qtdPassageiros: number,
    ): Promise<void> => {
      const origemUf = normalizarUf(roteiro.origem.uf);
      const destinoUf = normalizarUf(roteiro.destino.uf);
      if (
        !origemUf ||
        !destinoUf ||
        (roteiro.origem.lat === 0 && roteiro.origem.lon === 0) ||
        (roteiro.destino.lat === 0 && roteiro.destino.lon === 0)
      ) {
        setMapaRota(null);
        return;
      }

      mapAbortRef.current?.abort();
      const controller = new AbortController();
      mapAbortRef.current = controller;
      setCarregandoMapa(true);

      try {
        const res = await obterMapaRotaApi(
          {
            origem: { lat: roteiro.origem.lat, lon: roteiro.origem.lon },
            destino: { lat: roteiro.destino.lat, lon: roteiro.destino.lon },
            origem_uf: origemUf,
            destino_uf: destinoUf,
            veiculo,
            passageiros: qtdPassageiros,
            alternativas: true,
          },
          userId,
          controller.signal,
        );
        setMapaRota(res.data);
        setRotaSelecionadaIdx(0);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setMapaRota(null);
      } finally {
        if (mapAbortRef.current === controller) {
          setCarregandoMapa(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let ativo = true;
    const userId = usuario?.user_id;
    if (!userId) return;

    async function carregarHistorico(): Promise<void> {
      try {
        const lista = await listarMinhasViagensApi(userId!);
        if (!ativo) return;
        setHistorico(lista);
        if (usuario?.tipo === "visitante") {
          salvarViagensVisitanteCache(userId!, lista);
        }
      } catch {
        if (!ativo) return;
        if (usuario?.tipo === "visitante") {
          setHistorico(obterViagensVisitanteCache(userId!));
        } else {
          setHistorico([]);
        }
      }
    }

    void carregarHistorico();

    return () => {
      ativo = false;
    };
  }, [usuario?.user_id, usuario?.tipo]);

  const limparEstadoAtual = useCallback(() => {
    planAbortRef.current?.abort();
    mapAbortRef.current?.abort();
    streamAbortRef.current?.abort();
    setRoteiroAtual(null);
    setMapaRota(null);
    setRotaSelecionadaIdx(0);
    setGuiaStreamTexto(null);
    setStreamingGuia(false);
    setPlanejando(false);
    setCarregandoMapa(false);
  }, []);

  const cancelarPlanejamento = useCallback(() => {
    if (planAbortRef.current) {
      planAbortRef.current.abort();
      planAbortRef.current = null;
      setPlanejando(false);
      onNotify(
        "info",
        "Planejamento cancelado",
        "A requisição foi encerrada sem consumir recursos.",
      );
    }
  }, [onNotify]);

  const planejarViagem = useCallback(
    async (payload: RoteiroRequest): Promise<void> => {
      if (planejando) return;

      let userAtivo = usuario;
      if (!userAtivo) {
        userAtivo = await renovarVisitante();
      }

      planAbortRef.current?.abort();
      streamAbortRef.current?.abort();
      const controller = new AbortController();
      planAbortRef.current = controller;

      setPlanejando(true);
      setGuiaStreamTexto(null);
      setVeiculoMapa(payload.veiculo);
      setPassageiros(payload.passageiros);

      const executar = async (uid: string): Promise<void> => {
        const res = await planejarRoteiroApi(payload, uid, controller.signal);
        const novoRoteiro = res.data;

        setRoteiroAtual(novoRoteiro);
        setUltimaTelemetria({
          requestId: res.requestId,
          serverProcessTimeMs: res.processTimeMs,
          clientTotalTimeMs: res.clientTimeMs,
          origemLabel: `${novoRoteiro.origem.cidade} - ${novoRoteiro.origem.uf}`,
          destinoLabel: `${novoRoteiro.destino.cidade} - ${novoRoteiro.destino.uf}`,
          provedores: novoRoteiro.provedores,
          registradoEm: new Date().toISOString(),
        });

        setHistorico((prev) => {
          const atualizado = [novoRoteiro, ...prev.filter((r) => r.id !== novoRoteiro.id)];
          if (userAtivo?.tipo === "visitante") {
            salvarViagensVisitanteCache(uid, atualizado);
          }
          return atualizado;
        });

        onNotify(
          "success",
          "Roteiro planejado com sucesso!",
          `${novoRoteiro.origem.nome} → ${novoRoteiro.destino.nome}`,
        );

        void Promise.all([
          carregarMapaParaRoteiro(novoRoteiro, uid, payload.veiculo, payload.passageiros),
          atualizarTelemetria(),
        ]);
      };

      try {
        await executar(userAtivo.user_id);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (err instanceof ApiError && err.status === 401) {
          const novoVisitante = await renovarVisitante();
          try {
            await executar(novoVisitante.user_id);
            return;
          } catch (retryErr) {
            const msg = retryErr instanceof Error ? retryErr.message : "Erro ao planejar viagem.";
            onNotify("error", "Falha ao planejar viagem", msg);
            return;
          }
        }
        if (err instanceof ApiError && err.status === 409) {
          onNotify("warning", "Planejamento já em andamento", err.message);
          return;
        }
        const msg =
          err instanceof Error ? err.message : "Não foi possível conectar ao servidor de roteiros.";
        onNotify("error", "Erro ao planejar viagem", msg);
      } finally {
        if (planAbortRef.current === controller) {
          planAbortRef.current = null;
          setPlanejando(false);
        }
      }
    },
    [atualizarTelemetria, carregarMapaParaRoteiro, onNotify, planejando, renovarVisitante, usuario],
  );

  const selecionarViagem = useCallback(
    async (roteiro: RoteiroResponse): Promise<void> => {
      streamAbortRef.current?.abort();
      setRoteiroAtual(roteiro);
      setGuiaStreamTexto(null);
      setStreamingGuia(false);
      setUltimaTelemetria((prev) => ({
        requestId: prev?.requestId ?? null,
        serverProcessTimeMs: prev?.serverProcessTimeMs ?? null,
        clientTotalTimeMs:
          Object.values(roteiro.provedores).reduce((acc, p) => acc + p.tempo_ms, 0) ||
          (prev?.clientTotalTimeMs ?? 0),
        origemLabel: `${roteiro.origem.cidade} - ${roteiro.origem.uf}`,
        destinoLabel: `${roteiro.destino.cidade} - ${roteiro.destino.uf}`,
        provedores: roteiro.provedores,
        registradoEm: roteiro.criado_em,
      }));
      if (usuario) {
        await carregarMapaParaRoteiro(roteiro, usuario.user_id, veiculoMapa, passageiros);
      }
    },
    [carregarMapaParaRoteiro, passageiros, usuario, veiculoMapa],
  );

  const excluirViagem = useCallback(
    async (roteiroId: string): Promise<void> => {
      if (!usuario) return;
      try {
        await excluirRoteiroApi(roteiroId, usuario.user_id);
        setHistorico((prev) => {
          const restante = prev.filter((item) => item.id !== roteiroId);
          if (usuario.tipo === "visitante") {
            salvarViagensVisitanteCache(usuario.user_id, restante);
          }
          return restante;
        });
        if (roteiroAtual?.id === roteiroId) {
          setRoteiroAtual(null);
          setMapaRota(null);
          setGuiaStreamTexto(null);
        }
        onNotify("info", "Viagem removida", "O roteiro foi excluído do seu histórico.");
        void atualizarTelemetria();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Não foi possível excluir a viagem.";
        onNotify("error", "Erro ao excluir viagem", msg);
      }
    },
    [atualizarTelemetria, onNotify, roteiroAtual?.id, usuario],
  );

  const alternarVisita = useCallback(
    async (roteiroId: string, atrativoId: string, visitado: boolean): Promise<void> => {
      if (!usuario) return;

      const aplicarLocal = (r: RoteiroResponse): RoteiroResponse =>
        r.id !== roteiroId
          ? r
          : {
              ...r,
              atrativos: r.atrativos.map((a) => (a.id === atrativoId ? { ...a, visitado } : a)),
            };

      setRoteiroAtual((prev) => (prev ? aplicarLocal(prev) : prev));
      setHistorico((prev) => prev.map(aplicarLocal));

      try {
        const atualizado = await marcarVisitaApi(roteiroId, atrativoId, visitado, usuario.user_id);
        setRoteiroAtual((prev) => (prev?.id === roteiroId ? atualizado : prev));
        setHistorico((prev) => {
          const lista = prev.map((item) => (item.id === roteiroId ? atualizado : item));
          if (usuario.tipo === "visitante") {
            salvarViagensVisitanteCache(usuario.user_id, lista);
          }
          return lista;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Não foi possível atualizar a visita.";
        onNotify("error", "Falha ao salvar marcação", msg);
      }
    },
    [onNotify, usuario],
  );

  const regerarGuiaStreaming = useCallback(async (): Promise<void> => {
    if (!roteiroAtual || streamingGuia) return;

    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    setStreamingGuia(true);
    setGuiaStreamTexto("");

    try {
      let acumulado = "";
      await streamGuiaIaApi(
        {
          destino: roteiroAtual.destino.nome,
          dias_estadia: roteiroAtual.dias_estadia,
          estilo_viagem: roteiroAtual.estilo_viagem,
          clima_info: roteiroAtual.clima,
          atrativos: roteiroAtual.atrativos.filter((a) => a.tipo === "atrativo").map((a) => a.nome),
          gastronomia: roteiroAtual.atrativos
            .filter((a) => a.tipo === "gastronomia")
            .map((a) => a.nome),
        },
        (chunk) => {
          acumulado += chunk;
          setGuiaStreamTexto(acumulado);
        },
        controller.signal,
      );

      if (acumulado.trim()) {
        setRoteiroAtual((prev) => (prev ? { ...prev, guia: acumulado.trim() } : prev));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Erro durante o streaming do guia.";
      onNotify("error", "Streaming interrompido", msg);
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
        setStreamingGuia(false);
      }
    }
  }, [onNotify, roteiroAtual, streamingGuia]);

  const atualizarVeiculoNoMapa = useCallback(
    async (novoVeiculo: Veiculo): Promise<void> => {
      setVeiculoMapa(novoVeiculo);
      if (roteiroAtual && usuario) {
        await carregarMapaParaRoteiro(roteiroAtual, usuario.user_id, novoVeiculo, passageiros);
      }
    },
    [carregarMapaParaRoteiro, passageiros, roteiroAtual, usuario],
  );

  const atualizarPassageiros = useCallback(
    async (qtd: number): Promise<void> => {
      const clamped = Math.max(1, Math.min(8, Math.round(qtd)));
      setPassageiros(clamped);
      if (!roteiroAtual || !mapaRota) return;

      const origemUf = normalizarUf(roteiroAtual.origem.uf);
      const destinoUf = normalizarUf(roteiroAtual.destino.uf);
      if (!origemUf || !destinoUf) return;

      try {
        const rotasAtualizadas = await Promise.all(
          mapaRota.rotas.map(async (alt) => {
            const dist = alt.rota.distancia_km;
            if (!dist || dist <= 0) return alt;
            const novosCustos = await calcularCustosApi({
              distancia_km: dist,
              origem_uf: origemUf,
              destino_uf: destinoUf,
              veiculo: veiculoMapa,
              passageiros: clamped,
              penalizacao_pct: alt.altimetria.penalizacao_pct,
            });
            return { ...alt, custos: novosCustos };
          }),
        );
        setMapaRota({ rotas: rotasAtualizadas });
      } catch {
        // Fallback local imediato se a chamada /custos falhar.
        setMapaRota((prev) =>
          prev
            ? {
                rotas: prev.rotas.map((alt) => ({
                  ...alt,
                  custos: {
                    ...alt.custos,
                    passageiros: clamped,
                    por_passageiro: Math.round((alt.custos.custo_total / clamped) * 100) / 100,
                  },
                })),
              }
            : prev,
        );
      }
    },
    [mapaRota, roteiroAtual, veiculoMapa],
  );

  const exportarGpx = useCallback(
    async (roteiroId: string): Promise<void> => {
      if (!usuario) return;
      try {
        const { blob, filename } = await exportarGpxApi(roteiroId, usuario.user_id);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        onNotify("success", "Arquivo GPX 1.1 baixado", filename);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha ao gerar arquivo GPX.";
        onNotify("error", "Erro ao exportar GPX", msg);
      }
    },
    [onNotify, usuario],
  );

  const compartilharWhatsApp = useCallback(
    async (roteiroId: string): Promise<void> => {
      if (!usuario) return;
      try {
        const res = await compartilharRoteiroApi(roteiroId, "whatsapp", usuario.user_id);
        window.open(res.link_whatsapp, "_blank", "noopener,noreferrer");
        onNotify("success", "Pronto para compartilhar", "Resumo enviado para o WhatsApp.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao gerar link do WhatsApp.";
        onNotify("error", "Erro ao compartilhar", msg);
      }
    },
    [onNotify, usuario],
  );

  return {
    roteiroAtual,
    mapaRota,
    rotaSelecionadaIdx,
    setRotaSelecionadaIdx,
    historico,
    destinosCatalogo,
    telemetriaBackend,
    readyz,
    apiOnline,
    ultimaTelemetria,
    planejando,
    carregandoMapa,
    streamingGuia,
    guiaStreamTexto,
    veiculoMapa,
    passageiros,
    planejarViagem,
    cancelarPlanejamento,
    selecionarViagem,
    excluirViagem,
    alternarVisita,
    regerarGuiaStreaming,
    atualizarVeiculoNoMapa,
    atualizarPassageiros,
    exportarGpx,
    compartilharWhatsApp,
    limparEstadoAtual,
    atualizarTelemetria,
  };
}
