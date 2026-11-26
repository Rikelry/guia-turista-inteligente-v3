"""
ATIVIDADE 07 :: V3 Sistema Viajante com N8N
Testes de integridade das configurações da aplicação.

Módulo: tests.test_settings
Parte da atividade: 01 e 02 - Fundação de eventos e DLQ.

Responsabilidades:
    - Validar valores padrão das configurações.
    - Verificar leitura de variáveis de ambiente e arquivo .env.
    - Rejeitar configurações inválidas.
    - Validar o caminho padrão de persistência da DLQ.
    - Garantir que DLQ_ARQUIVO possa ser sobrescrito.

Dependências:
    - pytest: execução e parametrização dos testes.
    - Pydantic: validação das configurações.
"""

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_padroes_de_desenvolvimento(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    s = Settings()
    assert s.cors_origins == ["http://localhost:5173", "http://localhost:3000"]
    assert s.visitante_ttl_horas == 2.0
    assert s.google_client_id == ""


def test_cors_origins_em_texto_separado_por_virgula(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", " http://localhost:5173/ , https://guia.exemplo.com ,")
    assert Settings().cors_origins == ["http://localhost:5173", "https://guia.exemplo.com"]


def test_le_o_arquivo_env(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    (tmp_path / ".env").write_text(
        "GOOGLE_CLIENT_ID=  abc.apps.googleusercontent.com  \nVISITANTE_TTL_HORAS=1.5\n"
    )
    monkeypatch.chdir(tmp_path)
    s = Settings()
    assert s.google_client_id == "abc.apps.googleusercontent.com"
    assert s.visitante_ttl_horas == 1.5


@pytest.mark.parametrize("ttl", ["0", "-1", "48", "duas"])
def test_ttl_do_visitante_invalido_e_recusado(ttl: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VISITANTE_TTL_HORAS", ttl)
    with pytest.raises(ValidationError):
        Settings()


def test_caminho_padrao_da_dlq(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DLQ_ARQUIVO", raising=False)

    s = Settings()

    assert s.dlq_arquivo.name == "dlq.json"
    assert s.dlq_arquivo.parent.name == "data"


def test_caminho_da_dlq_pode_ser_sobrescrito(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    caminho = tmp_path / "incidentes-teste.json"
    monkeypatch.setenv("DLQ_ARQUIVO", str(caminho))

    assert Settings().dlq_arquivo == caminho
