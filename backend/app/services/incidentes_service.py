"""
ATIVIDADE 07 :: V3 Sistema Viajante com N8N
Coordenação do registro e despacho de incidentes da DLQ.

Módulo: app.services.incidentes_service
Parte da atividade: 02 e 03 - DLQ, alertas e Telegram ChatOps.

Responsabilidades:
    - Persistir falhas inesperadas na DLQ local.
    - Construir eventos padronizados para integração com o n8n.
    - Despachar alertas pelo webhook turismo-dlq.
    - Registrar falhas de comunicação sem perder o incidente local.
    - Retornar o incidente persistido para identificação e rastreabilidade.
    - Disponibilizar o resultado do registro para os endpoints administrativos.

Segurança:
    - Não registra segredos de integração.
    - Preserva o request_id para rastreabilidade.
    - Não envia dados de autenticação no payload do incidente.
"""

import logging

import httpx

from app.schemas.dlq import IncidenteDLQ, RegistroFalhaDLQ
from app.schemas.eventos import EventoIntegracao
from app.services.dlq_service import registrar_incidente
from app.services.n8n_service import enviar_evento

logger = logging.getLogger(__name__)


async def registrar_e_despachar_incidente(
    client: httpx.AsyncClient,
    registro: RegistroFalhaDLQ,
) -> IncidenteDLQ:
    """
    Persiste um incidente e tenta despachá-lo ao n8n.

    A persistência local ocorre antes da comunicação externa. Dessa forma,
    uma indisponibilidade do n8n não elimina o registro da falha.

    Args:
        client: Cliente HTTP assíncrono compartilhado pela aplicação.
        registro: Dados da falha, incluindo request_id e stack trace.

    Returns:
        IncidenteDLQ.
    """

    incidente = await registrar_incidente(registro)

    evento = EventoIntegracao(
        event_id=incidente.event_id or incidente.id,
        event_type="turismo.incidente.criado",
        request_id=incidente.request_id,
        data={
            "incidente_id": str(incidente.id),
            "event_type": incidente.event_type,
            "status": incidente.status.value,
            "error": incidente.error,
            "stack_trace": incidente.stack_trace,
            "payload": incidente.payload,
        },
    )

    try:
        await enviar_evento(client, "turismo-dlq", evento)
    except Exception:
        logger.exception(
            "Falha ao despachar incidente ao n8n. "
            "Incidente preservado na DLQ local. incidente_id=%s request_id=%s",
            incidente.id,
            incidente.request_id,
        )

        return incidente

    return incidente
