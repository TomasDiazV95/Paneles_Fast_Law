from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.db.database import engine
from app.routers.auth import get_current_user
from app.schemas.panel_cenco import (
    ComparativoFilaCenco,
    ComparativoResponseCenco,
    ContactabilidadFilaCenco,
    ContactabilidadResponseCenco,
    EjecutivoCenco,
    EstadoCarteraCenco,
    PagosDiarioCenco,
    PagosFilaCenco,
    PagosResponseCenco,
    PeriodoOptionCenco,
    ReprosDiarioCenco,
    ReprosFilaCenco,
    ReprosResponseCenco,
    ResumenContactoCenco,
)

router = APIRouter(prefix="/panel/cenco", tags=["panel-cenco"], dependencies=[Depends(get_current_user)])


@router.get("/periodos", response_model=list[PeriodoOptionCenco])
def periodos(cartera: str = "427"):
    query = text(
        """
        SELECT PERIODO, COUNT(*) AS causas
        FROM dbo.PANEL_CENCO_ESTADO_CARTERA
        WHERE ID_CARTERA = :cartera
        GROUP BY PERIODO
        ORDER BY PERIODO DESC
        """
    )
    with engine.connect() as conn:
        rows = conn.execute(query, {"cartera": cartera}).mappings().all()
    return [PeriodoOptionCenco(periodo=r["PERIODO"], causas=r["causas"]) for r in rows]


@router.get("/estado-cartera", response_model=list[EstadoCarteraCenco])
def estado_cartera(periodo: str, cartera: str = "427"):
    query = text(
        """
        SELECT ISNULL(CLASIFICACION, 'SIN CLASIFICAR') AS CLASIFICACION,
               ISNULL(Q_CAUSAS, 0) AS Q_CAUSAS,
               ISNULL(CUANTIA_TOTAL, 0) AS CUANTIA_TOTAL,
               ISNULL(TICKET_PROMEDIO, 0) AS TICKET_PROMEDIO
        FROM dbo.PANEL_CENCO_ESTADO_CARTERA
        WHERE PERIODO = :periodo AND ID_CARTERA = :cartera
        ORDER BY Q_CAUSAS DESC
        """
    )
    with engine.connect() as conn:
        rows = conn.execute(query, {"periodo": periodo, "cartera": cartera}).mappings().all()

    return [
        EstadoCarteraCenco(
            clasificacion=r["CLASIFICACION"],
            cantidad_causas=r["Q_CAUSAS"],
            cuantia_total=r["CUANTIA_TOTAL"],
            ticket_promedio=r["TICKET_PROMEDIO"],
        )
        for r in rows
    ]


@router.get("/contactabilidad", response_model=ContactabilidadResponseCenco)
def contactabilidad(periodo: str, cartera: str = "427"):
    matriz_query = text(
        """
        SELECT ISNULL(CLASIFICACION, 'SIN CLASIFICAR') AS CLASIFICACION,
               ISNULL(TIPO_CONTACTO, 'SIN CONTACTO') AS TIPO_CONTACTO,
               ISNULL(Q_DEUDORES, 0) AS Q_DEUDORES
        FROM dbo.PANEL_CENCO_CONTACTABILIDAD
        WHERE PERIODO = :periodo AND ID_CARTERA = :cartera
        ORDER BY CLASIFICACION, TIPO_CONTACTO
        """
    )
    resumen_query = text(
        """
        SELECT ISNULL(TOTAL_DEUDORES, 0) AS TOTAL_DEUDORES,
               ISNULL(CON_CONTACTO, 0) AS CON_CONTACTO,
               ISNULL(SIN_GESTION, 0) AS SIN_GESTION
        FROM dbo.PANEL_CENCO_RESUMEN_CONTACTO
        WHERE PERIODO = :periodo AND ID_CARTERA = :cartera
        """
    )
    with engine.connect() as conn:
        matriz = conn.execute(matriz_query, {"periodo": periodo, "cartera": cartera}).mappings().all()
        resumen = conn.execute(resumen_query, {"periodo": periodo, "cartera": cartera}).mappings().all()

    return ContactabilidadResponseCenco(
        matriz=[
            ContactabilidadFilaCenco(
                clasificacion=r["CLASIFICACION"],
                tipo_contacto=r["TIPO_CONTACTO"],
                cantidad_deudores=r["Q_DEUDORES"],
            )
            for r in matriz
        ],
        resumen=[
            ResumenContactoCenco(
                total_deudores=r["TOTAL_DEUDORES"],
                con_contacto=r["CON_CONTACTO"],
                sin_gestion=r["SIN_GESTION"],
            )
            for r in resumen
        ],
    )


