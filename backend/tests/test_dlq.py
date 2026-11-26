"""
ATIVIDADE 07 :: V3 Sistema Viajante com N8N
Testes unitários dos contratos da Dead Letter Queue.

Módulo: tests.test_dlq
Parte da atividade: 02 - DLQ e alertas de incidentes no Telegram.

Objetivos:
    - Validar os estados permitidos para incidentes.
    - Verificar a geração automática de UUID.
    - Garantir o estado e o limite inicial de tentativas.
    - Validar timestamps em UTC.
    - Rejeitar tentativas inválidas.
    - Rejeitar campos adicionais não previstos.
    - Verificar os dados obrigatórios de rastreabilidade.
    - Permitir falhas sem UUID de evento original.

Dependências:
    - pytest: execução e parametrização dos testes.
    - Pydantic: validação dos contratos de dados.
    - StatusIncidente: enumeração dos estados da DLQ.
    - RegistroFalhaDLQ: schema de entrada de falhas.
    - IncidenteDLQ: schema do incidente persistido.
"""

import asyncio
import json
from datetime import UTC, datetime
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.core.config import obter_settings
from app.schemas.dlq import (
    IncidenteDLQ,
    RegistroFalhaDLQ,
    StatusIncidente,
)
from app.services.dlq_service import (
    finalizar_reprocessamento,
    iniciar_reprocessamento,
    listar_incidentes,
    obter_incidente,
    registrar_incidente,
)


@pytest.fixture
def dados_incidente() -> dict:
    """Fornece dados válidos para criação de um incidente da DLQ."""
    return {
        "event_type": "turismo.roteiro.processar",
        "request_id": "abc-123",
        "error": "Falha de processamento",
        "stack_trace": "Traceback: erro de teste",
        "payload": {"roteiro_id": "roteiro-001"},
    }


def test_gera_uuid_automaticamente(dados_incidente: dict) -> None:
    incidente = IncidenteDLQ(**dados_incidente)

    assert isinstance(incidente.id, UUID)


def test_cada_incidente_recebe_uuid_diferente(dados_incidente: dict) -> None:
    incidente_1 = IncidenteDLQ(**dados_incidente)
    incidente_2 = IncidenteDLQ(**dados_incidente)

    assert incidente_1.id != incidente_2.id


def test_estado_inicial_e_pending(dados_incidente: dict) -> None:
    incidente = IncidenteDLQ(**dados_incidente)

    assert incidente.status == StatusIncidente.PENDING


def test_tentativas_iniciam_com_zero(dados_incidente: dict) -> None:
    incidente = IncidenteDLQ(**dados_incidente)

    assert incidente.attempts == 0


def test_limite_padrao_de_tentativas_e_tres(dados_incidente: dict) -> None:
    incidente = IncidenteDLQ(**dados_incidente)

    assert incidente.max_attempts == 3


def test_datas_sao_geradas_em_utc(dados_incidente: dict) -> None:
    incidente = IncidenteDLQ(**dados_incidente)

    assert incidente.created_at.tzinfo == UTC
    assert incidente.updated_at.tzinfo == UTC


def test_aceita_todos_os_estados_validos(dados_incidente: dict) -> None:
    for status in StatusIncidente:
        incidente = IncidenteDLQ(**dados_incidente, status=status)

        assert incidente.status == status


def test_rejeita_estado_invalido(dados_incidente: dict) -> None:
    with pytest.raises(ValidationError):
        IncidenteDLQ(**dados_incidente, status="cancelled")


def test_rejeita_tentativas_negativas(dados_incidente: dict) -> None:
    with pytest.raises(ValidationError):
        IncidenteDLQ(**dados_incidente, attempts=-1)


def test_rejeita_limite_de_tentativas_zero(dados_incidente: dict) -> None:
    with pytest.raises(ValidationError):
        IncidenteDLQ(**dados_incidente, max_attempts=0)


def test_rejeita_tentativas_acima_do_limite(dados_incidente: dict) -> None:
    with pytest.raises(ValidationError):
        IncidenteDLQ(**dados_incidente, attempts=4, max_attempts=3)


def test_rejeita_campos_nao_previstos(dados_incidente: dict) -> None:
    with pytest.raises(ValidationError):
        IncidenteDLQ(**dados_incidente, campo_invalido="não permitido")


def test_rejeita_incidente_sem_request_id(dados_incidente: dict) -> None:
    dados_incidente["request_id"] = ""

    with pytest.raises(ValidationError):
        IncidenteDLQ(**dados_incidente)


