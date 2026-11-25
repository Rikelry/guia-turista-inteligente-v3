"""
ATIVIDADE 07 :: V3 Sistema Viajante com N8N
Contratos e validações dos eventos de integração com o n8n.

Módulo: app.schemas.eventos
Parte da atividade: 01 - Fundação da arquitetura orientada a eventos.

Responsabilidades:
    - Definir o envelope padronizado dos eventos.
    - Gerar identificadores UUID únicos.
    - Registrar a data e hora de ocorrência em UTC.
    - Propagar o identificador de correlação da requisição.
    - Validar o formato e os campos obrigatórios dos eventos.

Contrato do evento:
    event_id: Identificador UUID único do evento.
    event_type: Tipo no padrão dominio.recurso.acao.
    occurred_at: Data e hora de ocorrência em UTC.
    request_id: Identificador de correlação da requisição.
    source: Sistema responsável pela emissão.
    data: Dados específicos do evento.

Restrições:
    - Campos adicionais não são permitidos.
    - event_type deve utilizar letras minúsculas.
    - Cada evento recebe seu próprio UUID automaticamente.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EventoIntegracao(BaseModel):
    """
    Envelope padronizado para eventos enviados às integrações externas.

    Attributes:
        event_id: Identificador único do evento.
        event_type: Categoria da operação no padrão dominio.recurso.acao.
        occurred_at: Momento de criação do evento em UTC.
        request_id: Identificador para rastreamento entre serviços.
        source: Identificação do sistema emissor.
        data: Conteúdo específico do evento.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("event_type")
    @classmethod
    def validar_event_type(cls, valor: str) -> str:
        partes = valor.split(".")

        if len(partes) != 3 or any(not parte for parte in partes):
            raise ValueError(
                "event_type deve seguir o padrão dominio.recurso.acao."
            )

        if not all(parte.replace("_", "").isalnum() for parte in partes):
            raise ValueError(
                "event_type deve conter apenas letras, números e underscores."
            )

        if valor != valor.lower():
            raise ValueError("event_type deve utilizar letras minúsculas.")

        return valor

    event_id: UUID = Field(default_factory=uuid4)
    event_type: str = Field(min_length=3, max_length=120)
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    request_id: str = Field(min_length=1, max_length=64)
    source: str = Field(default="guia-turista-api", min_length=1, max_length=80)
    data: dict[str, Any]
