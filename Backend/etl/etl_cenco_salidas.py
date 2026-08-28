"""
ETL CENCO SALIDAS - Excel/CSV -> JUDICIAL.dbo.TBL_SALIDAS_CENCO

Uso interactivo:
    python etl_cenco_salidas.py

Uso automatizado:
    python etl_cenco_salidas.py --archivo salidas.xlsx --periodo 202608 --hoja Hoja1
    python etl_cenco_salidas.py --archivo salidas.csv --periodo 202608
    python etl_cenco_salidas.py --archivo <tmp> --periodo 202608 --source-file Salidas_202608.xlsx
"""

import argparse
import csv
import os
import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

import pandas as pd
import pyodbc

from _conn import build_pyodbc_conn_str
from _resultado import ejecutar, emitir_resultado

TABLE_NAME = "dbo.TBL_SALIDAS_CENCO"
ID_PRODUCTO_FIJO = 5
BATCH_SIZE = 5000
CONN_STR = build_pyodbc_conn_str()

STRING_COLUMNS = {
    "SOURCE_FILE": 60,
    "U6ID": 25,
    "GESTOR_MADRE": 2,
    "GESTOR": 2,
    "DV": 1,
    "MARCA_STOCK_FLUJO": 5,
    "MARCA_GLOSA_NORMALIZACION": 60,
    "MARCA_GLOSA_ABOGADOS": 60,
    "OPERACION": 12,
    "TIPO_TARJETA": 2,
    "TIPO_CUENTA": 7,
    "PILOTO_AVANCE_JUDICIAL": 60,
}

INTEGER_COLUMNS = {
    "CARTERA",
    "RUT",
    "DDA_TOTAL_INICIO",
    "DDA_MOROSA_INICIO",
    "DDA_TOTAL_ACTUAL",
    "DDA_MOROSA_ACTUAL",
    "DEUDA_CAST",
}

DATE_COLUMNS = {
    "FECICAR",
    "FECHA_CASTIGO",
    "FECHA_CREACION_JUICIO",
    "FECHA_SALIDA",
    "FECHA_EMBARGO",
    "FECHA_DA_CUENTA_PAGO",
    "FECHA_PROVEE_TRIBUNAL",
    "FECHA_CERTIFICACION",
}

BUSINESS_COLUMNS = [
    "U6ID",
    "GESTOR_MADRE",
    "CARTERA",
    "GESTOR",
    "FECICAR",
    "RUT",
    "DV",
    "DDA_TOTAL_INICIO",
    "DDA_MOROSA_INICIO",
    "DDA_TOTAL_ACTUAL",
    "DDA_MOROSA_ACTUAL",
    "DEUDA_CAST",
    "FECHA_CASTIGO",
    "MARCA_STOCK_FLUJO",
    "MARCA_GLOSA_NORMALIZACION",
    "MARCA_GLOSA_ABOGADOS",
    "OPERACION",
    "TIPO_TARJETA",
    "FECHA_CREACION_JUICIO",
    "TIPO_CUENTA",
    "FECHA_SALIDA",
    "PILOTO_AVANCE_JUDICIAL",
    "FECHA_EMBARGO",
    "FECHA_DA_CUENTA_PAGO",
    "FECHA_PROVEE_TRIBUNAL",
    "FECHA_CERTIFICACION",
]

DEDUPE_KEY_COLUMNS = ["U6ID", "RUT", "OPERACION", "FECHA_SALIDA"]

TABLE_COLUMNS = [
    "ID_PRODUCTO",
    "FECHA_CARGA",
    "SOURCE_FILE",
    "PERIODO",
    *BUSINESS_COLUMNS,
]

