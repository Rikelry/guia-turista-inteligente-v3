"""
ATIVIDADE 07 :: V3 Sistema Viajante com N8N
Testes automatizados dos endpoints administrativos de suporte.

Módulo: tests.test_support
Parte da atividade: 03 - Telegram ChatOps.

Responsabilidades:
    - Validar a proteção dos endpoints administrativos.
    - Verificar a rejeição de requisições sem chave de autenticação.
    - Verificar a rejeição de chaves de suporte inválidas.
    - Validar o acesso autorizado ao endpoint de status.
    - Verificar a consulta do tempo de atividade da aplicação.
    - Validar o acesso aos indicadores de telemetria.
    - Verificar o registro de incidentes sintéticos na DLQ.

Cobertura:
    - Autenticação por meio do cabeçalho X-Support-Key.
    - Respostas HTTP 403 para acessos não autorizados.
    - Respostas HTTP 200 para operações autorizadas.
    - Retorno dos identificadores do incidente e da requisição.
"""

from fastapi.testclient import TestClient

from app.core.config import obter_settings


def test_status_sem_chave_deve_retornar_403(client: TestClient) -> None:
    """Impede acesso quando nenhuma chave de suporte está configurada."""
    resposta = client.get("/api/v1/suporte/status")

    assert resposta.status_code == 403
    assert resposta.json()["detail"] == "Acesso restrito à equipe de suporte."


def test_status_com_chave_incorreta_deve_retornar_403(
    client: TestClient,
    monkeypatch,
) -> None:
    """Impede acesso quando a chave apresentada é incorreta."""
    monkeypatch.setattr(obter_settings(), "support_api_key", "chave-correta")

    resposta = client.get(
        "/api/v1/suporte/status",
        headers={"X-Support-Key": "chave-incorreta"},
    )

    assert resposta.status_code == 403


def test_status_com_chave_valida_deve_retornar_200(
    client: TestClient,
    monkeypatch,
) -> None:
    """Permite acesso quando a chave apresentada é válida."""
    monkeypatch.setattr(obter_settings(), "support_api_key", "chave-correta")

    resposta = client.get(
        "/api/v1/suporte/status",
        headers={"X-Support-Key": "chave-correta"},
    )

    assert resposta.status_code == 200
    assert resposta.json()["status"] == "operacional"


def test_uptime_com_chave_valida_deve_retornar_tempo_de_atividade(
    client: TestClient,
    monkeypatch,
) -> None:
    """Retorna o tempo de atividade para a equipe autorizada."""
    monkeypatch.setattr(obter_settings(), "support_api_key", "chave-correta")

    resposta = client.get(
        "/api/v1/suporte/uptime",
        headers={"X-Support-Key": "chave-correta"},
    )

    assert resposta.status_code == 200
    assert resposta.json()["status"] == "ok"
    assert resposta.json()["uptime_segundos"] >= 0


def test_telemetria_com_chave_valida_deve_retornar_indicadores(
    client: TestClient,
    monkeypatch,
) -> None:
    """Retorna indicadores operacionais para a equipe autorizada."""
    monkeypatch.setattr(obter_settings(), "support_api_key", "chave-correta")

    resposta = client.get(
        "/api/v1/suporte/telemetria",
        headers={"X-Support-Key": "chave-correta"},
    )

    assert resposta.status_code == 200

    dados = resposta.json()
    assert "total_roteiros_salvos" in dados
    assert "sessoes_ativas" in dados
    assert "circuit_breakers" in dados
    assert "cache" in dados


def test_testardlq_com_chave_valida_deve_registrar_incidente(
    client: TestClient,
    monkeypatch,
) -> None:
    """Registra incidente sintético e retorna seus identificadores."""
    monkeypatch.setattr(obter_settings(), "support_api_key", "chave-correta")

    resposta = client.post(
        "/api/v1/suporte/testardlq",
        headers={"X-Support-Key": "chave-correta"},
    )

    assert resposta.status_code == 200

    dados = resposta.json()
    assert dados["status"] == "registrado"
    assert dados["incidente_id"]
    assert dados["request_id"]


def test_endpoints_telemetria_sem_chave_devem_retornar_403(
    client: TestClient,
) -> None:
    """Bloqueia acessos públicos aos endpoints de telemetria e métricas."""
    endpoints = [
        ("GET", "/api/v1/telemetria"),
        ("GET", "/api/v1/telemetria/circuit-breakers"),
        ("GET", "/api/v1/telemetria/auditoria"),
        ("POST", "/api/v1/telemetria/auditoria"),
        ("GET", "/metrics"),
    ]

    for metodo, caminho in endpoints:
        resposta = client.request(
            metodo,
            caminho,
            json={"acao": "teste"} if metodo == "POST" else None,
        )
        assert resposta.status_code == 403, (
            f"Endpoint {metodo} {caminho} deveria bloquear acesso sem autenticação."
        )
