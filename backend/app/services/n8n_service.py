"""
ATIVIDADE 07 :: V3 Sistema Viajante com N8N
Cliente HTTP para comunicação com os webhooks do n8n.

Módulo: app.services.n8n_service
Parte da atividade: 01 - Fundação da arquitetura orientada a eventos.

Responsabilidades:
    - Centralizar o envio de eventos ao n8n.
    - Autenticar requisições por meio de segredo compartilhado.
    - Propagar o identificador de correlação X-Request-ID.
    - Serializar eventos no formato JSON.
    - Respeitar o timeout configurado na aplicação.

Dependências:
    - httpx: comunicação HTTP assíncrona.
    - EventoIntegracao: contrato padronizado dos eventos.
    - Settings: configurações da integração.

Segurança:
    O segredo de autenticação é enviado exclusivamente no cabeçalho
    X-N8N-Webhook-Secret e não deve ser registrado nos logs.
"""

import logging

import httpx

from app.core.config import obter_settings
from app.schemas.eventos import EventoIntegracao

logger = logging.getLogger(__name__)


async def enviar_evento(
    client: httpx.AsyncClient,
    webhook: str,
    evento: EventoIntegracao,
) -> None:
    """
    Envia um evento padronizado para um webhook do n8n.

    Args:
        client: Cliente HTTP assíncrono compartilhado pela aplicação.
        webhook: Nome ou caminho do webhook de destino.
        evento: Envelope contendo UUID, tipo, origem, dados e request_id.

    Raises:
        RuntimeError: Quando a URL ou o segredo do n8n não estiver configurado.
        ValueError: Quando o nome do webhook estiver vazio.
        httpx.HTTPError: Quando ocorrer uma falha na comunicação HTTP.
    """

    config = obter_settings()

    if not config.n8n_webhook_url:
        raise RuntimeError("URL dos webhooks do n8n não configurada.")

    if not config.n8n_webhook_secret:
        raise RuntimeError("Segredo de autenticação do n8n não configurado.")

    webhook_base = config.n8n_webhook_url.rstrip("/")
    webhook_nome = webhook.strip().strip("/")

    if not webhook_nome:
        raise ValueError("O nome do webhook não pode ser vazio.")

    url = f"{webhook_base}/{webhook_nome}"

    headers = {
        "X-N8N-Webhook-Secret": config.n8n_webhook_secret,
        "X-Request-ID": str(evento.request_id),
    }

    logger.info(
        "Enviando evento ao n8n. webhook=%s request_id=%s",
        webhook_nome,
        evento.request_id,
    )

    resposta = await client.post(
        url,
        json=evento.model_dump(mode="json"),
        headers=headers,
        timeout=config.n8n_timeout_segundos,
    )

    resposta.raise_for_status()