HEADER_ALIASES = {
    "U6ID": ("u6id", "cuenta"),
    "GESTOR_MADRE": ("gestor_madre",),
    "CARTERA": ("cartera",),
    "GESTOR": ("gestor",),
    "FECICAR": ("fecicar",),
    "RUT": ("rut",),
    "DV": ("dv",),
    "DDA_TOTAL_INICIO": ("dda_total_inicio",),
    "DDA_MOROSA_INICIO": ("dda_morosa_inicio",),
    "DDA_TOTAL_ACTUAL": ("dda_total_actual",),
    "DDA_MOROSA_ACTUAL": ("dda_morosa_actual",),
    "DEUDA_CAST": ("deuda_cast",),
    "FECHA_CASTIGO": ("fecha_castigo",),
    "MARCA_STOCK_FLUJO": ("marca_stock_flujo",),
    "MARCA_GLOSA_NORMALIZACION": ("marca_glosa_normalizacion",),
    "MARCA_GLOSA_ABOGADOS": ("marca_glosa_abogados",),
    "OPERACION": ("operacion",),
    "TIPO_TARJETA": ("tipo_tarjeta",),
    "FECHA_CREACION_JUICIO": ("fecha_creacion_juicio",),
    "TIPO_CUENTA": ("tipo_cuenta", "tipo_de_cuenta"),
    "FECHA_SALIDA": ("fecha_salida",),
    "PILOTO_AVANCE_JUDICIAL": ("piloto_avance_judicial",),
    "FECHA_EMBARGO": ("fecha_embargo",),
    "FECHA_DA_CUENTA_PAGO": ("fecha_da_cuenta_pago",),
    "FECHA_PROVEE_TRIBUNAL": ("fecha_provee_tribunal",),
    "FECHA_CERTIFICACION": ("fecha_certificacion",),
}


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}")


def validar_periodo(periodo: str) -> str:
    valor = (periodo or "").strip()
    if len(valor) != 6 or not valor.isdigit():
        raise ValueError(f"Periodo invalido: {periodo}. Debe tener formato YYYYMM.")
    return valor


def normalizar_encabezado(value: object) -> str:
    texto = unicodedata.normalize("NFKD", str(value))
    texto = texto.encode("ascii", "ignore").decode("ascii").lower().strip()
    return re.sub(r"[^a-z0-9]+", "_", texto).strip("_")


def seleccionar_archivo_periodo_hoja() -> tuple[str, str, str | None]:
    import tkinter as tk
    from tkinter import filedialog, messagebox, simpledialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        archivo = filedialog.askopenfilename(
            title="Seleccionar archivo de salidas CENCO",
            filetypes=[
                ("Archivos soportados", "*.xlsx *.xls *.csv"),
                ("Excel", "*.xlsx *.xls"),
                ("CSV", "*.csv"),
                ("Todos", "*.*"),
            ],
            parent=root,
        )
        if not archivo:
            messagebox.showwarning("Cancelado", "No se selecciono ningun archivo.", parent=root)
            raise SystemExit(0)

        periodo_texto = simpledialog.askstring(
            "Periodo",
            "Ingrese el periodo (formato YYYYMM)\nEjemplo: 202608",
            initialvalue=datetime.now().strftime("%Y%m"),
            parent=root,
        )
        if not periodo_texto:
            messagebox.showwarning("Cancelado", "No se ingreso el periodo.", parent=root)
            raise SystemExit(0)

        periodo = validar_periodo(periodo_texto)
        hoja = None

        extension = os.path.splitext(archivo)[1].lower()
        if extension in {".xlsx", ".xls"}:
            hojas = pd.ExcelFile(archivo).sheet_names
            if len(hojas) > 1:
                hoja_sel = simpledialog.askstring(
                    "Hoja de Excel",
                    f"Hojas disponibles:\n{', '.join(hojas)}\n\nIngrese el nombre de la hoja a cargar:",
                    parent=root,
                )
                if hoja_sel not in hojas:
                    messagebox.showerror("Error", "Debe seleccionar una hoja existente.", parent=root)
                    raise SystemExit(1)
                hoja = hoja_sel
            else:
                hoja = hojas[0]

        return archivo, periodo, hoja
    finally:
        root.destroy()


def detectar_delimitador(ruta_csv: str) -> str:
    with open(ruta_csv, "r", encoding="utf-8-sig", newline="") as f:
        muestra = f.read(4096)
    dialecto = csv.Sniffer().sniff(muestra, delimiters=",;|\t")
    return dialecto.delimiter


def resolver_hoja_excel(archivo: str, hoja: str | None) -> str:
    hojas = pd.ExcelFile(archivo).sheet_names
    if hoja:
        if hoja not in hojas:
            raise ValueError(f"La hoja '{hoja}' no existe. Hojas disponibles: {', '.join(hojas)}")
        return hoja
    if len(hojas) == 1:
        return hojas[0]
    raise ValueError(
        f"El archivo tiene varias hojas ({', '.join(hojas)}). Indique la hoja mediante --hoja."
    )


