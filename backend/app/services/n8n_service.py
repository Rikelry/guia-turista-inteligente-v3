"""
Serviço de integração HTTP com os webhooks do n8n.
"""

import logging

import httpx

from app.core.config import obter_settings

logger = logging.getLogger(__name__)


async def enviar_evento(
    client: httpx.AsyncClient,
    webhook: str,
    evento: dict[str, object],
    request_id: str,
) -> None:
    """
    Envia um evento JSON para um webhook do n8n.
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
        "X-Request-ID": request_id,
    }

    logger.info(
        "Enviando evento ao n8n. webhook=%s request_id=%s",
        webhook_nome,
        request_id,
    )

    resposta = await client.post(
        url,
        json=evento,
        headers=headers,
        timeout=config.n8n_timeout_segundos,
    )

    resposta.raise_for_status()
