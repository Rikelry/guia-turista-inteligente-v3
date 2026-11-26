"""
ATIVIDADE 07 :: V3 Sistema Viajante com N8N
Persistência e gerenciamento dos incidentes da Dead Letter Queue.

Módulo: app.services.dlq_service
Parte da atividade: 02 - DLQ e alertas de incidentes no Telegram.

Responsabilidades:
    - Persistir incidentes em arquivo JSON independente das viagens.
    - Garantir gravações atômicas e operações thread-safe.
    - Controlar tentativas e transições de estado dos incidentes.
    - Permitir consulta e reprocessamento seguro.
    - Preservar registros em caso de corrupção do arquivo.

Dependências:
    - app.core.config: caminho de armazenamento da DLQ.
    - app.schemas.dlq: contratos e estados dos incidentes.

Estratégia de persistência:
    - Operações de disco executadas fora do event loop.
    - Gravação atômica utilizando arquivo temporário e os.replace().
    - Bloqueio de operações concorrentes com threading.Lock.
    - Arquivo corrompido preservado, sem reinicialização silenciosa.
"""

import asyncio
import json
import os
import tempfile
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from app.core.config import obter_settings
from app.schemas.dlq import (
    IncidenteDLQ,
    RegistroFalhaDLQ,
    StatusIncidente,
)

_lock_arquivo = threading.Lock()


def estrutura_padrao() -> dict[str, Any]:
    """
    Retorna a estrutura inicial do armazenamento da DLQ.

    Returns:
        dict[str, Any]: Estrutura versionada para persistência dos incidentes.
    """
    return {
        "versao_schema": "1.0",
        "atualizado_em": datetime.now(UTC).isoformat(),
        "total_incidentes": 0,
        "incidentes": [],
    }


def _arquivo() -> Path:
    """
    Retorna o caminho configurado para persistência da DLQ.

    Returns:
        Path: Caminho do arquivo JSON de incidentes.
    """
    return obter_settings().dlq_arquivo


def _ler() -> dict[str, Any]:
    """
    Lê e valida a estrutura persistida da DLQ.

    Se o arquivo não existir, retorna a estrutura inicial.
    Se houver corrupção JSON, preserva o arquivo original e
    interrompe a operação para evitar perda silenciosa de incidentes.

    Returns:
        dict[str, Any]: Dados persistidos dos incidentes.

    Raises:
        json.JSONDecodeError: Se o arquivo possuir JSON inválido.
        ValueError: Se a estrutura armazenada for inválida.
    """
    caminho = _arquivo()

    try:
        with caminho.open(encoding="utf-8") as arquivo:
            dados = json.load(arquivo)
    except FileNotFoundError:
        return estrutura_padrao()
    except json.JSONDecodeError:
        destino = caminho.with_name(
            f"{caminho.stem}.corrompido-{uuid4()}{caminho.suffix}"
        )
        caminho.rename(destino)
        raise

    if not isinstance(dados, dict):
        raise ValueError("A estrutura da DLQ deve ser um objeto JSON.")

    if not isinstance(dados.get("incidentes"), list):
        raise ValueError("O campo incidentes deve ser uma lista.")

    if dados.get("versao_schema") != "1.0":
        raise ValueError("Versão de armazenamento da DLQ não suportada.")

    for incidente in dados["incidentes"]:
        IncidenteDLQ.model_validate(incidente)

    return dados


def _gravar(dados: dict[str, Any]) -> None:
    """
    Persiste os dados da DLQ utilizando gravação atômica.

    Atualiza os metadados, escreve em arquivo temporário e substitui
    o arquivo definitivo somente após concluir a escrita.

    Args:
        dados: Estrutura completa de armazenamento da DLQ.

    Raises:
        OSError: Se ocorrer falha durante a criação ou gravação do arquivo.
    """
    caminho = _arquivo()
    caminho.parent.mkdir(parents=True, exist_ok=True)

    dados["total_incidentes"] = len(dados["incidentes"])
    dados["atualizado_em"] = datetime.now(UTC).isoformat()

    descritor, temporario = tempfile.mkstemp(
        dir=caminho.parent,
        prefix=".dlq-",
        suffix=".tmp",
    )

    try:
        with os.fdopen(descritor, "w", encoding="utf-8") as arquivo:
            json.dump(
                dados,
                arquivo,
                ensure_ascii=False,
                indent=2,
            )
            arquivo.flush()
            os.fsync(arquivo.fileno())

        os.replace(temporario, caminho)

    except BaseException:
        Path(temporario).unlink(missing_ok=True)
        raise


def _registrar(registro: RegistroFalhaDLQ) -> IncidenteDLQ:
    """
    Registra um novo incidente na DLQ de forma thread-safe.

    Args:
        registro: Dados da falha que originou o incidente.

    Returns:
        IncidenteDLQ: Incidente criado e persistido.
    """
    incidente = IncidenteDLQ(**registro.model_dump())

    with _lock_arquivo:
        dados = _ler()
        dados["incidentes"].append(
            incidente.model_dump(mode="json")
        )
        _gravar(dados)

    return incidente


async def registrar_incidente(
    registro: RegistroFalhaDLQ,
) -> IncidenteDLQ:
    """
    Registra um incidente sem bloquear o event loop do FastAPI.

    Args:
        registro: Dados da falha que originou o incidente.

    Returns:
        IncidenteDLQ: Incidente criado e persistido.
    """
    return await asyncio.to_thread(_registrar, registro)