def leer_archivo(archivo: str, hoja: str | None) -> pd.DataFrame:
    if not os.path.isfile(archivo):
        raise FileNotFoundError(f"Archivo no encontrado: {archivo}")

    extension = os.path.splitext(archivo)[1].lower()
    if extension in {".xlsx", ".xls"}:
        hoja_resuelta = resolver_hoja_excel(archivo, hoja)
        log(f"Leyendo Excel: {archivo} | hoja={hoja_resuelta}")
        return pd.read_excel(archivo, sheet_name=hoja_resuelta)

    if extension == ".csv":
        delimitador = detectar_delimitador(archivo)
        log(f"Leyendo CSV: {archivo} | delimitador='{delimitador}'")
        try:
            return pd.read_csv(archivo, sep=delimitador, dtype=str, encoding="utf-8-sig")
        except UnicodeDecodeError:
            return pd.read_csv(archivo, sep=delimitador, dtype=str, encoding="latin-1")

    raise ValueError(
        f"Formato de archivo no soportado: {extension}. Use Excel (.xlsx/.xls) o CSV (.csv)."
    )


def mapear_columnas(df_origen: pd.DataFrame) -> dict[str, str]:
    normalizadas = {col: normalizar_encabezado(col) for col in df_origen.columns}
    mapeo: dict[str, str] = {}
    usadas: set[str] = set()

    for destino, aliases in HEADER_ALIASES.items():
        origen = next(
            (
                col
                for col, normalizada in normalizadas.items()
                if col not in usadas and normalizada in aliases
            ),
            None,
        )
        if origen is None:
            raise ValueError(
                f"No se encontro la columna requerida para {destino}. "
                f"Encabezados disponibles: {', '.join(map(str, df_origen.columns))}"
            )
        mapeo[destino] = origen
        usadas.add(origen)

    return mapeo


def convertir_texto(value: object, columna: str, largo_maximo: int) -> str | None:
    if pd.isna(value):
        return None
    texto = str(value).strip()
    if not texto or texto.lower() in {"nan", "none", "nat"}:
        return None
    if len(texto) > largo_maximo:
        raise ValueError(f"{columna} supera el largo maximo de {largo_maximo}: '{texto}'")
    return texto


def convertir_entero(value: object, columna: str) -> int | None:
    if pd.isna(value) or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, bool):
        raise ValueError(f"{columna} no acepta valores booleanos.")
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if value.is_integer():
            return int(value)
        raise ValueError(f"{columna} debe ser entero: {value}.")

    texto = str(value).strip().replace("$", "").replace("%", "").replace(" ", "")
    if "," in texto and "." in texto:
        separador_decimal = "," if texto.rfind(",") > texto.rfind(".") else "."
        separador_miles = "." if separador_decimal == "," else ","
        texto = texto.replace(separador_miles, "").replace(separador_decimal, ".")
    elif "," in texto or "." in texto:
        separador = "," if "," in texto else "."
        parte_final = texto.rsplit(separador, 1)[1]
        if len(parte_final) <= 2:
            texto = texto.replace(separador, ".")
        else:
            texto = texto.replace(separador, "")

    try:
        numero = Decimal(texto)
    except InvalidOperation as error:
        raise ValueError(f"{columna} debe ser entero: {value}.") from error

    if numero != numero.to_integral_value():
        raise ValueError(f"{columna} debe ser entero: {value}.")
    return int(numero)


def convertir_fecha(value: object, columna: str) -> date | None:
    if pd.isna(value) or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    texto = str(value).strip()
    if texto.lower() in {"nan", "none", "nat"}:
        return None

    if texto.isdigit() and len(texto) == 8:
        try:
            return datetime.strptime(texto, "%Y%m%d").date()
        except ValueError as error:
            raise ValueError(f"{columna} tiene fecha invalida: {value}.") from error

    formatos = ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%d.%m.%Y")
    for fmt in formatos:
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            continue

    fecha = pd.to_datetime(texto, errors="coerce", dayfirst=True)
    if pd.isna(fecha):
        raise ValueError(f"{columna} tiene fecha invalida: {value}.")
    return fecha.date()


