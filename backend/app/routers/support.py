"""
ATIVIDADE 07 :: V3 Sistema Viajante com N8N
Endpoints administrativos para operação via Telegram ChatOps.

Módulo: app.routers.support
Parte da atividade: 03 - Telegram ChatOps.

Responsabilidades:
    - Disponibilizar endpoints para consulta do estado operacional.
    - Informar o tempo de atividade da aplicação.
    - Expor indicadores de telemetria para a equipe de suporte.
    - Permitir testes controlados do fluxo de incidentes da DLQ.
    - Restringir o acesso aos endpoints por chave de autenticação.

Segurança:
    - Exige autenticação por meio do cabeçalho X-Support-Key.
    - Não disponibiliza endpoints administrativos sem autorização.
    - Não expõe segredos ou credenciais nas respostas.
    - Preserva o request_id para rastreabilidade dos incidentes.
"""

from time import monotonic
from uuid import uuid4

from fastapi import APIRouter, Request, Response, status

from app.core.dependencies import Config, HttpClient, Sessoes, SuporteAutorizado
from app.core.logging_config import request_id_atual
from app.routers.telemetria import telemetria as obter_telemetria
from app.schemas.dlq import RegistroFalhaDLQ
from app.services.incidentes_service import registrar_e_despachar_incidente

router = APIRouter(prefix="/api/v1/suporte", tags=["Suporte"])


@router.get("/status", summary="Estado operacional da aplicação")
async def consultar_status(
    request: Request,
    response: Response,
    config: Config,
    suporte: SuporteAutorizado,
) -> dict[str, str]:
    """Verifica se os recursos HTTP compartilhados estão disponíveis."""
    cliente = getattr(request.app.state, "http_client", None)
    operacional = cliente is not None and not cliente.is_closed

    if not operacional:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "operacional" if operacional else "indisponivel",
        "aplicacao": config.app_nome,
        "versao": config.app_versao,
    }


@router.get("/uptime", summary="Tempo de atividade da aplicação")
async def consultar_uptime(
    request: Request,
    suporte: SuporteAutorizado,
) -> dict[str, float | str]:
    """Retorna o tempo decorrido desde a inicialização do processo."""
    inicio = getattr(request.app.state, "inicio_monotonic", None)

    if inicio is None:
        return {"status": "indisponivel", "uptime_segundos": 0.0}

    return {
        "status": "ok",
        "uptime_segundos": round(monotonic() - inicio, 2),
    }


@router.get("/telemetria", summary="Indicadores operacionais")
async def consultar_telemetria(
    sessoes: Sessoes,
    suporte: SuporteAutorizado,
) -> dict:
    """Reutiliza o painel de métricas existente, com acesso restrito."""
    return await obter_telemetria(sessoes)


@router.post("/testardlq", summary="Testar o fluxo de incidentes da DLQ")
async def testar_dlq(
    client: HttpClient,
    suporte: SuporteAutorizado,
) -> dict[str, str]:
    """Registra um incidente sintético e tenta despachá-lo ao n8n."""
    request_id = request_id_atual.get() or uuid4().hex

    registro = RegistroFalhaDLQ(
        event_type="turismo.chatops.teste",
        request_id=request_id,
        error="Teste controlado do fluxo de alertas da DLQ.",
        stack_trace="Teste sintético iniciado pela equipe de suporte via Telegram.",
        payload={
            "origem": "telegram-chatops",
            "teste_controlado": True,
        },
    )

    incidente = await registrar_e_despachar_incidente(client, registro)

    return {
        "status": "registrado",
        "mensagem": "Incidente de teste registrado; tentativa de despacho executada.",
        "incidente_id": str(incidente.id),
        "request_id": incidente.request_id,
    }
