"""
ATIVIDADE 07 :: V3 Sistema Viajante com N8N
Centralização das dependências e mecanismos de autenticação do FastAPI.

Módulo: app.core.dependencies
Parte da atividade: 03 - Telegram ChatOps.

Responsabilidades:
    - Disponibilizar o cliente HTTP compartilhado pela aplicação.
    - Gerenciar o acesso ao registro de sessões dos usuários.
    - Identificar e validar usuários ativos por meio de sessão.
    - Autorizar operações administrativas do Telegram ChatOps.
    - Centralizar dependências reutilizáveis nos endpoints da API.

Segurança:
    - Valida sessões antes de permitir operações de usuários.
    - Exige a chave X-Support-Key para operações administrativas.
    - Rejeita acessos administrativos sem chave válida.
    - Não expõe valores de chaves ou credenciais.
"""

from typing import Annotated

import httpx
from fastapi import Depends, Header, HTTPException, Request, status

from app.core.config import Settings, obter_settings
from app.schemas.auth import UsuarioPerfil
from app.services.sessao_service import RegistroSessoes


def obter_http_client(request: Request) -> httpx.AsyncClient:
    """Cliente httpx criado no lifespan: reaproveita conexões TCP/TLS (keep-alive)."""
    return request.app.state.http_client


def obter_sessoes(request: Request) -> RegistroSessoes:
    return request.app.state.sessoes


async def obter_usuario_ativo(
    sessoes: Annotated[RegistroSessoes, Depends(obter_sessoes)],
    x_user_id: Annotated[str | None, Header()] = None,
) -> UsuarioPerfil:
    """Usuário identificado pelo header X-User-Id. 401 se ausente, desconhecido ou expirado."""
    if not x_user_id:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail="Entre com o Google ou como visitante."
        )
    perfil = await sessoes.obter(x_user_id)
    if perfil is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail="Sessão expirada ou inexistente. Entre novamente."
        )
    return perfil


async def obter_suporte_autorizado(
    config: Annotated[Settings, Depends(obter_settings)],
    x_support_key: Annotated[str | None, Header()] = None,
) -> None:
    """Autoriza operações administrativas mediante X-Support-Key."""
    if not config.support_api_key or x_support_key != config.support_api_key:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito à equipe de suporte.",
        )


HttpClient = Annotated[httpx.AsyncClient, Depends(obter_http_client)]
Sessoes = Annotated[RegistroSessoes, Depends(obter_sessoes)]
UsuarioAtivo = Annotated[UsuarioPerfil, Depends(obter_usuario_ativo)]
Config = Annotated[Settings, Depends(obter_settings)]
SuporteAutorizado = Annotated[None, Depends(obter_suporte_autorizado)]
