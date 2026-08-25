"""
ETL UNICRE — CSV → JUDICIAL.dbo.TBL_PAGOS_UNICRE
=================================================
Carga pagos desde CSV e inyecta:
- fecha_carga (timestamp de ejecución)
- periodo (YYYYMM)
- carga incremental por llave (periodo, operacion, cuota)

Uso:
    python etl_unicre_carga_pagos.py --archivo pagos_unicre.csv --periodo 202608
    python etl_unicre_carga_pagos.py
        Abre el selector de CSV y solicita el período.
"""

import argparse
import csv
import os
from datetime import datetime

import pandas as pd
import pyodbc

from _conn import build_pyodbc_conn_str
from _resultado import ejecutar, emitir_resultado

CONN_STR = build_pyodbc_conn_str()
BATCH_SIZE = 5000

COLUMNAS_CSV = [
    "fechaemision",
    "rut_deudor",
    "nombre_deudor",
    "operacion",
    "fechavcto",
    "fechapago",
    "cuota",
    "valcuota",
    "interesmora",
    "gastocobranza",
    "montototal",
]

COLUMNAS_ENTERO = [
    "operacion",
    "cuota",
    "valcuota",
    "interesmora",
    "gastocobranza",
    "montototal",
]

COLUMNAS_FECHA = ["fechaemision", "fechavcto", "fechapago"]


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}")


def validar_periodo(periodo: str) -> str:
    p = (periodo or "").strip()
    if len(p) != 6 or not p.isdigit():
        raise ValueError(f"Periodo inválido: {periodo}. Debe tener formato YYYYMM.")
    return p


def seleccionar_archivo_y_periodo() -> tuple[str, str]:
    """Permite seleccionar el CSV y su período cuando no se usan argumentos."""
    import tkinter as tk
    from tkinter import filedialog, messagebox, simpledialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    try:
        ruta_csv = filedialog.askopenfilename(
            title="Seleccionar archivo de pagos UNICRE",
            filetypes=[("CSV", "*.csv"), ("Todos", "*.*")],
            parent=root,
        )
        if not ruta_csv:
            messagebox.showwarning("Cancelado", "No se seleccionó ningún archivo.", parent=root)
            raise SystemExit(0)

        periodo = simpledialog.askstring(
            "Período",
            "Ingrese el período (formato YYYYMM)\nEjemplo: 202608",
            initialvalue=datetime.now().strftime("%Y%m"),
            parent=root,
        )
        if not periodo:
            messagebox.showwarning("Cancelado", "No se ingresó el período.", parent=root)
            raise SystemExit(0)

        try:
            return ruta_csv, validar_periodo(periodo)
        except ValueError as error:
            messagebox.showerror("Error", str(error), parent=root)
            raise SystemExit(1) from error
    finally:
        root.destroy()


def detectar_delimitador(ruta_csv: str) -> str:
    with open(ruta_csv, "r", encoding="utf-8-sig", newline="") as f:
        muestra = f.read(4096)
    dialecto = csv.Sniffer().sniff(muestra, delimiters=",;|\t")
    return dialecto.delimiter


def leer_csv(ruta_csv: str) -> pd.DataFrame:
    if not os.path.exists(ruta_csv):
        raise FileNotFoundError(f"Archivo no encontrado: {ruta_csv}")

    delimitador = detectar_delimitador(ruta_csv)
    log(f"Delimitador detectado: '{delimitador}'")
    try:
        df = pd.read_csv(ruta_csv, sep=delimitador, dtype=str, encoding="utf-8-sig")
    except UnicodeDecodeError:
        df = pd.read_csv(ruta_csv, sep=delimitador, dtype=str, encoding="latin-1")

    df.columns = [c.strip().lower() for c in df.columns]
    faltantes = [c for c in COLUMNAS_CSV if c not in df.columns]
    if faltantes:
        raise ValueError(f"Columnas faltantes en CSV: {faltantes}")

    return df[COLUMNAS_CSV].copy()


