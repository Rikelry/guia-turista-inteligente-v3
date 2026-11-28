"""Integração com a API pública de revendedores de combustíveis da ANP."""

import logging
import math
from datetime import date, datetime
from typing import Any

import httpx

from app.core.cache import cache
from app.core.catalogo import haversine_km
from app.core.config import obter_settings
from app.schemas.roteiros import PostoCombustivel


logger = logging.getLogger(__name__)

# Cache dos dados cadastrais da ANP por seis horas.
TTL_ANP_SEGUNDOS = 6 * 60 * 60

# Limites para a busca de postos próximos à rota.
RAIO_POSTOS_ROTA_KM = 10.0
MAX_POSTOS_POR_ROTA = 20


def _texto(valor: Any) -> str | None:
    """Converte valores da ANP em texto, ignorando campos vazios."""
    if valor is None:
        return None

    resultado = str(valor).strip()
    return resultado or None


def _normalizar_coordenada(valor: Any) -> float:
    """Converte coordenadas decimais ou DMS para graus decimais."""
    texto = _texto(valor)

    if texto is None:
        raise ValueError("Coordenada ausente.")

    try:
        return float(texto.replace(",", "."))
    except ValueError:
        partes = texto.split(":")

        if len(partes) != 3:
            raise ValueError("Formato de coordenada inválido.")

        graus = float(partes[0].replace(",", "."))
        minutos = float(partes[1].replace(",", "."))
        segundos = float(partes[2].replace(",", "."))

        if not (0 <= minutos < 60 and 0 <= segundos < 60):
            raise ValueError("Minutos ou segundos inválidos.")

        sinal = -1 if texto.startswith("-") else 1

        return sinal * (
            abs(graus) + minutos / 60 + segundos / 3600
        )

def _normalizar_data(valor: Any) -> date | None:
    """Converte datas da ANP para date."""
    texto = _texto(valor)
    if not texto:
        return None

    for formato in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(texto, formato).date()
        except ValueError:
            continue

    return None


def _normalizar_posto(dados: dict[str, Any]) -> PostoCombustivel | None:
    """Converte um registro cadastral da ANP em um posto do sistema."""
    try:
        latitude = dados.get("latitude")
        longitude = dados.get("longitude")

        if latitude is None:
            latitude = dados.get("latitude_ANP4C")

        if longitude is None:
            longitude = dados.get("longitude_ANP4C")

        if latitude is None or longitude is None:
            return None

        endereco_partes = [
            _texto(dados.get(campo))
            for campo in ("endereco", "complemento", "bairro")
        ]
        endereco = ", ".join(parte for parte in endereco_partes if parte)

        produtos = dados.get("produtos") or []
        combustiveis = [
            produto
            for item in produtos
            if isinstance(item, dict)
            if (produto := _texto(item.get("produto")))
        ]

        return PostoCombustivel(
            cnpj=str(dados["cnpj"]),
            razao_social=str(dados["razaoSocial"]),
            nome_fantasia=None,
            bandeira=_texto(dados.get("distribuidora")),
            endereco=endereco or None,
            municipio=_texto(dados.get("municipio")),
            uf=str(dados["uf"]).upper(),
            lat=_normalizar_coordenada(latitude),
            lon=_normalizar_coordenada(longitude),
            status_sigaf=_texto(dados.get("statusSIGAF")),
            validacao_geografica=_texto(dados.get("validacao")),
            data_publicacao=_normalizar_data(dados.get("dataPublicacao")),
            combustiveis=combustiveis,
            distancia_rota_km=0,
            avaliacao=None,
        )
    except (KeyError, TypeError, ValueError):
        logger.warning("Registro da ANP ignorado por conter dados inválidos.")
        return None


