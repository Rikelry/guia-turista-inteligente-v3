"""
ATIVIDADE 07 :: V3 Sistema Viajante com N8N
Contratos e validações dos incidentes da Dead Letter Queue.

Módulo: app.schemas.dlq
Parte da atividade: 02 - DLQ e alertas de incidentes no Telegram.

Responsabilidades:
    - Definir os estados possíveis de um incidente.
    - Padronizar o registro de falhas de processamento.
    - Representar incidentes persistidos na DLQ.
    - Validar tentativas, identificadores e dados de rastreabilidade.
    - Preservar o payload original para permitir reprocessamento.

Estados do incidente:
    pending: Aguardando processamento ou nova tentativa.
    processing: Reprocessamento em andamento.
    failed: Limite de tentativas atingido.
    resolved: Incidente resolvido com sucesso.

Restrições:
    - Campos adicionais não são permitidos.
    - Identificadores são representados por UUID.
    - Datas devem possuir informação de fuso horário.
    - Tentativas não podem ultrapassar o limite configurado.
"""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StatusIncidente(StrEnum):
    """Estados possíveis durante o ciclo de vida de um incidente da DLQ."""

    PENDING = "pending"
    PROCESSING = "processing"
    FAILED = "failed"
    RESOLVED = "resolved"


class RegistroFalhaDLQ(BaseModel):
    """
    Dados necessários para registrar uma nova falha de processamento.

    Attributes:
        event_id: UUID do evento original, quando disponível.
        event_type: Tipo do evento que apresentou falha.
        request_id: Identificador de rastreabilidade da requisição.
        error: Mensagem descritiva da exceção.
        stack_trace: Rastreamento completo da exceção.
        payload: Dados originais necessários para reprocessamento.
    """

    @field_validator("event_type")
    @classmethod
    def validar_event_type(cls, valor: str) -> str:
        """Valida o padrão dominio.recurso.acao do tipo de evento."""
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

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    event_id: UUID | None = None
    event_type: str = Field(min_length=1, max_length=120)
    request_id: str = Field(min_length=1, max_length=64)
    error: str = Field(min_length=1, max_length=2000)
    stack_trace: str = Field(min_length=1)
    payload: dict[str, Any]


class IncidenteDLQ(BaseModel):
    """
    Representação persistente de um incidente registrado na DLQ.

    Attributes:
        id: Identificador UUID único do incidente.
        event_id: UUID do evento original, quando disponível.
        event_type: Tipo do evento que apresentou falha.
        request_id: Identificador de rastreabilidade da requisição.
        status: Estado atual do incidente.
        attempts: Quantidade de tentativas de reprocessamento realizadas.
        max_attempts: Limite máximo de tentativas permitidas.
        error: Mensagem da última exceção registrada.
        stack_trace: Rastreamento completo da última exceção.
        created_at: Data e hora de criação do incidente em UTC.
        updated_at: Data e hora da última atualização em UTC.
        payload: Dados originais necessários para reprocessamento.
    """

    @field_validator("event_type")
    @classmethod
    def validar_event_type(cls, valor: str) -> str:
        """Valida o padrão dominio.recurso.acao do tipo de evento."""
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

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    @field_validator("created_at", "updated_at")
    @classmethod
    def validar_fuso_horario(cls, valor: datetime) -> datetime:
        """Garante que as datas do incidente possuam fuso horário."""
        if valor.tzinfo is None or valor.utcoffset() is None:
            raise ValueError("As datas do incidente devem possuir fuso horário.")

        return valor

    @model_validator(mode="after")
    def validar_tentativas(self) -> "IncidenteDLQ":
        """Garante que a quantidade de tentativas respeite o limite configurado."""
        if self.attempts > self.max_attempts:
            raise ValueError(
                "attempts não pode ultrapassar max_attempts."
            )
        return self

    id: UUID = Field(default_factory=uuid4)
    event_id: UUID | None = None
    event_type: str = Field(min_length=1, max_length=120)
    request_id: str = Field(min_length=1, max_length=64)
    status: StatusIncidente = StatusIncidente.PENDING
    attempts: int = Field(default=0, ge=0)
    max_attempts: int = Field(default=3, ge=1)
    error: str = Field(min_length=1, max_length=2000)
    stack_trace: str = Field(min_length=1)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    payload: dict[str, Any]