def transformar(df: pd.DataFrame, periodo: str) -> pd.DataFrame:
    df = df.copy()

    for col in ["rut_deudor", "nombre_deudor"]:
        df[col] = df[col].astype(str).str.strip()
    df["rut_deudor"] = df["rut_deudor"].str.slice(0, 11)
    df["nombre_deudor"] = df["nombre_deudor"].str.slice(0, 100)

    for col in COLUMNAS_ENTERO:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    for col in COLUMNAS_FECHA:
        df[col] = pd.to_datetime(df[col], format="%d-%m-%Y", errors="coerce")

    filas_invalidas = set()
    for col in COLUMNAS_ENTERO + COLUMNAS_FECHA + ["rut_deudor", "nombre_deudor"]:
        invalidas_col = df.index[df[col].isna()].tolist()
        filas_invalidas.update(invalidas_col)

    filas_invalidas = sorted(filas_invalidas)
    if filas_invalidas:
        muestras = [str(i + 2) for i in filas_invalidas[:10]]
        raise ValueError(
            "Se detectaron filas inválidas en el CSV. "
            f"Primeras filas: {', '.join(muestras)}. "
            "Corrige el archivo y vuelve a ejecutar."
        )

    for col in COLUMNAS_ENTERO:
        df[col] = df[col].astype(int)

    for col in COLUMNAS_FECHA:
        df[col] = df[col].dt.strftime("%Y-%m-%d")

    df["periodo"] = periodo
    df["fecha_carga"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return df


def conectar() -> pyodbc.Connection:
    return pyodbc.connect(CONN_STR)


def crear_tabla_si_no_existe(cur: pyodbc.Cursor) -> None:
    cur.execute(
        """
        IF OBJECT_ID('dbo.TBL_PAGOS_UNICRE', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.TBL_PAGOS_UNICRE (
                id_carga      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                fecha_carga   DATETIME NOT NULL,
                periodo       NVARCHAR(6) NOT NULL,
                fechaemision  DATE NOT NULL,
                rut_deudor    NVARCHAR(11) NOT NULL,
                nombre_deudor NVARCHAR(100) NOT NULL,
                operacion     INT NOT NULL,
                fechavcto     DATE NOT NULL,
                fechapago     DATE NOT NULL,
                cuota         INT NOT NULL,
                valcuota      INT NOT NULL,
                interesmora   INT NOT NULL,
                gastocobranza INT NOT NULL,
                montototal    INT NOT NULL
            );
        END
        """
    )


def insertar_faltantes(cur: pyodbc.Cursor, df: pd.DataFrame) -> int:
    cur.execute(
        """
        IF OBJECT_ID('tempdb..#TMP_PAGOS_UNICRE') IS NOT NULL
            DROP TABLE #TMP_PAGOS_UNICRE;

        CREATE TABLE #TMP_PAGOS_UNICRE (
            fecha_carga   DATETIME NOT NULL,
            periodo       NVARCHAR(6) NOT NULL,
            fechaemision  DATE NOT NULL,
            rut_deudor    NVARCHAR(11) NOT NULL,
            nombre_deudor NVARCHAR(100) NOT NULL,
            operacion     INT NOT NULL,
            fechavcto     DATE NOT NULL,
            fechapago     DATE NOT NULL,
            cuota         INT NOT NULL,
            valcuota      INT NOT NULL,
            interesmora   INT NOT NULL,
            gastocobranza INT NOT NULL,
            montototal    INT NOT NULL
        );
        """
    )

    sql_tmp = """
        INSERT INTO #TMP_PAGOS_UNICRE (
            fecha_carga,
            periodo,
            fechaemision,
            rut_deudor,
            nombre_deudor,
            operacion,
            fechavcto,
            fechapago,
            cuota,
            valcuota,
            interesmora,
            gastocobranza,
            montototal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    cur.fast_executemany = True
    cols = [
        "fecha_carga",
        "periodo",
        "fechaemision",
        "rut_deudor",
        "nombre_deudor",
        "operacion",
        "fechavcto",
        "fechapago",
        "cuota",
        "valcuota",
        "interesmora",
        "gastocobranza",
        "montototal",
    ]

    for i in range(0, len(df), BATCH_SIZE):
        batch = df.iloc[i : i + BATCH_SIZE]
        values = [tuple(row[col] for col in cols) for _, row in batch.iterrows()]
        cur.executemany(sql_tmp, values)

    cur.execute(
        """
        SET NOCOUNT ON;

        DECLARE @insertadas INT;

        ;WITH fuente AS (
            SELECT
                fecha_carga,
                periodo,
                fechaemision,
                rut_deudor,
                nombre_deudor,
                operacion,
                fechavcto,
                fechapago,
                cuota,
                valcuota,
                interesmora,
                gastocobranza,
                montototal,
                ROW_NUMBER() OVER (
                    PARTITION BY periodo, operacion, cuota
                    ORDER BY fecha_carga, operacion, cuota
                ) AS rn
            FROM #TMP_PAGOS_UNICRE
        )
        INSERT INTO dbo.TBL_PAGOS_UNICRE (
            fecha_carga,
            periodo,
            fechaemision,
            rut_deudor,
            nombre_deudor,
            operacion,
            fechavcto,
            fechapago,
            cuota,
            valcuota,
            interesmora,
            gastocobranza,
            montototal
        )
        SELECT
            s.fecha_carga,
            s.periodo,
            s.fechaemision,
            s.rut_deudor,
            s.nombre_deudor,
            s.operacion,
            s.fechavcto,
            s.fechapago,
            s.cuota,
            s.valcuota,
            s.interesmora,
            s.gastocobranza,
            s.montototal
        FROM fuente s
        WHERE s.rn = 1
        AND NOT EXISTS (
            SELECT 1
            FROM dbo.TBL_PAGOS_UNICRE t
            WHERE t.periodo = s.periodo
                AND t.operacion = s.operacion
                AND t.cuota = s.cuota
        );

        SET @insertadas = @@ROWCOUNT;

        SELECT @insertadas AS insertadas;
        """
    )
    insertadas = int(cur.fetchone()[0])
    return insertadas


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL CSV UNICRE → TBL_PAGOS_UNICRE")
    parser.add_argument("--archivo", help="Ruta del CSV a cargar")
    parser.add_argument(
        "--periodo",
        help="Periodo en formato YYYYMM",
    )
    args = parser.parse_args()

    if args.archivo and args.periodo:
        archivo = args.archivo
        periodo = validar_periodo(args.periodo)
    elif args.archivo or args.periodo:
        parser.error("--archivo y --periodo deben indicarse juntos.")
    else:
        archivo, periodo = seleccionar_archivo_y_periodo()

    log(f"Inicio ETL UNICRE | periodo={periodo}")
    log(f"Archivo: {archivo}")

    df_origen = leer_csv(archivo)
    log(f"Filas leídas: {len(df_origen)}")
    df = transformar(df_origen, periodo)

    conn = conectar()
    cur = conn.cursor()
    try:
        crear_tabla_si_no_existe(cur)
        insertadas = insertar_faltantes(cur, df)
        omitidas = len(df) - insertadas
        conn.commit()
        log(
            f"Carga finalizada: {insertadas} insertadas, {omitidas} omitidas por llave existente "
            "(periodo, operacion, cuota)."
        )
        emitir_resultado(
            ok=True,
            mensaje=f"Carga finalizada: {insertadas} insertadas, {omitidas} omitidas.",
            periodo=periodo,
            insertadas=insertadas,
            omitidas=omitidas,
        )
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    ejecutar(main)