"""Testes da integração com o cadastro de postos da ANP."""

import asyncio

import httpx

from datetime import date

from app.services import anp_service


def test_normaliza_registro_anp() -> None:
    """Converte os dados cadastrais da ANP para o schema do sistema."""

    dados = {
        "cnpj": "12345678000190",
        "razaoSocial": "Posto Exemplo LTDA",
        "endereco": "Avenida Principal",
        "complemento": "S/N",
        "bairro": "Centro",
        "municipio": "Teresina",
        "uf": "pi",
        "distribuidora": "Bandeira Exemplo",
        "dataPublicacao": "15/03/2025",
        "latitude": "-5.0892",
        "longitude": "-42.8019",
        "statusSIGAF": "Ativo",
        "validacao": "Validado",
        "produtos": [
            {"produto": "GASOLINA COMUM"},
            {"produto": "ETANOL HIDRATADO"},
        ],
    }

    posto = anp_service._normalizar_posto(dados)

    assert posto is not None
    assert posto.cnpj == "12345678000190"
    assert posto.razao_social == "Posto Exemplo LTDA"
    assert posto.bandeira == "Bandeira Exemplo"
    assert posto.endereco == "Avenida Principal, S/N, Centro"
    assert posto.municipio == "Teresina"
    assert posto.uf == "PI"
    assert posto.lat == -5.0892
    assert posto.lon == -42.8019
    assert posto.data_publicacao == date(2025, 3, 15)
    assert posto.combustiveis == [
        "GASOLINA COMUM",
        "ETANOL HIDRATADO",
    ]
    assert posto.avaliacao is None


def test_normaliza_coordenadas_anp_em_formato_dms() -> None:
    """Converte coordenadas DMS da ANP para graus decimais."""

    dados = {
        "cnpj": "12345678000190",
        "razaoSocial": "Posto Coordenadas DMS LTDA",
        "uf": "PI",
        "latitude_ANP4C": "-10:00:24,750",
        "longitude_ANP4C": "-38:30:00,000",
    }

    posto = anp_service._normalizar_posto(dados)

    assert posto is not None
    assert posto.lat == -10.006875
    assert posto.lon == -38.5


def test_ignora_registro_anp_sem_coordenadas() -> None:
    """Ignora registros que não possuem coordenadas geográficas."""

    dados = {
        "cnpj": "12345678000190",
        "razaoSocial": "Posto Sem Coordenadas LTDA",
        "municipio": "Teresina",
        "uf": "PI",
    }

    posto = anp_service._normalizar_posto(dados)

    assert posto is None


def test_consulta_anp_com_paginacao() -> None:
    """Consulta todas as páginas disponíveis no cadastro da ANP."""

    paginas_consultadas: list[int] = []

    def responder(request: httpx.Request) -> httpx.Response:
        pagina = int(request.url.params["numeropagina"])
        paginas_consultadas.append(pagina)

        registros = {
            1: [
                {
                    "cnpj": "11111111000111",
                    "razaoSocial": "Posto Primeira Página LTDA",
                    "uf": "PI",
                    "latitude": "-5.08",
                    "longitude": "-42.80",
                }
            ],
            2: [
                {
                    "cnpj": "22222222000122",
                    "razaoSocial": "Posto Segunda Página LTDA",
                    "uf": "CE",
                    "latitude": "-3.72",
                    "longitude": "-38.52",
                }
            ],
        }

        return httpx.Response(
            200,
            json={
                "data": registros[pagina],
                "searchPageFilter": {"totalPagina": 2},
            },
        )

    async def cenario() -> list:
        transporte = httpx.MockTransport(responder)

        async with httpx.AsyncClient(transport=transporte) as client:
            return await anp_service.obter_cadastro_anp(client)

    anp_service.cache.limpar()

    postos = asyncio.run(cenario())

    assert paginas_consultadas == [1, 2]
    assert len(postos) == 2
    assert postos[0].cnpj == "11111111000111"
    assert postos[1].cnpj == "22222222000122"


def test_reutiliza_cadastro_anp_em_cache() -> None:
    """Evita novas requisições enquanto o cadastro estiver em cache."""

    chamadas = 0

    def responder(request: httpx.Request) -> httpx.Response:
        nonlocal chamadas
        chamadas += 1

        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "cnpj": "33333333000133",
                        "razaoSocial": "Posto Cache LTDA",
                        "uf": "PI",
                        "latitude": "-5.08",
                        "longitude": "-42.80",
                    }
                ],
                "searchPageFilter": {"totalPagina": 1},
            },
        )

    async def cenario() -> tuple[list, list]:
        transporte = httpx.MockTransport(responder)

        async with httpx.AsyncClient(transport=transporte) as client:
            primeira = await anp_service.obter_cadastro_anp(client)
            segunda = await anp_service.obter_cadastro_anp(client)

        return primeira, segunda

    anp_service.cache.limpar()

    primeira, segunda = asyncio.run(cenario())

    assert chamadas == 1
    assert len(primeira) == 1
    assert len(segunda) == 1
    assert primeira[0].cnpj == segunda[0].cnpj


