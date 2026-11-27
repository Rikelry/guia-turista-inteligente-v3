import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  buscarCoordenadaCatalogo,
  CIDADES_AUTOCOMPLETE,
  obterPosicaoAtualNavegador,
  sugerirDestinosAcimaDe400Km,
  type SugestaoDestino,
} from "../services/geolocation.ts";
import {
  DEFAULT_VEICULO_COMBUSTAO,
  DEFAULT_VEICULO_ELETRICO,
  ESTADOS_BRASIL,
  LISTA_UFS,
  normalizarUf,
  PERFIS_VIAJANTE,
  sanitizarCidade,
  validarRoteiroForm,
  type Coordenada,
  type DestinoCatalogo,
  type EstiloViagem,
  type PreferenciaRota,
  type Propulsao,
  type RoteiroRequest,
  type UfBrasil,
  type Veiculo,
} from "../types/schemas.ts";

export interface RoteiroFormProps {
  destinosCatalogo: readonly DestinoCatalogo[];
  planejando: boolean;
  onPlanejar: (payload: RoteiroRequest) => Promise<void>;
  onCancelar: () => void;
}

const DIAS_OPCOES = [1, 2, 3, 4, 5] as const;

export function RoteiroForm({
  destinosCatalogo,
  planejando,
  onPlanejar,
  onCancelar,
}: RoteiroFormProps) {
  const [origemCidade, setOrigemCidade] = useState("Piripiri");
  const [origemUf, setOrigemUf] = useState<UfBrasil>("PI");
  const [destinoCidade, setDestinoCidade] = useState("Natal");
  const [destinoUf, setDestinoUf] = useState<UfBrasil>("RN");

  const [propulsao, setPropulsao] = useState<Propulsao>("combustao");
  const [mostrarAvancado, setMostrarAvancado] = useState(false);

  const [consumoKmL, setConsumoKmL] = useState(DEFAULT_VEICULO_COMBUSTAO.consumo_km_l);
  const [tanqueLitros, setTanqueLitros] = useState(DEFAULT_VEICULO_COMBUSTAO.tanque_litros);
  const [precoLitro, setPrecoLitro] = useState(DEFAULT_VEICULO_COMBUSTAO.preco_litro);

  const [eficienciaKmKwh, setEficienciaKmKwh] = useState(
    DEFAULT_VEICULO_ELETRICO.eficiencia_km_kwh,
  );
  const [bateriaKwh, setBateriaKwh] = useState(DEFAULT_VEICULO_ELETRICO.bateria_kwh);
  const [precoKwh, setPrecoKwh] = useState(DEFAULT_VEICULO_ELETRICO.preco_kwh);

  const [diasEstadia, setDiasEstadia] = useState<number>(1);
  const [perfisSelecionados, setPerfisSelecionados] = useState<EstiloViagem[]>([
    "cultural",
    "gastronomico",
  ]);
  const [preferenciaRota, setPreferenciaRota] = useState<PreferenciaRota>("rapida");
  const [passageiros, setPassageiros] = useState<number>(1);

  const [gpsCoord, setGpsCoord] = useState<Coordenada | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    let ativo = true;
    void obterPosicaoAtualNavegador().then((coord) => {
      if (ativo && coord) {
        setGpsCoord(coord);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  const referenciaCoord = useMemo<Coordenada>(() => {
    const daOrigem = buscarCoordenadaCatalogo(origemCidade, origemUf, destinosCatalogo);
    if (daOrigem) return daOrigem;
    if (gpsCoord) return gpsCoord;
    return { lat: -4.272, lon: -41.777 }; // Piripiri - PI padrão
  }, [destinosCatalogo, gpsCoord, origemCidade, origemUf]);

  const sugestoes = useMemo<SugestaoDestino[]>(
    () => sugerirDestinosAcimaDe400Km(referenciaCoord, destinosCatalogo, 400, 4),
    [destinosCatalogo, referenciaCoord],
  );

  const cidadesDatalist = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const item of CIDADES_AUTOCOMPLETE) {
      mapa.set(item.cidade.toLowerCase(), item.cidade);
    }
    for (const item of destinosCatalogo) {
      mapa.set(item.cidade.toLowerCase(), item.cidade);
    }
    return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [destinosCatalogo]);

  const montarVeiculo = (): Veiculo =>
    propulsao === "combustao"
      ? {
          propulsao: "combustao",
          consumo_km_l: consumoKmL,
          tanque_litros: tanqueLitros,
          preco_litro: precoLitro,
        }
      : {
          propulsao: "eletrico",
          eficiencia_km_kwh: eficienciaKmKwh,
          bateria_kwh: bateriaKwh,
          preco_kwh: precoKwh,
        };

  const alternarPerfil = (perfil: EstiloViagem): void => {
    setPerfisSelecionados((prev) => {
      if (prev.includes(perfil)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== perfil);
      }
      return [...prev, perfil];
    });
  };

  const selecionarSugestao = (sugestao: SugestaoDestino): void => {
    setDestinoCidade(sugestao.cidade);
    setDestinoUf(sugestao.uf);
    setErros((prev) => {
      const copia = { ...prev };
      delete copia.destino_cidade;
      delete copia.destino_uf;
      return copia;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (planejando) return;

    const veiculo = montarVeiculo();
    const validacao = validarRoteiroForm({
      origem_cidade: origemCidade,
      origem_uf: origemUf,
      destino_cidade: destinoCidade,
      destino_uf: destinoUf,
      dias_estadia: diasEstadia,
      passageiros,
      veiculo,
    });

    if (!validacao.valido) {
      setErros(validacao.erros);
      return;
    }

    setErros({});
    const estiloPrincipal = perfisSelecionados[0] ?? "cultural";
    const ufO = normalizarUf(origemUf) ?? "PI";
    const ufD = normalizarUf(destinoUf) ?? "RN";

    void onPlanejar({
      origem_cidade: sanitizarCidade(origemCidade),
      origem_uf: ufO,
      destino_cidade: sanitizarCidade(destinoCidade),
      destino_uf: ufD,
      dias_estadia: diasEstadia,
      estilo_viagem: estiloPrincipal,
      preferencia_rota: preferenciaRota,
      passageiros,
      veiculo,
    });
  };

  return (
    <section className="card planner-card" aria-labelledby="planner-heading">
      <div className="section-head">
        <h2 id="planner-heading" className="section-title">
          <span aria-hidden="true">🗺️</span> Planejador de Viagens
        </h2>
        <p className="section-subtitle">
          Roteiro inteligente com mapa rodoviário, paradas e custos.
        </p>
      </div>

      <form className="planner-form" onSubmit={handleSubmit} noValidate>
        <datalist id="cidades-brasil-list">
          {cidadesDatalist.map((cidade) => (
            <option key={cidade} value={cidade} />
          ))}
        </datalist>

        <div className="city-uf-row">
          <div className="form-field">
            <label htmlFor="origem-cidade" className="form-label">
              Cidade de Origem
            </label>
            <input
              id="origem-cidade"
              name="origem_cidade"
              type="text"
              list="cidades-brasil-list"
              className={`form-input ${erros.origem_cidade ? "is-invalid" : ""}`}
              placeholder="Ex.: Piripiri"
              value={origemCidade}
              onChange={(e) => setOrigemCidade(e.target.value)}
              disabled={planejando}
              required
              autoComplete="off"
            />
            {erros.origem_cidade && (
              <span className="field-error" role="alert">
                {erros.origem_cidade}
              </span>
            )}
          </div>

          <div className="form-field form-field-uf">
            <label htmlFor="origem-uf" className="form-label">
              UF
            </label>
            <select
              id="origem-uf"
              name="origem_uf"
              className="form-select"
              value={origemUf}
              onChange={(e) => {
                const uf = normalizarUf(e.target.value);
                if (uf) setOrigemUf(uf);
              }}
              disabled={planejando}
            >
              {LISTA_UFS.map((uf) => (
                <option key={uf} value={uf} title={ESTADOS_BRASIL[uf]}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="city-uf-row">
          <div className="form-field">
            <label htmlFor="destino-cidade" className="form-label">
              Cidade de Destino
            </label>
            <input
              id="destino-cidade"
              name="destino_cidade"
              type="text"
              list="cidades-brasil-list"
              className={`form-input ${erros.destino_cidade ? "is-invalid" : ""}`}
              placeholder="Ex.: Natal"
              value={destinoCidade}
              onChange={(e) => setDestinoCidade(e.target.value)}
              disabled={planejando}
              required
              autoComplete="off"
            />
            {erros.destino_cidade && (
              <span className="field-error" role="alert">
                {erros.destino_cidade}
              </span>
            )}
          </div>

          <div className="form-field form-field-uf">
            <label htmlFor="destino-uf" className="form-label">
              UF
            </label>
            <select
              id="destino-uf"
              name="destino_uf"
              className="form-select"
              value={destinoUf}
              onChange={(e) => {
                const uf = normalizarUf(e.target.value);
                if (uf) setDestinoUf(uf);
              }}
              disabled={planejando}
            >
              {LISTA_UFS.map((uf) => (
                <option key={uf} value={uf} title={ESTADOS_BRASIL[uf]}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="suggestions-block">
          <div className="suggestions-header">
            <span className="form-label">Sugestões (acima de 400 km):</span>
            {gpsCoord && (
              <span className="gps-badge" title="Distâncias geodésicas calculadas com Haversine">
                📡 GPS ativo
              </span>
            )}
          </div>
          <div className="suggestions-grid" role="group" aria-label="Destinos sugeridos">
            {sugestoes.map((sug) => {
              const ativo =
                sug.cidade.toLowerCase() === sanitizarCidade(destinoCidade).toLowerCase() &&
                sug.uf === destinoUf;
              return (
                <button
                  key={`${sug.cidade}-${sug.uf}`}
                  type="button"
                  className={`suggestion-chip ${ativo ? "is-active" : ""}`}
                  onClick={() => selecionarSugestao(sug)}
                  disabled={planejando}
                  title={sug.resumo}
                >
                  <span aria-hidden="true">🚗</span>
                  <span className="suggestion-name">
                    {sug.cidade} ({sug.uf})
                  </span>
                  <span className="suggestion-distance">📍 {sug.distanciaKm} km</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="vehicle-block">
          <span className="form-label">Tipo de Veículo:</span>
          <div
            className="vehicle-cards"
            role="radiogroup"
            aria-label="Tipo de propulsão do veículo"
          >
            <button
              type="button"
              role="radio"
              aria-checked={propulsao === "combustao"}
              className={`vehicle-option-card ${propulsao === "combustao" ? "is-selected" : ""}`}
              onClick={() => setPropulsao("combustao")}
              disabled={planejando}
            >
              <span className="vehicle-option-icon" aria-hidden="true">
                ⛽
              </span>
              <span className="vehicle-option-text">
                <strong>Combustão</strong>
                <small>Gasolina, etanol ou diesel</small>
              </span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={propulsao === "eletrico"}
              className={`vehicle-option-card ${propulsao === "eletrico" ? "is-selected" : ""}`}
              onClick={() => setPropulsao("eletrico")}
              disabled={planejando}
            >
              <span className="vehicle-option-icon" aria-hidden="true">
                ⚡
              </span>
              <span className="vehicle-option-text">
                <strong>100% Elétrico</strong>
                <small>Eletropostos e recarga</small>
              </span>
            </button>
          </div>

          <button
            type="button"
            className="advanced-toggle-btn"
            onClick={() => setMostrarAvancado((prev) => !prev)}
            aria-expanded={mostrarAvancado}
          >
            <span aria-hidden="true">⚙️</span> Personalizar Parâmetros de Consumo e Preço{" "}
            <span aria-hidden="true">{mostrarAvancado ? "▴" : "▾"}</span>
          </button>

          {mostrarAvancado && (
            <div className="advanced-params-panel">
              {propulsao === "combustao" ? (
                <div className="params-grid">
                  <div className="form-field">
                    <label htmlFor="consumo-kml" className="form-label-sm">
                      Consumo (km/l)
                    </label>
                    <input
                      id="consumo-kml"
                      type="number"
                      step="0.5"
                      min="1"
                      max="50"
                      className="form-input form-input-sm"
                      value={consumoKmL}
                      onChange={(e) => setConsumoKmL(Number(e.target.value))}
                      disabled={planejando}
                    />
                    {erros.consumo_km_l && (
                      <span className="field-error">{erros.consumo_km_l}</span>
                    )}
                  </div>
                  <div className="form-field">
                    <label htmlFor="tanque-litros" className="form-label-sm">
                      Tanque (L)
                    </label>
                    <input
                      id="tanque-litros"
                      type="number"
                      step="1"
                      min="10"
                      max="200"
                      className="form-input form-input-sm"
                      value={tanqueLitros}
                      onChange={(e) => setTanqueLitros(Number(e.target.value))}
                      disabled={planejando}
                    />
                    {erros.tanque_litros && (
                      <span className="field-error">{erros.tanque_litros}</span>
                    )}
                  </div>
                  <div className="form-field">
                    <label htmlFor="preco-litro" className="form-label-sm">
                      Preço (R$/L)
                    </label>
                    <input
                      id="preco-litro"
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="20"
                      className="form-input form-input-sm"
                      value={precoLitro}
                      onChange={(e) => setPrecoLitro(Number(e.target.value))}
                      disabled={planejando}
                    />
                    {erros.preco_litro && <span className="field-error">{erros.preco_litro}</span>}
                  </div>
                </div>
              ) : (
                <div className="params-grid">
                  <div className="form-field">
                    <label htmlFor="eficiencia-kwh" className="form-label-sm">
                      Eficiência (km/kWh)
                    </label>
                    <input
                      id="eficiencia-kwh"
                      type="number"
                      step="0.5"
                      min="1"
                      max="15"
                      className="form-input form-input-sm"
                      value={eficienciaKmKwh}
                      onChange={(e) => setEficienciaKmKwh(Number(e.target.value))}
                      disabled={planejando}
                    />
                    {erros.eficiencia_km_kwh && (
                      <span className="field-error">{erros.eficiencia_km_kwh}</span>
                    )}
                  </div>
                  <div className="form-field">
                    <label htmlFor="bateria-kwh" className="form-label-sm">
                      Bateria (kWh)
                    </label>
                    <input
                      id="bateria-kwh"
                      type="number"
                      step="5"
                      min="10"
                      max="250"
                      className="form-input form-input-sm"
                      value={bateriaKwh}
                      onChange={(e) => setBateriaKwh(Number(e.target.value))}
                      disabled={planejando}
                    />
                    {erros.bateria_kwh && <span className="field-error">{erros.bateria_kwh}</span>}
                  </div>
                  <div className="form-field">
                    <label htmlFor="preco-kwh" className="form-label-sm">
                      Tarifa (R$/kWh)
                    </label>
                    <input
                      id="preco-kwh"
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      className="form-input form-input-sm"
                      value={precoKwh}
                      onChange={(e) => setPrecoKwh(Number(e.target.value))}
                      disabled={planejando}
                    />
                    {erros.preco_kwh && <span className="field-error">{erros.preco_kwh}</span>}
                  </div>
                </div>
              )}

              <div className="params-grid params-grid-2">
                <div className="form-field">
                  <label htmlFor="preferencia-rota" className="form-label-sm">
                    Preferência de Rota
                  </label>
                  <select
                    id="preferencia-rota"
                    className="form-select form-input-sm"
                    value={preferenciaRota}
                    onChange={(e) =>
                      setPreferenciaRota(e.target.value === "economica" ? "economica" : "rapida")
                    }
                    disabled={planejando}
                  >
                    <option value="rapida">Menor tempo (Mais rápida)</option>
                    <option value="economica">Menor distância (Mais econômica)</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="qtd-passageiros" className="form-label-sm">
                    Passageiros (1 a 8)
                  </label>
                  <input
                    id="qtd-passageiros"
                    type="number"
                    min="1"
                    max="8"
                    className="form-input form-input-sm"
                    value={passageiros}
                    onChange={(e) =>
                      setPassageiros(Math.max(1, Math.min(8, Number(e.target.value) || 1)))
                    }
                    disabled={planejando}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="preferences-box">
          <div className="pref-group">
            <span className="form-label">Duração da Viagem:</span>
            <div className="days-pills" role="radiogroup" aria-label="Duração da viagem em dias">
              {DIAS_OPCOES.map((dia) => (
                <button
                  key={dia}
                  type="button"
                  role="radio"
                  aria-checked={diasEstadia === dia}
                  className={`day-pill ${diasEstadia === dia ? "is-active" : ""}`}
                  onClick={() => setDiasEstadia(dia)}
                  disabled={planejando}
                >
                  {dia} {dia === 1 ? "dia" : "dias"}
                </button>
              ))}
            </div>
          </div>

          <div className="pref-group">
            <span className="form-label">Perfil do Viajante (de 1 a todos):</span>
            <div className="profiles-pills" role="group" aria-label="Perfil do viajante">
              {PERFIS_VIAJANTE.map((perfil) => {
                const selecionado = perfisSelecionados.includes(perfil.id);
                return (
                  <button
                    key={perfil.id}
                    type="button"
                    aria-pressed={selecionado}
                    className={`profile-pill ${selecionado ? "is-selected" : ""}`}
                    onClick={() => alternarPerfil(perfil.id)}
                    disabled={planejando}
                  >
                    <span aria-hidden="true">{perfil.icone}</span> {perfil.rotuloCurto}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="planner-submit-area">
          <button
            type="submit"
            className={`btn-primary-submit ${planejando ? "is-loading" : ""}`}
            disabled={planejando}
            aria-busy={planejando}
          >
            {planejando ? (
              <>
                <span className="spinner-inline" aria-hidden="true" />
                <span>Planejando Viagem...</span>
              </>
            ) : (
              <>
                <span aria-hidden="true">🚀</span>
                <span>Planejar Viagem</span>
              </>
            )}
          </button>

          {planejando && (
            <button type="button" className="btn-cancel-plan" onClick={onCancelar}>
              ✕ Cancelar
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