def _listar_incidentes(
    status: StatusIncidente | None = None,
) -> list[IncidenteDLQ]:
    """
    Lista os incidentes persistidos, opcionalmente filtrando pelo estado.

    Args:
        status: Estado utilizado para filtrar os incidentes.

    Returns:
        list[IncidenteDLQ]: Incidentes encontrados.
    """
    with _lock_arquivo:
        dados = _ler()

        incidentes = [
            IncidenteDLQ.model_validate(item)
            for item in dados["incidentes"]
        ]

    if status is not None:
        incidentes = [
            incidente
            for incidente in incidentes
            if incidente.status == status
        ]

    return incidentes


async def listar_incidentes(
    status: StatusIncidente | None = None,
) -> list[IncidenteDLQ]:
    """
    Lista incidentes sem bloquear o event loop.

    Args:
        status: Estado opcional para filtragem.

    Returns:
        list[IncidenteDLQ]: Incidentes encontrados.
    """
    return await asyncio.to_thread(_listar_incidentes, status)


def _obter_incidente(incidente_id: UUID) -> IncidenteDLQ | None:
    """
    Busca um incidente pelo identificador UUID.

    Args:
        incidente_id: Identificador do incidente.

    Returns:
        IncidenteDLQ | None: Incidente encontrado ou None.
    """
    with _lock_arquivo:
        dados = _ler()

        for item in dados["incidentes"]:
            if item.get("id") == str(incidente_id):
                return IncidenteDLQ.model_validate(item)

    return None


async def obter_incidente(
    incidente_id: UUID,
) -> IncidenteDLQ | None:
    """
    Busca um incidente sem bloquear o event loop.

    Args:
        incidente_id: Identificador do incidente.

    Returns:
        IncidenteDLQ | None: Incidente encontrado ou None.
    """
    return await asyncio.to_thread(_obter_incidente, incidente_id)


def _iniciar_reprocessamento(
    incidente_id: UUID,
) -> IncidenteDLQ | None:
    """
    Reserva um incidente para reprocessamento.

    A leitura, a validação e a gravação são realizadas sob o mesmo
    bloqueio para impedir que duas operações reservem o incidente.

    Args:
        incidente_id: Identificador UUID do incidente.

    Returns:
        IncidenteDLQ | None: Incidente atualizado ou None se não puder
            ser iniciado.
    """
    with _lock_arquivo:
        dados = _ler()

        for indice, item in enumerate(dados["incidentes"]):
            if item.get("id") != str(incidente_id):
                continue

            incidente = IncidenteDLQ.model_validate(item)

            if incidente.status != StatusIncidente.PENDING:
                return None

            if incidente.attempts >= incidente.max_attempts:
                incidente.status = StatusIncidente.FAILED
                incidente.updated_at = datetime.now(UTC)
            else:
                incidente.status = StatusIncidente.PROCESSING
                incidente.attempts += 1
                incidente.updated_at = datetime.now(UTC)

            dados["incidentes"][indice] = incidente.model_dump(mode="json")
            _gravar(dados)

            if incidente.status == StatusIncidente.FAILED:
                return None

            return incidente

    return None


async def iniciar_reprocessamento(
    incidente_id: UUID,
) -> IncidenteDLQ | None:
    """
    Inicia o reprocessamento sem bloquear o event loop.

    Args:
        incidente_id: Identificador UUID do incidente.

    Returns:
        IncidenteDLQ | None: Incidente reservado ou None se não puder
            ser iniciado.
    """
    return await asyncio.to_thread(
        _iniciar_reprocessamento,
        incidente_id,
    )


def _finalizar_reprocessamento(
    incidente_id: UUID,
    sucesso: bool,
    error: str | None = None,
    stack_trace: str | None = None,
) -> IncidenteDLQ | None:
    """
    Finaliza uma tentativa de reprocessamento.

    Args:
        incidente_id: Identificador do incidente.
        sucesso: Indica se o processamento foi concluído.
        error: Mensagem da nova falha, quando aplicável.
        stack_trace: Rastreamento da nova falha, quando aplicável.

    Returns:
        IncidenteDLQ | None: Incidente atualizado ou None se não
            estiver em processamento ou não existir.
    """
    with _lock_arquivo:
        dados = _ler()

        for indice, item in enumerate(dados["incidentes"]):
            if item.get("id") != str(incidente_id):
                continue

            incidente = IncidenteDLQ.model_validate(item)

            if incidente.status != StatusIncidente.PROCESSING:
                return None

            if sucesso:
                incidente.status = StatusIncidente.RESOLVED
            else:
                incidente.error = error or incidente.error
                incidente.stack_trace = stack_trace or incidente.stack_trace

                if incidente.attempts >= incidente.max_attempts:
                    incidente.status = StatusIncidente.FAILED
                else:
                    incidente.status = StatusIncidente.PENDING

            incidente.updated_at = datetime.now(UTC)

            dados["incidentes"][indice] = incidente.model_dump(mode="json")
            _gravar(dados)

            return incidente

    return None


async def finalizar_reprocessamento(
    incidente_id: UUID,
    sucesso: bool,
    error: str | None = None,
    stack_trace: str | None = None,
) -> IncidenteDLQ | None:
    """
    Finaliza uma tentativa sem bloquear o event loop.

    Args:
        incidente_id: Identificador do incidente.
        sucesso: Indica se o processamento foi concluído.
        error: Mensagem da nova falha, quando aplicável.
        stack_trace: Rastreamento da nova falha, quando aplicável.

    Returns:
        IncidenteDLQ | None: Incidente atualizado ou None.
    """
    return await asyncio.to_thread(
        _finalizar_reprocessamento,
        incidente_id,
        sucesso,
        error,
        stack_trace,
    )
