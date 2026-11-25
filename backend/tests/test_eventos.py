from datetime import UTC
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.schemas.eventos import EventoIntegracao


def test_gera_uuid_automaticamente() -> None:
    evento = EventoIntegracao(
        event_type="turismo.dlq.incidente",
        request_id="abc-123",
        data={"mensagem": "Falha de teste"},
    )

    assert isinstance(evento.event_id, UUID)


def test_cada_evento_recebe_uuid_diferente() -> None:
    dados = {
        "event_type": "turismo.dlq.incidente",
        "request_id": "abc-123",
        "data": {"mensagem": "Falha de teste"},
    }

    evento_1 = EventoIntegracao(**dados)
    evento_2 = EventoIntegracao(**dados)

    assert evento_1.event_id != evento_2.event_id


def test_data_de_ocorrencia_gerada_em_utc() -> None:
    evento = EventoIntegracao(
        event_type="turismo.dlq.incidente",
        request_id="abc-123",
        data={"mensagem": "Falha de teste"},
    )

    assert evento.occurred_at.tzinfo == UTC


def test_rejeita_campos_nao_previstos() -> None:
    with pytest.raises(ValidationError):
        EventoIntegracao(
            event_type="turismo.dlq.incidente",
            request_id="abc-123",
            data={"mensagem": "Falha de teste"},
            campo_invalido="não permitido",
        )


def test_rejeita_evento_sem_request_id() -> None:
    with pytest.raises(ValidationError):
        EventoIntegracao(
            event_type="turismo.dlq.incidente",
            request_id="",
            data={"mensagem": "Falha de teste"},
        )


@pytest.mark.parametrize(
    "event_type",
    [
        "turismo.dlq",
        "Turismo.dlq.incidente",
        "turismo..incidente",
        "turismo.dlq.incidente.extra",
        "turismo.dlq incidente",
    ],
)
def test_rejeita_event_type_invalido(event_type: str) -> None:
    with pytest.raises(ValidationError):
        EventoIntegracao(
            event_type=event_type,
            request_id="abc-123",
            data={"mensagem": "Falha de teste"},
        )