@router.get("/pagos", response_model=PagosResponseCenco)
def pagos(periodo: str, cartera: str = "427"):
    resumen_query = text(
        """
        SELECT ISNULL(CLASIFICACION, 'SIN CLASIFICAR') AS CLASIFICACION,
               ISNULL(Q_DOCUMENTOS, 0) AS Q_DOCUMENTOS,
               ISNULL(MONTO_TOTAL, 0) AS MONTO_TOTAL
        FROM dbo.PANEL_CENCO_PAGOS
        WHERE PERIODO = :periodo AND ID_CARTERA = :cartera
        ORDER BY CASE WHEN CLASIFICACION = 'TOTAL' THEN 1 ELSE 0 END, MONTO_TOTAL DESC
        """
    )
    diario_query = text(
        """
        SELECT FECHA, ISNULL(MONTO_DIA, 0) AS MONTO_DIA, ISNULL(MONTO_ACUMULADO, 0) AS MONTO_ACUMULADO
        FROM dbo.PANEL_CENCO_PAGOS_DIARIO
        WHERE PERIODO = :periodo AND ID_CARTERA = :cartera
        ORDER BY NRO_DIA
        """
    )
    with engine.connect() as conn:
        resumen = conn.execute(resumen_query, {"periodo": periodo, "cartera": cartera}).mappings().all()
        diario = conn.execute(diario_query, {"periodo": periodo, "cartera": cartera}).mappings().all()

    return PagosResponseCenco(
        resumen=[
            PagosFilaCenco(
                clasificacion=r["CLASIFICACION"],
                cantidad_documentos=r["Q_DOCUMENTOS"],
                monto_total=r["MONTO_TOTAL"],
            )
            for r in resumen
        ],
        diario=[
            PagosDiarioCenco(fecha=r["FECHA"], monto_dia=r["MONTO_DIA"], monto_acumulado=r["MONTO_ACUMULADO"])
            for r in diario
        ],
    )


@router.get("/repros", response_model=ReprosResponseCenco)
def repros(periodo: str, cartera: str = "427"):
    resumen_query = text(
        """
        SELECT ISNULL(CLASIFICACION, 'SIN CLASIFICAR') AS CLASIFICACION,
               ISNULL(Q_DOCUMENTOS, 0) AS Q_DOCUMENTOS,
               ISNULL(MONTO_TOTAL, 0) AS MONTO_TOTAL
        FROM dbo.PANEL_CENCO_REPROS
        WHERE PERIODO = :periodo AND ID_CARTERA = :cartera
        ORDER BY CASE WHEN CLASIFICACION = 'TOTAL' THEN 1 ELSE 0 END, MONTO_TOTAL DESC
        """
    )
    diario_query = text(
        """
        SELECT FECHA, ISNULL(MONTO_DIA, 0) AS MONTO_DIA, ISNULL(MONTO_ACUMULADO, 0) AS MONTO_ACUMULADO
        FROM dbo.PANEL_CENCO_REPROS_DIARIO
        WHERE PERIODO = :periodo AND ID_CARTERA = :cartera
        ORDER BY NRO_DIA
        """
    )
    with engine.connect() as conn:
        resumen = conn.execute(resumen_query, {"periodo": periodo, "cartera": cartera}).mappings().all()
        diario = conn.execute(diario_query, {"periodo": periodo, "cartera": cartera}).mappings().all()

    return ReprosResponseCenco(
        resumen=[
            ReprosFilaCenco(
                clasificacion=r["CLASIFICACION"],
                cantidad_documentos=r["Q_DOCUMENTOS"],
                monto_total=r["MONTO_TOTAL"],
            )
            for r in resumen
        ],
        diario=[
            ReprosDiarioCenco(fecha=r["FECHA"], monto_dia=r["MONTO_DIA"], monto_acumulado=r["MONTO_ACUMULADO"])
            for r in diario
        ],
    )