def transformar(df_origen: pd.DataFrame, periodo: str, source_file: str) -> tuple[pd.DataFrame, int]:
    mapeo = mapear_columnas(df_origen)
    fecha_carga = datetime.now()
    source_file_limpio = convertir_texto(source_file, "SOURCE_FILE", STRING_COLUMNS["SOURCE_FILE"])
    if not source_file_limpio:
        raise ValueError("SOURCE_FILE no puede quedar vacio.")

    registros: list[dict[str, object]] = []
    errores: list[str] = []

    for idx, row in df_origen.iterrows():
        fila_excel = idx + 2
        try:
            registro: dict[str, object] = {
                "ID_PRODUCTO": ID_PRODUCTO_FIJO,
                "FECHA_CARGA": fecha_carga,
                "SOURCE_FILE": source_file_limpio,
                "PERIODO": int(periodo),
            }

            for destino, origen in mapeo.items():
                valor = row[origen]
                if destino in STRING_COLUMNS:
                    registro[destino] = convertir_texto(valor, destino, STRING_COLUMNS[destino])
                elif destino in INTEGER_COLUMNS:
                    registro[destino] = convertir_entero(valor, destino)
                elif destino in DATE_COLUMNS:
                    registro[destino] = convertir_fecha(valor, destino)
                else:
                    registro[destino] = valor

            if not registro["U6ID"]:
                raise ValueError("U6ID es obligatorio.")

            registros.append(registro)
        except ValueError as error:
            errores.append(f"Fila {fila_excel}: {error}")

    if errores:
        detalle = "\n".join(errores[:15])
        restante = len(errores) - min(len(errores), 15)
        sufijo = f"\n... y {restante} error(es) adicional(es)." if restante > 0 else ""
        raise ValueError(
            "Se detectaron errores de validacion; no se cargo informacion.\n"
            f"{detalle}{sufijo}"
        )

    if not registros:
        raise ValueError("No se obtuvieron registros validos para cargar.")

    df = pd.DataFrame(registros, columns=TABLE_COLUMNS)
    antes = len(df)
    df = df.drop_duplicates(subset=DEDUPE_KEY_COLUMNS, keep="first")
    duplicados_en_archivo = antes - len(df)

    return df, duplicados_en_archivo