def test_busca_postos_proximos_com_ranqueamento_regulatorio() -> None:
    """Prioriza postos validados e considera a distância até a rota."""

    from app.schemas.roteiros import PostoCombustivel

    postos = [
        PostoCombustivel(
            cnpj="11111111000111",
            razao_social="Posto Mais Distante",
            uf="PI",
            lat=-5.08,
            lon=-42.79,
            status_sigaf="Ativo",
            validacao_geografica="Não validado",
            distancia_rota_km=0,
        ),
        PostoCombustivel(
            cnpj="22222222000122",
            razao_social="Posto Validado",
            uf="PI",
            lat=-5.001,
            lon=-42.79,
            status_sigaf="Ativo",
            validacao_geografica="Validado",
            distancia_rota_km=0,
        ),
        PostoCombustivel(
            cnpj="33333333000133",
            razao_social="Posto Sem Validação",
            uf="PI",
            lat=-5.002,
            lon=-42.79,
            status_sigaf=None,
            validacao_geografica=None,
            distancia_rota_km=0,
        ),
    ]

    geometria = [
        (-5.0, -42.80),
        (-5.01, -42.80),
    ]

    resultado = anp_service.buscar_postos_proximos(postos, geometria)

    assert len(resultado) == 3
    assert resultado[0].cnpj == "22222222000122"
    assert resultado[1].cnpj == "11111111000111"
    assert resultado[2].cnpj == "33333333000133"
    assert all(posto.distancia_rota_km > 0 for posto in resultado)
    assert all(posto.distancia_rota_km <= 10 for posto in resultado)


def test_busca_postos_com_geometria_vazia() -> None:
    """Retorna lista vazia quando a rota não possui geometria."""

    resultado = anp_service.buscar_postos_proximos([], [])

    assert resultado == []


def test_exclui_postos_fora_do_raio_da_rota() -> None:
    """Não retorna postos localizados a mais de 10 km da rota."""

    from app.schemas.roteiros import PostoCombustivel

    posto_proximo = PostoCombustivel(
        cnpj="11111111000111",
        razao_social="Posto Próximo",
        uf="PI",
        lat=-5.001,
        lon=-42.79,
        distancia_rota_km=0,
    )

    posto_distante = PostoCombustivel(
        cnpj="22222222000122",
        razao_social="Posto Distante",
        uf="PI",
        lat=-5.20,
        lon=-42.79,
        distancia_rota_km=0,
    )

    resultado = anp_service.buscar_postos_proximos(
        [posto_proximo, posto_distante],
        [(-5.0, -42.80), (-5.01, -42.80)],
    )

    assert len(resultado) == 1
    assert resultado[0].cnpj == "11111111000111"
    assert resultado[0].distancia_rota_km <= 10


def test_calcula_distancia_com_geometria_de_um_ponto() -> None:
    """Calcula a distância quando a rota possui apenas um ponto."""

    from app.schemas.roteiros import PostoCombustivel

    posto = PostoCombustivel(
        cnpj="44444444000144",
        razao_social="Posto Teste",
        uf="PI",
        lat=-5.001,
        lon=-42.80,
        distancia_rota_km=0,
    )

    distancia = anp_service._distancia_ate_rota(
        posto,
        [(-5.0, -42.80)],
    )

    assert 0 < distancia < 1


def test_calcula_distancia_com_segmento_degenerado() -> None:
    """Calcula a distância quando início e fim do segmento coincidem."""

    distancia = anp_service._distancia_ponto_segmento_km(
        ponto=(-5.001, -42.80),
        inicio=(-5.0, -42.80),
        fim=(-5.0, -42.80),
    )

    assert 0 < distancia < 1


def test_limita_resultado_a_vinte_postos() -> None:
    """Retorna no máximo 20 postos próximos à rota."""
    from app.schemas.roteiros import PostoCombustivel

    postos = [
        PostoCombustivel(
            cnpj=f"{i:014d}",
            razao_social=f"Posto {i}",
            uf="PI",
            lat=-5.001,
            lon=-42.80,
            distancia_rota_km=0,
        )
        for i in range(25)
    ]

    resultado = anp_service.buscar_postos_proximos(
        postos,
        [(-5.0, -42.80), (-5.01, -42.80)],
    )

    assert len(resultado) == 20