@router.get("/ejecutivos", response_model=list[EjecutivoCenco])
def ejecutivos(periodo: str, cartera: str = "427"):
    query = text(
        """
        SELECT ISNULL(CODIGO_USUARIO, 'SIN CODIGO') AS CODIGO_USUARIO,
               ISNULL(Q_CONTACTOS, 0) AS Q_CONTACTOS,
               ISNULL(Q_PAGOS, 0) AS Q_PAGOS,
               ISNULL(MONTO_PAGOS, 0) AS MONTO_PAGOS,
               ISNULL(Q_REPROS, 0) AS Q_REPROS,
               ISNULL(MONTO_REPROS, 0) AS MONTO_REPROS
        FROM dbo.PANEL_CENCO_EJECUTIVOS
        WHERE PERIODO = :periodo AND ID_CARTERA = :cartera
        ORDER BY MONTO_PAGOS DESC
        """
    )
    with engine.connect() as conn:
        rows = conn.execute(query, {"periodo": periodo, "cartera": cartera}).mappings().all()

    return [
        EjecutivoCenco(
            codigo_usuario=r["CODIGO_USUARIO"],
            cantidad_contactos=r["Q_CONTACTOS"],
            cantidad_pagos=r["Q_PAGOS"],
            monto_pagos=r["MONTO_PAGOS"],
            cantidad_repros=r["Q_REPROS"],
            monto_repros=r["MONTO_REPROS"],
        )
        for r in rows
    ]


def _comparativo_filas(conn, tabla: str, periodo: str, cartera: str) -> list[ComparativoFilaCenco]:
    query = text(
        f"""
        SELECT ORD, NRO_DIA, FECHA_ACTUAL, FECHA_ANTERIOR, MONTO_ACTUAL, MONTO_ANTERIOR,
               ACUM_ACTUAL, ACUM_ANTERIOR, TIPO_FILA, GESTOR_ORIGEN
        FROM dbo.{tabla}
        WHERE PERIODO = :periodo AND ID_CARTERA = :cartera
        ORDER BY GESTOR_ORIGEN, ORD, NRO_DIA
        """
    )
    rows = conn.execute(query, {"periodo": periodo, "cartera": cartera}).mappings().all()
    return [
        ComparativoFilaCenco(
            ord=r["ORD"],
            nro_dia=r["NRO_DIA"],
            fecha_actual=r["FECHA_ACTUAL"],
            fecha_anterior=r["FECHA_ANTERIOR"],
            monto_actual=r["MONTO_ACTUAL"],
            monto_anterior=r["MONTO_ANTERIOR"],
            acum_actual=r["ACUM_ACTUAL"],
            acum_anterior=r["ACUM_ANTERIOR"],
            tipo_fila=r["TIPO_FILA"],
            gestor_origen=r["GESTOR_ORIGEN"],
        )
        for r in rows
    ]


@router.get("/comparativo", response_model=ComparativoResponseCenco)
def comparativo(periodo: str, cartera: str = "427"):
    with engine.connect() as conn:
        pagos = _comparativo_filas(conn, "PANEL_CENCO_COMPARATIVO", periodo, cartera)
        repros = _comparativo_filas(conn, "PANEL_CENCO_COMPARATIVO_REPROS", periodo, cartera)

    return ComparativoResponseCenco(pagos=pagos, repros=repros)