def cargar_incremental(df: pd.DataFrame) -> int:
    tmp_table = "#TMP_SALIDAS_CENCO"

    with pyodbc.connect(CONN_STR) as conn:
        conn.autocommit = False
        cur = conn.cursor()
        cur.fast_executemany = True

        try:
            cur.execute(
                f"""
                IF OBJECT_ID('tempdb..{tmp_table}') IS NOT NULL
                    DROP TABLE {tmp_table};

                CREATE TABLE {tmp_table} (
                    ID_PRODUCTO                 INT NOT NULL,
                    FECHA_CARGA                 DATETIME NOT NULL,
                    SOURCE_FILE                 NVARCHAR(60) NOT NULL,
                    PERIODO                     INT NOT NULL,
                    U6ID                        NVARCHAR(25) NULL,
                    GESTOR_MADRE                NVARCHAR(2) NULL,
                    CARTERA                     INT NULL,
                    GESTOR                      NVARCHAR(2) NULL,
                    FECICAR                     DATE NULL,
                    RUT                         INT NULL,
                    DV                          NVARCHAR(1) NULL,
                    DDA_TOTAL_INICIO            INT NULL,
                    DDA_MOROSA_INICIO           INT NULL,
                    DDA_TOTAL_ACTUAL            INT NULL,
                    DDA_MOROSA_ACTUAL           INT NULL,
                    DEUDA_CAST                  INT NULL,
                    FECHA_CASTIGO               DATE NULL,
                    MARCA_STOCK_FLUJO           NVARCHAR(5) NULL,
                    MARCA_GLOSA_NORMALIZACION   NVARCHAR(60) NULL,
                    MARCA_GLOSA_ABOGADOS        NVARCHAR(60) NULL,
                    OPERACION                   NVARCHAR(12) NULL,
                    TIPO_TARJETA                NVARCHAR(2) NULL,
                    FECHA_CREACION_JUICIO       DATE NULL,
                    TIPO_CUENTA                 NVARCHAR(7) NULL,
                    FECHA_SALIDA                DATE NULL,
                    PILOTO_AVANCE_JUDICIAL      NVARCHAR(60) NULL,
                    FECHA_EMBARGO               DATE NULL,
                    FECHA_DA_CUENTA_PAGO        DATE NULL,
                    FECHA_PROVEE_TRIBUNAL       DATE NULL,
                    FECHA_CERTIFICACION         DATE NULL
                );
                """
            )

            placeholders = ", ".join("?" for _ in TABLE_COLUMNS)
            columnas_sql = ", ".join(f"[{col}]" for col in TABLE_COLUMNS)
            sql_tmp = f"INSERT INTO {tmp_table} ({columnas_sql}) VALUES ({placeholders})"

            valores = [
                tuple(None if pd.isna(value) else value for value in fila)
                for fila in df.itertuples(index=False, name=None)
            ]

            cur.fast_executemany = True
            for inicio in range(0, len(valores), BATCH_SIZE):
                cur.executemany(sql_tmp, valores[inicio : inicio + BATCH_SIZE])

            comparaciones = [
                "t.[PERIODO] = s.[PERIODO]",
                "((t.[U6ID] = s.[U6ID]) OR (t.[U6ID] IS NULL AND s.[U6ID] IS NULL))",
                "((t.[RUT] = s.[RUT]) OR (t.[RUT] IS NULL AND s.[RUT] IS NULL))",
                "((t.[OPERACION] = s.[OPERACION]) OR (t.[OPERACION] IS NULL AND s.[OPERACION] IS NULL))",
                "((t.[FECHA_SALIDA] = s.[FECHA_SALIDA]) OR (t.[FECHA_SALIDA] IS NULL AND s.[FECHA_SALIDA] IS NULL))",
            ]
            where_not_exists = " AND ".join(comparaciones)

            sql_insert = f"""
                INSERT INTO {TABLE_NAME} ({columnas_sql})
                SELECT {columnas_sql}
                FROM {tmp_table} s
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM {TABLE_NAME} t
                    WHERE {where_not_exists}
                );
            """

            cur.execute(sql_insert)
            insertadas = int(cur.rowcount if cur.rowcount is not None and cur.rowcount >= 0 else 0)
            conn.commit()
            return insertadas
        except Exception:
            conn.rollback()
            raise


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL salidas CENCO -> TBL_SALIDAS_CENCO")
    parser.add_argument("--archivo", help="Ruta del archivo Excel/CSV")
    parser.add_argument("--periodo", help="Periodo en formato YYYYMM")
    parser.add_argument("--hoja", help="Nombre de hoja (solo Excel con multiples hojas)")
    parser.add_argument(
        "--source-file",
        help="Nombre original del archivo cargado (opcional, para metadata SOURCE_FILE)",
    )
    args = parser.parse_args()

    if args.archivo and args.periodo:
        archivo = args.archivo
        periodo = validar_periodo(args.periodo)
        hoja = args.hoja
    elif args.archivo or args.periodo or args.hoja:
        parser.error("--archivo y --periodo deben indicarse juntos; --hoja es opcional.")
    else:
        archivo, periodo, hoja = seleccionar_archivo_periodo_hoja()

    log(f"Inicio ETL salidas CENCO | periodo={periodo}")
    log(f"Archivo: {archivo}")

    source_file = (args.source_file or "").strip() or os.path.basename(archivo)
    df_origen = leer_archivo(archivo, hoja)
    log(f"Filas leidas: {len(df_origen)}")

    df, duplicados_en_archivo = transformar(df_origen, periodo, source_file)
    if duplicados_en_archivo:
        log(
            f"Duplicados exactos dentro del archivo para el payload de negocio: "
            f"{duplicados_en_archivo} fila(s) omitida(s)."
        )

    insertadas = cargar_incremental(df)
    omitidas_existentes = len(df) - insertadas

    log(
        f"Carga finalizada: {insertadas} insertadas, "
        f"{omitidas_existentes} omitidas por ya existir en el mismo periodo."
    )
    emitir_resultado(
        ok=True,
        mensaje=(
            f"Carga finalizada: {insertadas} insertadas, "
            f"{omitidas_existentes} omitidas por duplicado del periodo."
        ),
        periodo=periodo,
        source_file=source_file,
        total_entrada=len(df_origen),
        duplicados_en_archivo=duplicados_en_archivo,
        evaluadas_para_carga=len(df),
        insertadas=insertadas,
        omitidas_existentes=omitidas_existentes,
    )


if __name__ == "__main__":
    ejecutar(main)