def test_rejeita_incidente_sem_mensagem_de_erro(dados_incidente: dict) -> None:
    dados_incidente["error"] = ""

    with pytest.raises(ValidationError):
        IncidenteDLQ(**dados_incidente)


def test_registro_de_falha_aceita_event_id_ausente() -> None:
    registro = RegistroFalhaDLQ(
        event_type="turismo.roteiro.processar",
        request_id="abc-123",
        error="Falha antes da criação do evento",
        stack_trace="Traceback: erro de teste",
        payload={"roteiro_id": "roteiro-001"},
    )

    assert registro.event_id is None


def test_registro_de_falha_rejeita_campos_extras() -> None:
    with pytest.raises(ValidationError):
        RegistroFalhaDLQ(
            event_type="turismo.roteiro.processar",
            request_id="abc-123",
            error="Falha de teste",
            stack_trace="Traceback: erro de teste",
            payload={},
            campo_invalido="não permitido",
        )


@pytest.mark.parametrize(
    "event_type",
    [
        "turismo.dlq",
        "Turismo.dlq.incidente",
        "turismo..incidente",
        "turismo.dlq.incidente.extra",
        "turismo.dlq incidente",
        "evento-invalido",
    ],
)
def test_incidente_rejeita_event_type_invalido(
    dados_incidente: dict,
    event_type: str,
) -> None:
    dados_incidente["event_type"] = event_type

    with pytest.raises(ValidationError):
        IncidenteDLQ(**dados_incidente)


@pytest.mark.parametrize(
    "event_type",
    [
        "turismo.dlq",
        "Turismo.dlq.incidente",
        "turismo..incidente",
        "turismo.dlq.incidente.extra",
        "turismo.dlq incidente",
        "evento-invalido",
    ],
)
def test_registro_rejeita_event_type_invalido(event_type: str) -> None:
    with pytest.raises(ValidationError):
        RegistroFalhaDLQ(
            event_type=event_type,
            request_id="abc-123",
            error="Falha de teste",
            stack_trace="Traceback: erro de teste",
            payload={},
        )


def test_registrar_incidente_persiste_no_json(dados_incidente: dict) -> None:
    registro = RegistroFalhaDLQ(**dados_incidente)

    incidente = asyncio.run(registrar_incidente(registro))

    caminho = obter_settings().dlq_arquivo
    dados = json.loads(caminho.read_text(encoding="utf-8"))

    assert incidente.status == StatusIncidente.PENDING
    assert incidente.attempts == 0
    assert isinstance(incidente.id, UUID)
    assert dados["total_incidentes"] == 1
    assert len(dados["incidentes"]) == 1
    assert dados["incidentes"][0]["id"] == str(incidente.id)


def test_registrar_incidentes_preserva_registros_anteriores(
    dados_incidente: dict,
) -> None:
    registro_1 = RegistroFalhaDLQ(**dados_incidente)
    registro_2 = RegistroFalhaDLQ(**dados_incidente)

    incidente_1 = asyncio.run(registrar_incidente(registro_1))
    incidente_2 = asyncio.run(registrar_incidente(registro_2))

    caminho = obter_settings().dlq_arquivo
    dados = json.loads(caminho.read_text(encoding="utf-8"))

    assert dados["total_incidentes"] == 2
    assert len(dados["incidentes"]) == 2
    assert incidente_1.id != incidente_2.id


def test_listar_incidentes_retorna_lista_vazia() -> None:
    incidentes = asyncio.run(listar_incidentes())

    assert incidentes == []


def test_listar_incidentes_retorna_registros_persistidos(
    dados_incidente: dict,
) -> None:
    registro = RegistroFalhaDLQ(**dados_incidente)
    criado = asyncio.run(registrar_incidente(registro))

    incidentes = asyncio.run(listar_incidentes())

    assert len(incidentes) == 1
    assert incidentes[0].id == criado.id


def test_listar_incidentes_filtra_por_status(
    dados_incidente: dict,
) -> None:
    registro = RegistroFalhaDLQ(**dados_incidente)
    criado = asyncio.run(registrar_incidente(registro))

    pendentes = asyncio.run(
        listar_incidentes(StatusIncidente.PENDING)
    )
    resolvidos = asyncio.run(
        listar_incidentes(StatusIncidente.RESOLVED)
    )

    assert len(pendentes) == 1
    assert pendentes[0].id == criado.id
    assert resolvidos == []