async def obter_cadastro_anp(client: httpx.AsyncClient) -> list[PostoCombustivel]:
    """Obtém o cadastro de postos da ANP, utilizando cache e paginação."""
    chave_cache = ("anp", "cadastro_combustiveis")
    dados_cache = cache.obter(chave_cache)

    if dados_cache is not None:
        return dados_cache

    config = obter_settings()
    postos: list[PostoCombustivel] = []

    pagina = 1
    total_paginas = 1

    while pagina <= total_paginas:
        resposta = await client.get(
            config.anp_api_url,
            params={"numeropagina": pagina},
            timeout=config.anp_timeout_segundos,
        )
        resposta.raise_for_status()

        resultado = resposta.json()
        registros = resultado["data"]
        filtro = resultado.get("searchPageFilter") or {}
        total_paginas = int(filtro.get("totalPagina") or 1)

        if not isinstance(registros, list):
            raise ValueError("Formato inesperado na resposta da API ANP.")

        for registro in registros:
            if isinstance(registro, dict):
                posto = _normalizar_posto(registro)
                if posto is not None:
                    postos.append(posto)

        pagina += 1

    cache.definir(chave_cache, postos, ttl=TTL_ANP_SEGUNDOS)
    logger.info("Cadastro ANP atualizado: %d postos.", len(postos))

    return postos


def _distancia_ponto_segmento_km(
    ponto: tuple[float, float],
    inicio: tuple[float, float],
    fim: tuple[float, float],
) -> float:
    """Calcula a distância de um ponto ao segmento mais próximo da rota."""
    lat, lon = ponto
    lat1, lon1 = inicio
    lat2, lon2 = fim

    lat_media = (lat1 + lat2 + lat) / 3
    escala_x = 111.320 * math.cos(math.radians(lat_media))
    escala_y = 110.574

    px, py = lon * escala_x, lat * escala_y
    ax, ay = lon1 * escala_x, lat1 * escala_y
    bx, by = lon2 * escala_x, lat2 * escala_y

    dx, dy = bx - ax, by - ay
    comprimento = dx * dx + dy * dy

    if comprimento == 0:
        ponto_proximo = inicio
    else:
        proporcao = max(
            0.0,
            min(1.0, ((px - ax) * dx + (py - ay) * dy) / comprimento),
        )
        ponto_proximo = (
            lat1 + proporcao * (lat2 - lat1),
            lon1 + proporcao * (lon2 - lon1),
        )

    return haversine_km(lat, lon, *ponto_proximo)


def _distancia_ate_rota(
    posto: PostoCombustivel,
    geometria: list[tuple[float, float]],
) -> float:
    """Retorna a menor distância entre o posto e a geometria da rota."""
    if not geometria:
        return float("inf")

    if len(geometria) == 1:
        return haversine_km(posto.lat, posto.lon, *geometria[0])

    return min(
        _distancia_ponto_segmento_km(
            (posto.lat, posto.lon),
            geometria[i],
            geometria[i + 1],
        )
        for i in range(len(geometria) - 1)
    )


def _pontuacao_regulatoria(posto: PostoCombustivel) -> tuple[int, int, date]:
    """Prioriza dados geográficos validados e informações cadastrais disponíveis."""
    validacao = (posto.validacao_geografica or "").strip().casefold()
    status = (posto.status_sigaf or "").strip().casefold()

    validado = int(
        validacao in {"validado", "validada", "sim", "true", "válido", "valido"}
    )

    # A presença do status é apenas um critério cadastral, não prova de atividade.
    status_informado = int(bool(status))

    # Prioriza datas de publicação mais antigas, quando disponíveis.
    data = posto.data_publicacao or date.max

    return validado, status_informado, data


def buscar_postos_proximos(
    postos: list[PostoCombustivel],
    geometria: list[tuple[float, float]],
) -> list[PostoCombustivel]:
    """Filtra e ordena postos próximos à rota."""
    if not geometria:
        return []

    proximos: list[PostoCombustivel] = []

    for posto in postos:
        distancia = _distancia_ate_rota(posto, geometria)

        if distancia <= RAIO_POSTOS_ROTA_KM:
            proximos.append(
                posto.model_copy(
                    update={"distancia_rota_km": round(distancia, 2)}
                )
            )

    proximos.sort(
        key=lambda posto: (
            -_pontuacao_regulatoria(posto)[0],
            -_pontuacao_regulatoria(posto)[1],
            _pontuacao_regulatoria(posto)[2],
            posto.distancia_rota_km,
        )
    )

    return proximos[:MAX_POSTOS_POR_ROTA]
