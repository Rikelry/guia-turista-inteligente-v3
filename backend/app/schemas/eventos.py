"""
Contratos Pydantic dos eventos de integração com o n8n.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EventoIntegracao(BaseModel):
    """
    Envelope padronizado para eventos enviados às integrações externas.
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