def test_obter_incidente_encontra_uuid(
    dados_incidente: dict,
) -> None:
    registro = RegistroFalhaDLQ(**dados_incidente)
    criado = asyncio.run(registrar_incidente(registro))

    encontrado = asyncio.run(obter_incidente(criado.id))

    assert encontrado is not None
    assert encontrado.id == criado.id
    assert encontrado.request_id == criado.request_id


def test_obter_incidente_retorna_none_para_uuid_inexistente() -> None:
    encontrado = asyncio.run(
        obter_incidente(UUID("00000000-0000-0000-0000-000000000001"))
    )

    assert encontrado is None


def test_iniciar_reprocessamento_incrementa_tentativas(
    dados_incidente: dict,
) -> None:
    registro = RegistroFalhaDLQ(**dados_incidente)
    criado = asyncio.run(registrar_incidente(registro))

    atualizado = asyncio.run(iniciar_reprocessamento(criado.id))

    assert atualizado is not None
    assert atualizado.status == StatusIncidente.PROCESSING
    assert atualizado.attempts == 1


def test_nao_inicia_incidente_ja_em_processamento(
    dados_incidente: dict,
) -> None:
    registro = RegistroFalhaDLQ(**dados_incidente)
    criado = asyncio.run(registrar_incidente(registro))

    primeira = asyncio.run(iniciar_reprocessamento(criado.id))
    segunda = asyncio.run(iniciar_reprocessamento(criado.id))

    assert primeira is not None
    assert segunda is None

    persistido = asyncio.run(obter_incidente(criado.id))
    assert persistido is not None
    assert persistido.attempts == 1


def test_nao_inicia_incidente_inexistente() -> None:
    inexistente = UUID("00000000-0000-0000-0000-000000000001")

    resultado = asyncio.run(iniciar_reprocessamento(inexistente))

    assert resultado is None


def test_nao_inicia_incidente_resolvido(
    dados_incidente: dict,
) -> None:
    registro = RegistroFalhaDLQ(**dados_incidente)
    criado = asyncio.run(registrar_incidente(registro))

    incidente = IncidenteDLQ(
        id=criado.id,
        **dados_incidente,
        status=StatusIncidente.RESOLVED,
    )

    caminho = obter_settings().dlq_arquivo
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    dados["incidentes"][0] = incidente.model_dump(mode="json")
    caminho.write_text(json.dumps(dados), encoding="utf-8")

    resultado = asyncio.run(iniciar_reprocessamento(criado.id))

    assert resultado is None

    persistido = asyncio.run(obter_incidente(criado.id))
    assert persistido is not None
    assert persistido.status == StatusIncidente.RESOLVED


def test_nao_inicia_incidente_com_limite_de_tentativas_atingido(
    dados_incidente: dict,
) -> None:
    registro = RegistroFalhaDLQ(**dados_incidente)
    criado = asyncio.run(registrar_incidente(registro))

    incidente = IncidenteDLQ(
        id=criado.id,
        **dados_incidente,
        attempts=3,
        max_attempts=3,
    )

    caminho = obter_settings().dlq_arquivo
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    dados["incidentes"][0] = incidente.model_dump(mode="json")
    caminho.write_text(json.dumps(dados), encoding="utf-8")

    resultado = asyncio.run(iniciar_reprocessamento(criado.id))

    assert resultado is None

    persistido = asyncio.run(obter_incidente(criado.id))
    assert persistido is not None
    assert persistido.status == StatusIncidente.FAILED
    assert persistido.attempts == 3


def test_finalizar_reprocessamento_com_sucesso(
    dados_incidente: dict,
) -> None:
    registro = RegistroFalhaDLQ(**dados_incidente)
    criado = asyncio.run(registrar_incidente(registro))

    asyncio.run(iniciar_reprocessamento(criado.id))
    resultado = asyncio.run(
        finalizar_reprocessamento(criado.id, sucesso=True)
    )

    assert resultado is not None
    assert resultado.status == StatusIncidente.RESOLVED
    assert resultado.attempts == 1


def test_falha_no_reprocessamento_retorna_para_pending(
    dados_incidente: dict,
) -> None:
    registro = RegistroFalhaDLQ(**dados_incidente)
    criado = asyncio.run(registrar_incidente(registro))

    asyncio.run(iniciar_reprocessamento(criado.id))
    resultado = asyncio.run(
        finalizar_reprocessamento(
            criado.id,
            sucesso=False,
            error="Falha na segunda etapa",
            stack_trace="Traceback: nova falha",
        )
    )

    assert resultado is not None
    assert resultado.status == StatusIncidente.PENDING
    assert resultado.attempts == 1
    assert resultado.error == "Falha na segunda etapa"
    assert resultado.stack_trace == "Traceback: nova falha"


