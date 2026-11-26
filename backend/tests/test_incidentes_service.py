"""Testes da coordenação de incidentes e despacho ao n8n."""

import asyncio
from uuid import UUID

import httpx
import pytest

from app.schemas.dlq import IncidenteDLQ, RegistroFalhaDLQ
from app.services import incidentes_service


def test_registra_incidente_e_envia_evento_ao_n8n(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Confirma persistência, ordem de execução e rastreabilidade do evento."""

    registro = RegistroFalhaDLQ(
        event_type="turismo.roteiro.processar",
        request_id="abc-123",
        error="Falha de processamento",
        stack_trace="Traceback: erro de teste",
        payload={"roteiro_id": "roteiro-001"},
    )

    incidente = IncidenteDLQ(**registro.model_dump())
    chamadas: list[str] = []
    eventos_enviados = []

    async def registrar(registro_recebido: RegistroFalhaDLQ) -> IncidenteDLQ:
        chamadas.append("persistencia")
        assert registro_recebido.request_id == "abc-123"
        return incidente

    async def enviar(
        client: httpx.AsyncClient,
        webhook: str,
        evento,
    ) -> None:
        chamadas.append("n8n")
        assert webhook == "turismo-dlq"
        eventos_enviados.append(evento)

    monkeypatch.setattr(incidentes_service, "registrar_incidente", registrar)
    monkeypatch.setattr(incidentes_service, "enviar_evento", enviar)

    async def cenario() -> None:
        async with httpx.AsyncClient() as client:
            await incidentes_service.registrar_e_despachar_incidente(client, registro)

    asyncio.run(cenario())

    assert chamadas == ["persistencia", "n8n"]
    assert len(eventos_enviados) == 1

    evento = eventos_enviados[0]
    assert isinstance(evento.event_id, UUID)
    assert evento.event_type == "turismo.incidente.criado"
    assert evento.request_id == "abc-123"
    assert evento.data["incidente_id"] == str(incidente.id)
    assert evento.data["error"] == "Falha de processamento"
    assert evento.data["stack_trace"] == "Traceback: erro de teste"
    assert evento.data["payload"] == {"roteiro_id": "roteiro-001"}


def test_falha_no_n8n_preserva_incidente_local(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Uma falha no webhook não deve apagar o incidente nem propagar exceção."""

    registro = RegistroFalhaDLQ(
        event_type="turismo.roteiro.processar",
        request_id="abc-456",
        error="Falha de processamento",
        stack_trace="Traceback: erro de teste",
        payload={"roteiro_id": "roteiro-002"},
    )

    incidente = IncidenteDLQ(**registro.model_dump())
    persistido = False

    async def registrar(registro_recebido: RegistroFalhaDLQ) -> IncidenteDLQ:
        nonlocal persistido
        persistido = True
        return incidente

    async def enviar(
        client: httpx.AsyncClient,
        webhook: str,
        evento,
    ) -> None:
        assert persistido is True
        raise httpx.ConnectError("n8n indisponível")

    monkeypatch.setattr(incidentes_service, "registrar_incidente", registrar)
    monkeypatch.setattr(incidentes_service, "enviar_evento", enviar)

    async def cenario() -> None:
        async with httpx.AsyncClient() as client:
            await incidentes_service.registrar_e_despachar_incidente(client, registro)

    asyncio.run(cenario())

    assert persistido is True
    assert incidente.request_id == "abc-456"
