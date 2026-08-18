import csv
import io

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import text

from app.db.database import engine
from app.routers.auth import get_current_user
from app.schemas.panel_araucana import (
    BusquedaNegativaFilaAraucana,
    EmbargoAraucana,
    EstadoCarteraAraucana,
    NotificacionFilaAraucana,
)

_SABANA_COLUMNAS = """
    S.ID_PRODUCTO, S.ID_JUICIO, S.RUT_DEUDOR, S.DV_DEUDOR, S.NOMBRES_DEUDOR,
    S.ROL, S.TRIBUNAL, S.COD_TRIBUNAL, S.TIPO_JUICIO, S.FECHA_ASIGNACION,
    S.TRAMO, S.CLASIFICACION, S.CLASIFICACION_ETAPAS, S.ESTADO_EXHORTO,
    S.TIPO_GASTO, S.SUB_TIPO_GASTO, S.ULTIMO_GASTO, S.FECHA_GASTO,
    S.MONTO_GASTO, S.NOMBRE_RECEPTOR, S.ULTIMA_BITACORA, S.FECHA_BITACORA,
    S.CUANTIA, S.USUARIO, S.VIGENCIA,
    S.[INICIO 1], S.[CIERRE 1], S.[INICIO 2], S.[CIERRE 2],
    S.[INICIO 3], S.[CIERRE 3], S.[INICIO 4], S.[CIERRE 4],
    S.[INICIO 5], S.[CIERRE 5], S.[INICIO 6], S.[CIERRE 6],
    S.[INICIO 7], S.[CIERRE 7], S.[INICIO 8], S.[CIERRE 8],
    S.[INICIO 9], S.[CIERRE 9],
    S.LIMITE_ET1, S.LIMITE_ET2, S.LIMITE_ET3
"""

_EMBARGO_ETAPAS = [
    "TRIBUNAL ORDENA NOTIFICAR POR EL ART. 52",
    "TRIBUNAL DESIGNA MARTILLERO Y ORDENA PREVIA OPOSICIÓN AL RETIRO",
    "SUSPENDIDA POR ESTRATEGIA JUDICIAL- PROPUESTA CASTIGO",
    "SOLICITA SE GIRE CHEQUE POR CONSIGNACION",
    "SOLICITA RETIRO DE ESPECIES Y DESIGNE MARTILLERO",
    "SOLICITA FUERZA PÚBLICA PARA EL RETIRO",
    "SOLICITA CERTIFICADO NO EXCEPCIONES",
    "SE PRACTICA OPOSICIÓN AL RETIRO",
    "SE INTERPONEN EXCEPCIONES",
    "SE ENCARGA QUE SE CERTIFIQUE QUE FONDOS CONSIGNADOS EN CUENTA CORRIENTE DEL TRIBUNAL",
    "SE ENCARGA OPOSICIÓN AL RETIRO",
    "RETIRO FRUSTRADO",
    "MARTILLERO ACEPTA CARGO",
    "ENCARGO INCAUTADOR",
    "EMBARGO INSCRITO - VEHICULOS",
    "EMBARGO INSCRITO   (PROPIEDADES-VEHICULOS-IMPUESTOS-C.CORRIENTES)",
    "CHEQUE GIRADO",
]


def _csv_response(filas: list[dict], nombre_archivo: str) -> Response:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(filas[0].keys()), delimiter=";")
    writer.writeheader()
    writer.writerows(filas)
    return Response(
        content=output.getvalue().encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={nombre_archivo}"},
    )

router = APIRouter(prefix="/panel/araucana", tags=["panel-araucana"], dependencies=[Depends(get_current_user)])