def test_falha_na_ultima_tentativa_marca_failed(
    dados_incidente: dict,
) -> None:
    """Marca o incidente como failed ao atingir o limite de tentativas."""
    registro = RegistroFalhaDLQ(**dados_incidente)
    criado = asyncio.run(registrar_incidente(registro))

    for _ in range(3):
        asyncio.run(iniciar_reprocessamento(criado.id))
        resultado = asyncio.run(
            finalizar_reprocessamento(
                criado.id,
                sucesso=False,
                error="Falha definitiva",
                stack_trace="Traceback: falha definitiva",
            )
        )

    assert resultado is not None
    assert resultado.status == StatusIncidente.FAILED
    assert resultado.attempts == 3


def test_nao_finaliza_incidente_que_nao_esta_processando(
    dados_incidente: dict,
) -> None:
    registro = RegistroFalhaDLQ(**dados_incidente)
    criado = asyncio.run(registrar_incidente(registro))

    resultado = asyncio.run(
        finalizar_reprocessamento(criado.id, sucesso=True)
    )

    assert resultado is None

    persistido = asyncio.run(obter_incidente(criado.id))
    assert persistido is not None
    assert persistido.status == StatusIncidente.PENDING


def test_nao_finaliza_incidente_inexistente() -> None:
    inexistente = UUID("00000000-0000-0000-0000-000000000001")

    resultado = asyncio.run(
        finalizar_reprocessamento(inexistente, sucesso=True)
    )

    assert resultado is None


def test_duas_requisicoes_nao_reservam_o_mesmo_incidente(
    dados_incidente: dict,
) -> None:
    """Garante exclusividade na reserva durante operações concorrentes."""
    registro = RegistroFalhaDLQ(**dados_incidente)
    criado = asyncio.run(registrar_incidente(registro))

    async def executar_reservas():
        return await asyncio.gather(
            iniciar_reprocessamento(criado.id),
            iniciar_reprocessamento(criado.id),
        )

    resultados = asyncio.run(executar_reservas())

    assert sum(resultado is not None for resultado in resultados) == 1
    assert sum(resultado is None for resultado in resultados) == 1

    persistido = asyncio.run(obter_incidente(criado.id))

    assert persistido is not None
    assert persistido.status == StatusIncidente.PROCESSING
    assert persistido.attempts == 1


def test_arquivo_corrompido_e_preservado() -> None:
    """Preserva o conteúdo original quando o JSON da DLQ está inválido."""
    caminho = obter_settings().dlq_arquivo
    caminho.parent.mkdir(parents=True, exist_ok=True)
    conteudo_original = '{"incidentes": [JSON INVÁLIDO'

    caminho.write_text(conteudo_original, encoding="utf-8")

    with pytest.raises(json.JSONDecodeError):
        asyncio.run(listar_incidentes())

    backups = list(caminho.parent.glob("dlq.corrompido-*.json"))

    assert len(backups) == 1
    assert backups[0].read_text(encoding="utf-8") == conteudo_original
    assert not caminho.exists()


def test_arquivo_corrompido_nao_e_substituido_por_estrutura_vazia() -> None:
    """Impede a perda silenciosa de incidentes após corrupção do arquivo."""
    caminho = obter_settings().dlq_arquivo
    caminho.parent.mkdir(parents=True, exist_ok=True)
    conteudo_original = '{"versao_schema": "1.0",'

    caminho.write_text(conteudo_original, encoding="utf-8")

    with pytest.raises(json.JSONDecodeError):
        asyncio.run(registrar_incidente(
            RegistroFalhaDLQ(
                event_type="turismo.roteiro.processar",
                request_id="teste-123",
                error="Falha de teste",
                stack_trace="Traceback de teste",
                payload={},
            )
        ))

    assert not caminho.exists()

    backups = list(caminho.parent.glob("dlq.corrompido-*.json"))
    assert len(backups) == 1
    assert backups[0].read_text(encoding="utf-8") == conteudo_original


@pytest.mark.parametrize("campo", ["created_at", "updated_at"])
def test_rejeita_data_sem_fuso_horario(
    dados_incidente: dict,
    campo: str,
) -> None:
    dados = {
        **dados_incidente,
        campo: datetime(2026, 11, 25, 12, 0, 0),
    }

    with pytest.raises(ValidationError):
        IncidenteDLQ(**dados)
