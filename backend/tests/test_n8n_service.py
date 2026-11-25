"""
ATIVIDADE 07 :: V3 Sistema Viajante com N8N
Testes automatizados do cliente HTTP de integração com o n8n.

Módulo: tests.test_n8n_service
Parte da atividade: 01 - Fundação da arquitetura orientada a eventos.

Objetivos:
    - Verificar o envio correto de eventos JSON.
    - Validar a URL de destino e os cabeçalhos de autenticação.
    - Garantir a propagação do X-Request-ID.
    - Verificar o comportamento quando faltam configurações.
    - Confirmar a propagação de erros HTTP retornados pelo n8n.
    - Rejeitar nomes de webhook vazios.

Estratégia de testes:
    - Utilização de httpx.MockTransport.
    - Simulação das respostas HTTP sem acesso à internet.
    - Isolamento das configurações por meio do monkeypatch.

Dependências:
    - pytest: execução dos testes.
    - httpx: simulação das requisições HTTP.
    - EventoIntegracao: contrato utilizado nos testes.
    - enviar_evento: serviço submetido à validação.
"""

import asyncio
import json

import httpx
import pytest

from app.core.config import obter_settings
from app.services.n8n_service import enviar_evento
from app.schemas.eventos import EventoIntegracao


def test_enviar_evento_com_sucesso(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("N8N_WEBHOOK_URL", "https://n8n.exemplo.com/webhook")
    monkeypatch.setenv("N8N_WEBHOOK_SECRET", "segredo-teste")
    monkeypatch.setenv("N8N_TIMEOUT_SEGUNDOS", "5")
    obter_settings.cache_clear()

    requisicoes = []

    def responder(request: httpx.Request) -> httpx.Response:
        requisicoes.append(request)
        return httpx.Response(200, json={"status": "recebido"})

    evento = EventoIntegracao(
        event_type="turismo.dlq.incidente",
        request_id="abc-123",
        data={"mensagem": "Falha de teste"},
    )

    async def executar() -> None:
        transport = httpx.MockTransport(responder)

        async with httpx.AsyncClient(transport=transport) as client:
            await enviar_evento(
                client=client,
                webhook="turismo-dlq",
                evento=evento,
            )

    try:
        asyncio.run(executar())
    finally:
        obter_settings.cache_clear()

    assert len(requisicoes) == 1
    request = requisicoes[0]

    assert str(request.url) == "https://n8n.exemplo.com/webhook/turismo-dlq"
    assert request.headers["X-N8N-Webhook-Secret"] == "segredo-teste"
    assert request.headers["X-Request-ID"] == "abc-123"
    corpo_enviado = json.loads(request.read())

    assert corpo_enviado == evento.model_dump(mode="json")


@pytest.mark.parametrize(
    ("variavel", "valor"),
    [
        ("N8N_WEBHOOK_URL", ""),
        ("N8N_WEBHOOK_SECRET", ""),
    ],
)
def test_recusa_envio_sem_configuracao(
    monkeypatch: pytest.MonkeyPatch,
    variavel: str,
    valor: str,
) -> None:
    monkeypatch.setenv("N8N_WEBHOOK_URL", "https://n8n.exemplo.com/webhook")
    monkeypatch.setenv("N8N_WEBHOOK_SECRET", "segredo-teste")
    monkeypatch.setenv(variavel, valor)
    obter_settings.cache_clear()

    async def executar() -> None:
        async with httpx.AsyncClient() as client:
            with pytest.raises(RuntimeError):
                await enviar_evento(
                    client=client,
                    webhook="turismo-dlq",
                    evento=EventoIntegracao(
                        event_type="turismo.dlq.incidente",
                        request_id="abc-123",
                        data={"mensagem": "Falha de teste"},
                    ),
                )

    try:
        asyncio.run(executar())
    finally:
        obter_settings.cache_clear()


def test_propaga_falha_http_do_n8n(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("N8N_WEBHOOK_URL", "https://n8n.exemplo.com/webhook")
    monkeypatch.setenv("N8N_WEBHOOK_SECRET", "segredo-teste")
    obter_settings.cache_clear()

    def responder(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"erro": "falha interna"})

    async def executar() -> None:
        transport = httpx.MockTransport(responder)

        async with httpx.AsyncClient(transport=transport) as client:
            with pytest.raises(httpx.HTTPStatusError):
                await enviar_evento(
                    client=client,
                    webhook="turismo-dlq",
                    evento=EventoIntegracao(
                        event_type="turismo.dlq.incidente",
                        request_id="abc-123",
                        data={"mensagem": "Falha de teste"},
                    ),
                )

    try:
        asyncio.run(executar())
    finally:
        obter_settings.cache_clear()


def test_recusa_nome_de_webhook_vazio(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("N8N_WEBHOOK_URL", "https://n8n.exemplo.com/webhook")
    monkeypatch.setenv("N8N_WEBHOOK_SECRET", "segredo-teste")
    obter_settings.cache_clear()

    async def executar() -> None:
        async with httpx.AsyncClient() as client:
            with pytest.raises(ValueError, match="nome do webhook não pode ser vazio"):
                await enviar_evento(
                    client=client,
                    webhook=" / ",
                    evento=EventoIntegracao(
                        event_type="turismo.dlq.incidente",
                        request_id="abc-123",
                        data={"mensagem": "Falha de teste"},
                    ),
                )

    try:
        asyncio.run(executar())
    finally:
        obter_settings.cache_clear()