def _resolver_periodo(conn, tabla: str, cartera: str) -> str:
    row = conn.execute(
        text(f"SELECT TOP 1 PERIODO FROM dbo.{tabla} WHERE ID_CARTERA = :cartera ORDER BY PERIODO DESC"),
        {"cartera": cartera},
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sin datos para esta cartera")
    return row[0]


@router.get("/estado-cartera", response_model=list[EstadoCarteraAraucana])
def estado_cartera(cartera: str = "16"):
    with engine.connect() as conn:
        periodo = _resolver_periodo(conn, "PANEL_ARAUCANA_ESTADO_CARTERA", cartera)
        query = text(
            """
            SELECT CLASIFICACION, TOTAL_JUICIOS, TOTAL_DEUDORES, MONTO_CUANTIA, PCT_JUICIOS, PCT_CUANTIA
            FROM dbo.PANEL_ARAUCANA_ESTADO_CARTERA
            WHERE TIPO_VISTA = 'CLASIFICACION'
              AND PERIODO = :periodo AND ID_CARTERA = :cartera
            ORDER BY CLASIFICACION
            """
        )
        rows = conn.execute(query, {"periodo": periodo, "cartera": cartera}).mappings().all()

    return [
        EstadoCarteraAraucana(
            clasificacion=r["CLASIFICACION"],
            total_juicios=r["TOTAL_JUICIOS"],
            total_deudores=r["TOTAL_DEUDORES"],
            monto_cuantia=r["MONTO_CUANTIA"],
            pct_juicios=r["PCT_JUICIOS"],
            pct_cuantia=r["PCT_CUANTIA"],
        )
        for r in rows
    ]


@router.get("/embargo", response_model=list[EmbargoAraucana])
def embargo(cartera: str = "16"):
    with engine.connect() as conn:
        periodo = _resolver_periodo(conn, "PANEL_ARAUCANA_EMBARGO", cartera)
        query = text(
            """
            SELECT ISNULL(CLASIFICACION_ETAPAS, 'SIN CLASIFICAR') AS CLASIFICACION_ETAPAS,
                   ISNULL(TOTAL_JUICIOS, 0) AS TOTAL_JUICIOS,
                   ISNULL(TOTAL_DEUDORES, 0) AS TOTAL_DEUDORES,
                   ISNULL(MONTO_CUANTIA, 0) AS MONTO_CUANTIA,
                   ISNULL(PCT_JUICIOS, 0) AS PCT_JUICIOS,
                   ISNULL(PCT_CUANTIA, 0) AS PCT_CUANTIA
            FROM dbo.PANEL_ARAUCANA_EMBARGO
            WHERE PERIODO = :periodo AND ID_CARTERA = :cartera
            ORDER BY TOTAL_JUICIOS DESC
            """
        )
        rows = conn.execute(query, {"periodo": periodo, "cartera": cartera}).mappings().all()

    return [
        EmbargoAraucana(
            clasificacion_etapas=r["CLASIFICACION_ETAPAS"],
            total_juicios=r["TOTAL_JUICIOS"],
            total_deudores=r["TOTAL_DEUDORES"],
            monto_cuantia=r["MONTO_CUANTIA"],
            pct_juicios=r["PCT_JUICIOS"],
            pct_cuantia=r["PCT_CUANTIA"],
        )
        for r in rows
    ]


@router.get("/notificacion", response_model=list[NotificacionFilaAraucana])
def notificacion(cartera: str = "16"):
    with engine.connect() as conn:
        periodo = _resolver_periodo(conn, "PANEL_ARAUCANA_ESTADO_CARTERA", cartera)
        query = text(
            """
            SELECT ISNULL(TIPO_NOTIFICACION, 'SIN TIPO') AS TIPO_NOTIFICACION,
                   ISNULL(CLASIFICACION_ACTUAL, 'SIN CLASIFICACION') AS CLASIFICACION_ACTUAL,
                   ISNULL(MESES_DESDE_NOTIF, 0) AS MESES_DESDE_NOTIF,
                   ISNULL(TOTAL_JUICIOS, 0) AS TOTAL_JUICIOS
            FROM dbo.PANEL_ARAUCANA_NOTIFICACION
            WHERE PERIODO = :periodo AND ID_CARTERA = :cartera
            ORDER BY TIPO_NOTIFICACION, CLASIFICACION_ACTUAL, MESES_DESDE_NOTIF
            """
        )
        rows = conn.execute(query, {"periodo": periodo, "cartera": cartera}).mappings().all()

    return [
        NotificacionFilaAraucana(
            tipo_notificacion=r["TIPO_NOTIFICACION"],
            clasificacion_actual=r["CLASIFICACION_ACTUAL"],
            meses_desde_notif=r["MESES_DESDE_NOTIF"],
            total_juicios=r["TOTAL_JUICIOS"],
        )
        for r in rows
    ]


@router.get("/busquedas-negativas", response_model=list[BusquedaNegativaFilaAraucana])
def busquedas_negativas(cartera: str = "16"):
    with engine.connect() as conn:
        periodo = _resolver_periodo(conn, "PANEL_ARAUCANA_ESTADO_CARTERA", cartera)
        query = text(
            """
            SELECT ISNULL(ULTIMO_TIPO_BUSQUEDA, 'SIN CLASIFICAR') AS ULTIMO_TIPO_BUSQUEDA,
                   ISNULL(Q_BUSQUEDAS, 0) AS Q_BUSQUEDAS,
                   ISNULL(TOTAL_JUICIOS, 0) AS TOTAL_JUICIOS
            FROM dbo.PANEL_ARAUCANA_BUSQUEDAS_NEG
            WHERE PERIODO = :periodo AND ID_CARTERA = :cartera
            ORDER BY ULTIMO_TIPO_BUSQUEDA, Q_BUSQUEDAS
            """
        )
        rows = conn.execute(query, {"periodo": periodo, "cartera": cartera}).mappings().all()

    return [
        BusquedaNegativaFilaAraucana(
            ultimo_tipo_busqueda=r["ULTIMO_TIPO_BUSQUEDA"],
            q_busquedas=r["Q_BUSQUEDAS"],
            total_juicios=r["TOTAL_JUICIOS"],
        )
        for r in rows
    ]


@router.get("/descarga")
def descarga(cartera: str = "16"):
    with engine.connect() as conn:
        periodo = _resolver_periodo(conn, "PANEL_ARAUCANA_ESTADO_CARTERA", cartera)
        query = text(
            f"""
            SELECT
                {_SABANA_COLUMNAS},
                ISNULL(H.MARCA2, 'OTRO') AS MARCA2,
                N.TIPO_NOTIFICACION,
                N.MESES_DESDE_NOTIF
            FROM [PROMETEO\\FASTCO].SISTEMA_JFASTCO.dbo.tbl_resultados_sabana S
            LEFT JOIN TBL_HOMOLOGACION_ARAUCANA H
                ON H.CLASIFICACION_ETAPA = UPPER(LTRIM(RTRIM(S.CLASIFICACION_ETAPAS)))
            LEFT JOIN (
                SELECT CE.ID_JUICIO,
                       CE.CLASIFICACION_ESTADO AS TIPO_NOTIFICACION,
                       DATEDIFF(MONTH, MIN(CE.FECHA_ESTADO), GETDATE()) AS MESES_DESDE_NOTIF
                FROM [PROMETEO\\FASTCO].[SISTEMA_JFASTCO].[dbo].TBL_CLASIFICACION_ESTADOS CE
                INNER JOIN [PROMETEO\\FASTCO].[SISTEMA_JFASTCO].[dbo].[TBL_JUICIO] TJ
                    ON TJ.ID_JUICIO = CE.ID_JUICIO
                WHERE TJ.ID_PRODUCTO = :cartera_int
                  AND CE.CLASIFICACION_ESTADO IN ('NOTIFICADO POR EL 44', 'NOTIFICADO PERSONAL')
                GROUP BY CE.ID_JUICIO, CE.CLASIFICACION_ESTADO
            ) N ON N.ID_JUICIO = S.ID_JUICIO
            WHERE S.ID_PRODUCTO = :cartera_int
              AND S.VIGENCIA = 'ACTIVO'
            ORDER BY S.ID_JUICIO
            """
        )
        rows = conn.execute(query, {"cartera_int": int(cartera)}).mappings().all()

    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sin datos")

    return _csv_response([dict(r) for r in rows], f"sabana_cartera_{cartera}_{periodo}.csv")


@router.get("/descarga-embargo")
def descarga_embargo(cartera: str = "16"):
    with engine.connect() as conn:
        periodo = _resolver_periodo(conn, "PANEL_ARAUCANA_EMBARGO", cartera)
        etapas_params = {f"etapa{i}": etapa for i, etapa in enumerate(_EMBARGO_ETAPAS)}
        etapas_in = ", ".join(f":{k}" for k in etapas_params)
        query = text(
            f"""
            SELECT
                {_SABANA_COLUMNAS},
                ISNULL(H.MARCA2, 'OTRO') AS MARCA2,
                E.FECHA_PRIMERA_EMBARGO,
                DATEDIFF(DAY, E.FECHA_PRIMERA_EMBARGO, GETDATE()) AS DIAS_DESDE_EMBARGO
            FROM [PROMETEO\\FASTCO].SISTEMA_JFASTCO.dbo.tbl_resultados_sabana S
            LEFT JOIN TBL_HOMOLOGACION_ARAUCANA H
                ON H.CLASIFICACION_ETAPA = UPPER(LTRIM(RTRIM(S.CLASIFICACION_ETAPAS)))
            LEFT JOIN (
                SELECT CE.ID_JUICIO, MIN(CE.FECHA_ESTADO) AS FECHA_PRIMERA_EMBARGO
                FROM [PROMETEO\\FASTCO].[SISTEMA_JFASTCO].[dbo].TBL_CLASIFICACION_ESTADOS CE
                INNER JOIN [PROMETEO\\FASTCO].[SISTEMA_JFASTCO].[dbo].[TBL_JUICIO] TJ
                    ON TJ.ID_JUICIO = CE.ID_JUICIO
                WHERE TJ.ID_PRODUCTO = :cartera_int
                  AND (CE.CLASIFICACION_ESTADO LIKE '%EMBARGO%'
                    OR CE.CLASIFICACION_ESTADO LIKE '%INCAUTAD%'
                    OR CE.CLASIFICACION_ESTADO LIKE '%RETIRO%'
                    OR CE.CLASIFICACION_ESTADO LIKE '%MARTILLERO%'
                    OR CE.CLASIFICACION_ESTADO LIKE '%CONSIGNACI%')
                GROUP BY CE.ID_JUICIO
            ) E ON E.ID_JUICIO = S.ID_JUICIO
            WHERE S.ID_PRODUCTO = :cartera_int
              AND S.VIGENCIA = 'ACTIVO'
              AND UPPER(LTRIM(RTRIM(S.CLASIFICACION_ETAPAS))) IN ({etapas_in})
            ORDER BY S.CLASIFICACION_ETAPAS, S.RUT_DEUDOR
            """
        )
        rows = conn.execute(query, {"cartera_int": int(cartera), **etapas_params}).mappings().all()

    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sin datos de embargo")

    return _csv_response([dict(r) for r in rows], f"embargo_cartera_{cartera}_{periodo}.csv")
