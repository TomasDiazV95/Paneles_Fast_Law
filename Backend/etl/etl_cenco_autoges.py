"""
ETL CENCO AUTOGES - Excel/CSV -> JUDICIAL.dbo.TBL_AUTOGES_CENCO.

Uso interactivo:
    python etl_cenco_autoges.py

Uso automatizado (varios archivos bajo un mismo período):
    python etl_cenco_autoges.py --periodo 202608 \
        --archivo Autoges_H1.xlsx --hoja Hoja1 \
        --archivo Autoges_H7.xlsx --hoja Hoja1

Para reemplazar explícitamente el período después de validar todos los archivos:
    python etl_cenco_autoges.py --periodo 202608 --archivo Autoges_H1.xlsx \
        --limpiar-periodo

--hoja y --source-file son repetibles y se asocian por posición con --archivo.
Si se informa alguno de esos parámetros, se debe informar uno por cada archivo.
"""

import argparse
import csv
import os
import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import pandas as pd
import pyodbc

from _conn import build_pyodbc_conn_str
from _resultado import ejecutar, emitir_resultado

TABLE_NAME = "dbo.TBL_AUTOGES_CENCO"
ID_PRODUCTO_FIJO = 5
BATCH_SIZE = 5000
CONN_STR = build_pyodbc_conn_str()
SQL_INT_MIN = -2147483648
SQL_INT_MAX = 2147483647

STRING_COLUMNS = {
    "SOURCE_FILE": 100,
    "PERIODO": 6,
    "AGENCIA": 2,
    "ABOGADO_RESPONSABLE": 8,
    "ABOGADO_SUPERVISOR": 8,
    "CIUDAD": 200,
    "COMUNA": 200,
    "CUENTA": 25,
    "CLIENTE": 150,
    "DIGITO_VERIFICADOR": 1,
    "DEMANDANTE": 34,
    "DIRECCION": 200,
    "REGION": 7,
    "TIPO_DE_JUICIO": 34,
    "ROL": 34,
    "TRIBUNAL": 150,
    "ULTIMA_ETAPA": 150,
    "CA_DE_ULTIMA_GESTION_JUDICIAL": 150,
    "CR_DE_ULTIMA_GESTION_JUDICIAL": 150,
    "COMM_DE_LA_ULTIMA_GESTION": 150,
    "CODIGO_AGENCIA": 8,
    "NOMBRE_AGENCIA": 100,
}

INTEGER_COLUMNS = {"RUT", "NUMERO_DE_JUICIO_FOLIO"}

DATE_COLUMNS = {
    "FECHA_CREACION_JUICIO",
    "FECHA_ACTIVACION_JUICIO",
    "FECHA_INICIO_DEMANDA",
    "FECHA_DE_ULTIMA_ACTIVIDAD",
}

BUSINESS_COLUMNS = [
    "AGENCIA",
    "ABOGADO_RESPONSABLE",
    "ABOGADO_SUPERVISOR",
    "CIUDAD",
    "COMUNA",
    "CUENTA",
    "CLIENTE",
    "RUT",
    "DIGITO_VERIFICADOR",
    "DEMANDANTE",
    "DIRECCION",
    "REGION",
    "NUMERO_DE_JUICIO_FOLIO",
    "TIPO_DE_JUICIO",
    "FECHA_CREACION_JUICIO",
    "FECHA_ACTIVACION_JUICIO",
    "FECHA_INICIO_DEMANDA",
    "ROL",
    "TRIBUNAL",
    "ULTIMA_ETAPA",
    "FECHA_DE_ULTIMA_ACTIVIDAD",
    "CA_DE_ULTIMA_GESTION_JUDICIAL",
    "CR_DE_ULTIMA_GESTION_JUDICIAL",
    "COMM_DE_LA_ULTIMA_GESTION",
    "CODIGO_AGENCIA",
    "NOMBRE_AGENCIA",
]

TABLE_COLUMNS = [
    "ID_PRODUCTO",
    "FECHA_CARGA",
    "SOURCE_FILE",
    "PERIODO",
    *BUSINESS_COLUMNS,
]

# Esta es la clave de negocio solicitada para deduplicar la carga incremental.
# pandas considera los None equivalentes al eliminar duplicados, igual que la
# comparación null-safe usada contra SQL Server.
DEDUPE_KEY_COLUMNS = ["PERIODO", "CUENTA", "RUT", "NUMERO_DE_JUICIO_FOLIO"]

# Los encabezados se comparan tras quitar tildes, espacios y paréntesis. Por
# ejemplo, "Número de Juicio (Folio)" pasa a numero_de_juicio_folio.
HEADER_ALIASES = {
    "AGENCIA": ("agencia",),
    "ABOGADO_RESPONSABLE": ("abogado_responsable",),
    "ABOGADO_SUPERVISOR": ("abogado_supervisor",),
    "CIUDAD": ("ciudad",),
    "COMUNA": ("comuna",),
    "CUENTA": ("cuenta",),
    "CLIENTE": ("cliente",),
    "RUT": ("rut",),
    "DIGITO_VERIFICADOR": ("digito_verificador", "dv", "digito"),
    "DEMANDANTE": ("demandante",),
    "DIRECCION": ("direccion",),
    "REGION": ("region",),
    "NUMERO_DE_JUICIO_FOLIO": (
        "numero_de_juicio_folio",
        "numero_juicio_folio",
        "n_de_juicio_folio",
    ),
    "TIPO_DE_JUICIO": ("tipo_de_juicio", "tipo_juicio"),
    "FECHA_CREACION_JUICIO": (
        "fecha_creacion_juicio",
        "fecha_de_creacion_juicio",
    ),
    "FECHA_ACTIVACION_JUICIO": (
        "fecha_activacion_juicio",
        "fecha_de_activacion_juicio",
    ),
    "FECHA_INICIO_DEMANDA": (
        "fecha_inicio_demanda",
        "fecha_de_inicio_demanda",
    ),
    "ROL": ("rol",),
    "TRIBUNAL": ("tribunal",),
    "ULTIMA_ETAPA": ("ultima_etapa",),
    "FECHA_DE_ULTIMA_ACTIVIDAD": (
        "fecha_de_ultima_actividad",
        "fecha_ultima_actividad",
    ),
    "CA_DE_ULTIMA_GESTION_JUDICIAL": (
        "ca_de_ultima_gestion_judicial",
        "ca_de_la_ultima_gestion_judicial",
    ),
    "CR_DE_ULTIMA_GESTION_JUDICIAL": (
        "cr_de_ultima_gestion_judicial",
        "cr_de_la_ultima_gestion_judicial",
    ),
    "COMM_DE_LA_ULTIMA_GESTION": (
        "comm_de_la_ultima_gestion",
        "comm_de_ultima_gestion",
    ),
    "CODIGO_AGENCIA": ("codigo_agencia",),
    "NOMBRE_AGENCIA": ("nombre_agencia",),
}


def log(mensaje: str) -> None:
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {mensaje}")


def validar_periodo(periodo: str) -> str:
    valor = (periodo or "").strip()
    if len(valor) != 6 or not valor.isdigit():
        raise ValueError(f"Periodo invalido: {periodo}. Debe tener formato YYYYMM.")
    return valor


def normalizar_encabezado(value: object) -> str:
    texto = unicodedata.normalize("NFKD", str(value))
    texto = texto.encode("ascii", "ignore").decode("ascii").lower().strip()
    return re.sub(r"[^a-z0-9]+", "_", texto).strip("_")


def seleccionar_archivos_periodo_hojas() -> tuple[list[tuple[str, str | None]], str, bool]:
    """Obtiene varios archivos, período, hojas y confirmación de limpieza por GUI."""
    import tkinter as tk
    from tkinter import filedialog, messagebox, simpledialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        archivos = list(
            filedialog.askopenfilenames(
                title="Seleccionar archivos de Autogestión CENCO",
                filetypes=[
                    ("Archivos soportados", "*.xlsx *.xls *.csv"),
                    ("Excel", "*.xlsx *.xls"),
                    ("CSV", "*.csv"),
                    ("Todos", "*.*"),
                ],
                parent=root,
            )
        )
        if not archivos:
            messagebox.showwarning("Cancelado", "No se seleccionaron archivos.", parent=root)
            raise SystemExit(0)

        periodo_texto = simpledialog.askstring(
            "Periodo",
            "Ingrese el período a cargar (formato YYYYMM).\nEjemplo: 202608",
            parent=root,
        )
        if not periodo_texto:
            messagebox.showwarning("Cancelado", "No se ingresó el período.", parent=root)
            raise SystemExit(0)
        periodo = validar_periodo(periodo_texto)

        archivos_hojas: list[tuple[str, str | None]] = []
        for archivo in archivos:
            hoja = None
            if os.path.splitext(archivo)[1].lower() in {".xlsx", ".xls"}:
                hojas = pd.ExcelFile(archivo).sheet_names
                if len(hojas) == 1:
                    hoja = hojas[0]
                else:
                    hoja = simpledialog.askstring(
                        "Hoja de Excel",
                        (
                            f"Archivo: {os.path.basename(archivo)}\n"
                            f"Hojas disponibles: {', '.join(hojas)}\n\n"
                            "Ingrese el nombre de la hoja a cargar:"
                        ),
                        parent=root,
                    )
                    if hoja not in hojas:
                        messagebox.showerror(
                            "Error",
                            f"La hoja indicada no existe en {os.path.basename(archivo)}.",
                            parent=root,
                        )
                        raise SystemExit(1)
            archivos_hojas.append((archivo, hoja))

        limpiar_periodo = messagebox.askyesno(
            "Limpieza opcional de período",
            (
                f"¿Desea ELIMINAR los registros existentes de {TABLE_NAME} "
                f"para el período {periodo} antes de cargar?\n\n"
                "Esta acción es opcional. Seleccione «No» para conservar las "
                "cargas previas y realizar una inserción incremental."
            ),
            icon="warning",
            parent=root,
        )
        return archivos_hojas, periodo, limpiar_periodo
    finally:
        root.destroy()


def detectar_delimitador(ruta_csv: str) -> str:
    with open(ruta_csv, "r", encoding="utf-8-sig", newline="") as archivo:
        muestra = archivo.read(4096)
    try:
        return csv.Sniffer().sniff(muestra, delimiters=",;|\t").delimiter
    except csv.Error as error:
        raise ValueError(f"No fue posible detectar el delimitador de {ruta_csv}.") from error


def resolver_hoja_excel(archivo: str, hoja: str | None) -> str:
    hojas = pd.ExcelFile(archivo).sheet_names
    if hoja:
        if hoja not in hojas:
            raise ValueError(
                f"La hoja '{hoja}' no existe en {archivo}. "
                f"Hojas disponibles: {', '.join(hojas)}"
            )
        return hoja
    if len(hojas) == 1:
        return hojas[0]
    raise ValueError(
        f"El archivo {archivo} tiene varias hojas ({', '.join(hojas)}). "
        "Indique una --hoja asociada a ese archivo."
    )


def leer_archivo(archivo: str, hoja: str | None) -> tuple[pd.DataFrame, str | None]:
    if not os.path.isfile(archivo):
        raise FileNotFoundError(f"Archivo no encontrado: {archivo}")

    extension = os.path.splitext(archivo)[1].lower()
    if extension in {".xlsx", ".xls"}:
        hoja_resuelta = resolver_hoja_excel(archivo, hoja)
        log(f"Leyendo Excel: {archivo} | hoja={hoja_resuelta}")
        return pd.read_excel(archivo, sheet_name=hoja_resuelta), hoja_resuelta
    if extension == ".csv":
        if hoja is not None:
            raise ValueError(f"El archivo CSV {archivo} no admite el parámetro --hoja.")
        delimitador = detectar_delimitador(archivo)
        log(f"Leyendo CSV: {archivo} | delimitador='{delimitador}'")
        try:
            return pd.read_csv(archivo, sep=delimitador, dtype=str, encoding="utf-8-sig"), None
        except UnicodeDecodeError:
            return pd.read_csv(archivo, sep=delimitador, dtype=str, encoding="latin-1"), None
    raise ValueError(
        f"Formato no soportado para {archivo}: {extension}. Use Excel (.xlsx/.xls) o CSV (.csv)."
    )


def mapear_columnas(df_origen: pd.DataFrame) -> dict[str, str]:
    normalizadas = {columna: normalizar_encabezado(columna) for columna in df_origen.columns}
    mapeo: dict[str, str] = {}
    usadas: set[str] = set()

    for destino, aliases in HEADER_ALIASES.items():
        origen = next(
            (
                columna
                for columna, normalizada in normalizadas.items()
                if columna not in usadas and normalizada in aliases
            ),
            None,
        )
        if origen is None:
            raise ValueError(
                f"No se encontró la columna requerida para {destino}. "
                f"Encabezados disponibles: {', '.join(map(str, df_origen.columns))}"
            )
        mapeo[destino] = origen
        usadas.add(origen)
    return mapeo


def es_nulo(value: object) -> bool:
    try:
        resultado = pd.isna(value)
        if resultado is pd.NA:
            return True
        return bool(resultado)
    except (TypeError, ValueError):
        return False


def convertir_texto(value: object, columna: str, largo_maximo: int) -> str | None:
    if es_nulo(value):
        return None
    texto = str(value).strip()
    if not texto or texto.lower() in {"nan", "none", "nat"}:
        return None
    if len(texto) > largo_maximo:
        raise ValueError(f"{columna} supera el largo máximo de {largo_maximo}: '{texto}'")
    return texto


def convertir_entero(value: object, columna: str) -> int | None:
    if es_nulo(value):
        return None
    if isinstance(value, str):
        texto_original = value.strip()
        if not texto_original or texto_original.lower() in {"nan", "none", "nat"}:
            return None
    if isinstance(value, bool):
        raise ValueError(f"{columna} no acepta valores booleanos.")
    if isinstance(value, int):
        numero = value
    elif isinstance(value, float):
        if not value.is_integer():
            raise ValueError(f"{columna} debe ser entero: {value}.")
        numero = int(value)
    else:
        texto = str(value).strip().replace(" ", "")
        if "," in texto and "." in texto:
            separador_decimal = "," if texto.rfind(",") > texto.rfind(".") else "."
            separador_miles = "." if separador_decimal == "," else ","
            texto = texto.replace(separador_miles, "").replace(separador_decimal, ".")
        elif "," in texto or "." in texto:
            separador = "," if "," in texto else "."
            parte_final = texto.rsplit(separador, 1)[1]
            texto = texto.replace(separador, "." if len(parte_final) <= 2 else "")
        try:
            decimal = Decimal(texto)
        except InvalidOperation as error:
            raise ValueError(f"{columna} debe ser entero: {value}.") from error
        if not decimal.is_finite() or decimal != decimal.to_integral_value():
            raise ValueError(f"{columna} debe ser entero: {value}.")
        numero = int(decimal)

    if not SQL_INT_MIN <= numero <= SQL_INT_MAX:
        raise ValueError(f"{columna} está fuera del rango INT de SQL Server: {numero}.")
    return numero


def convertir_fecha(value: object, columna: str) -> date | None:
    if es_nulo(value) or (isinstance(value, str) and not value.strip()):
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
            raise ValueError(f"{columna} tiene fecha inválida: {value}.") from error

    for formato in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(texto, formato).date()
        except ValueError:
            continue
    fecha = pd.to_datetime(texto, errors="coerce", dayfirst=True)
    if pd.isna(fecha):
        raise ValueError(f"{columna} tiene fecha inválida: {value}.")
    return fecha.date()


def transformar(
    df_origen: pd.DataFrame, periodo: str, source_file: str
) -> tuple[pd.DataFrame, int]:
    """Valida completamente un archivo y retorna filas aptas y duplicados internos."""
    mapeo = mapear_columnas(df_origen)
    source_file_limpio = convertir_texto(source_file, "SOURCE_FILE", STRING_COLUMNS["SOURCE_FILE"])
    if not source_file_limpio:
        raise ValueError("SOURCE_FILE no puede quedar vacío.")

    fecha_carga = datetime.now().date()
    registros: list[dict[str, object]] = []
    errores: list[str] = []

    for indice, fila in df_origen.iterrows():
        try:
            registro: dict[str, object] = {
                "ID_PRODUCTO": ID_PRODUCTO_FIJO,
                "FECHA_CARGA": fecha_carga,
                "SOURCE_FILE": source_file_limpio,
                "PERIODO": periodo,
            }
            for destino, origen in mapeo.items():
                valor = fila[origen]
                if destino in STRING_COLUMNS:
                    registro[destino] = convertir_texto(valor, destino, STRING_COLUMNS[destino])
                elif destino in INTEGER_COLUMNS:
                    registro[destino] = convertir_entero(valor, destino)
                elif destino in DATE_COLUMNS:
                    registro[destino] = convertir_fecha(valor, destino)
            registros.append(registro)
        except ValueError as error:
            errores.append(f"Fila {indice + 2}: {error}")

    if errores:
        detalle = "\n".join(errores[:15])
        restante = len(errores) - min(len(errores), 15)
        sufijo = f"\n... y {restante} error(es) adicional(es)." if restante else ""
        raise ValueError(
            "Se detectaron errores de validación; el archivo fue rechazado y no se cargó información.\n"
            f"{detalle}{sufijo}"
        )
    if not registros:
        raise ValueError("El archivo no contiene registros para cargar.")

    df_transformado = pd.DataFrame(registros, columns=TABLE_COLUMNS)
    antes = len(df_transformado)
    df_transformado = df_transformado.drop_duplicates(
        subset=DEDUPE_KEY_COLUMNS, keep="first"
    ).reset_index(drop=True)
    return df_transformado, antes - len(df_transformado)


def preparar_carga(
    archivos_hojas: list[tuple[str, str | None]], periodo: str, source_files: list[str] | None
) -> tuple[pd.DataFrame, list[dict[str, Any]], int, int]:
    """Lee y valida todo antes de abrir la transacción de limpieza/carga."""
    dataframes: list[pd.DataFrame] = []
    controles: list[dict[str, Any]] = []
    total_entrada = 0
    duplicados_internos = 0

    for posicion, (archivo, hoja) in enumerate(archivos_hojas):
        source_file = source_files[posicion] if source_files else os.path.basename(archivo)
        try:
            df_origen, hoja_resuelta = leer_archivo(archivo, hoja)
            total_entrada += len(df_origen)
            log(f"Archivo leído: {archivo} | filas={len(df_origen)}")
            df_transformado, duplicados = transformar(df_origen, periodo, source_file)
        except (ValueError, FileNotFoundError) as error:
            raise ValueError(f"Archivo rechazado: {archivo}\n{error}") from error

        duplicados_internos += duplicados
        dataframes.append(df_transformado)
        controles.append(
            {
                "archivo": archivo,
                "source_file": source_file,
                "hoja": hoja_resuelta,
                "leidas": len(df_origen),
                "validas": len(df_transformado),
                "duplicados_internos": duplicados,
            }
        )

    combinado = pd.concat(dataframes, ignore_index=True)
    antes_global = len(combinado)
    combinado = combinado.drop_duplicates(subset=DEDUPE_KEY_COLUMNS, keep="first").reset_index(
        drop=True
    )
    duplicados_entre_archivos = antes_global - len(combinado)
    if combinado.empty:
        raise ValueError("No quedaron registros para cargar después de deduplicar los archivos.")
    return combinado, controles, total_entrada, duplicados_internos + duplicados_entre_archivos


def valores_para_insertar(df: pd.DataFrame) -> list[tuple[object, ...]]:
    return [
        tuple(None if es_nulo(valor) else valor for valor in fila)
        for fila in df.itertuples(index=False, name=None)
    ]


def cargar_incremental(
    df: pd.DataFrame, periodo: str, limpiar_periodo: bool
) -> tuple[int, int]:
    """Carga staging y destino en una única transacción; retorna (eliminadas, insertadas)."""
    tmp_table = "#TMP_AUTOGES_CENCO"
    columnas_sql = ", ".join(f"[{columna}]" for columna in TABLE_COLUMNS)
    placeholders = ", ".join("?" for _ in TABLE_COLUMNS)

    with pyodbc.connect(CONN_STR) as conexion:
        conexion.autocommit = False
        cursor = conexion.cursor()
        cursor.fast_executemany = True
        try:
            cursor.execute("SET XACT_ABORT ON; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;")
            cursor.execute(
                f"""
                CREATE TABLE {tmp_table}
                (
                    ID_PRODUCTO                     INT NOT NULL,
                    FECHA_CARGA                     DATE NOT NULL,
                    SOURCE_FILE                     NVARCHAR(100) NOT NULL,
                    PERIODO                         NVARCHAR(6) NOT NULL,
                    AGENCIA                         NVARCHAR(2) NULL,
                    ABOGADO_RESPONSABLE             NVARCHAR(8) NULL,
                    ABOGADO_SUPERVISOR              NVARCHAR(8) NULL,
                    CIUDAD                          NVARCHAR(200) NULL,
                    COMUNA                          NVARCHAR(200) NULL,
                    CUENTA                          NVARCHAR(25) NULL,
                    CLIENTE                         NVARCHAR(150) NULL,
                    RUT                             INT NULL,
                    DIGITO_VERIFICADOR              NVARCHAR(1) NULL,
                    DEMANDANTE                      NVARCHAR(34) NULL,
                    DIRECCION                       NVARCHAR(200) NULL,
                    REGION                          NVARCHAR(7) NULL,
                    NUMERO_DE_JUICIO_FOLIO          INT NULL,
                    TIPO_DE_JUICIO                  NVARCHAR(34) NULL,
                    FECHA_CREACION_JUICIO           DATE NULL,
                    FECHA_ACTIVACION_JUICIO         DATE NULL,
                    FECHA_INICIO_DEMANDA            DATE NULL,
                    ROL                             NVARCHAR(34) NULL,
                    TRIBUNAL                        NVARCHAR(150) NULL,
                    ULTIMA_ETAPA                    NVARCHAR(150) NULL,
                    FECHA_DE_ULTIMA_ACTIVIDAD       DATE NULL,
                    CA_DE_ULTIMA_GESTION_JUDICIAL   NVARCHAR(150) NULL,
                    CR_DE_ULTIMA_GESTION_JUDICIAL   NVARCHAR(150) NULL,
                    COMM_DE_LA_ULTIMA_GESTION       NVARCHAR(150) NULL,
                    CODIGO_AGENCIA                  NVARCHAR(8) NULL,
                    NOMBRE_AGENCIA                  NVARCHAR(100) NULL
                );
                """
            )
            sql_staging = f"INSERT INTO {tmp_table} ({columnas_sql}) VALUES ({placeholders})"
            valores = valores_para_insertar(df)
            for inicio in range(0, len(valores), BATCH_SIZE):
                cursor.executemany(sql_staging, valores[inicio : inicio + BATCH_SIZE])

            eliminadas = 0
            if limpiar_periodo:
                # El DELETE está restringido al período recibido y ocurre antes
                # de cualquier INSERT hacia la tabla definitiva.
                cursor.execute(f"DELETE FROM {TABLE_NAME} WHERE [PERIODO] = ?", periodo)
                eliminadas = max(0, int(cursor.rowcount or 0))

            comparaciones = """
                t.[PERIODO] = s.[PERIODO]
                AND (t.[CUENTA] = s.[CUENTA] OR (t.[CUENTA] IS NULL AND s.[CUENTA] IS NULL))
                AND (t.[RUT] = s.[RUT] OR (t.[RUT] IS NULL AND s.[RUT] IS NULL))
                AND (
                    t.[NUMERO_DE_JUICIO_FOLIO] = s.[NUMERO_DE_JUICIO_FOLIO]
                    OR (
                        t.[NUMERO_DE_JUICIO_FOLIO] IS NULL
                        AND s.[NUMERO_DE_JUICIO_FOLIO] IS NULL
                    )
                )
            """
            cursor.execute(
                f"""
                INSERT INTO {TABLE_NAME} ({columnas_sql})
                SELECT {columnas_sql}
                FROM {tmp_table} AS s
                WHERE NOT EXISTS
                (
                    SELECT 1
                    FROM {TABLE_NAME} AS t WITH (UPDLOCK, HOLDLOCK)
                    WHERE {comparaciones}
                );
                """
            )
            insertadas = max(0, int(cursor.rowcount or 0))
            conexion.commit()
            return eliminadas, insertadas
        except Exception:
            conexion.rollback()
            raise


def resolver_argumentos(
    parser: argparse.ArgumentParser, args: argparse.Namespace
) -> tuple[list[tuple[str, str | None]], str, list[str] | None, bool]:
    if (
        not args.archivo
        and not args.periodo
        and not args.hoja
        and not args.source_file
        and not args.limpiar_periodo
    ):
        archivos_hojas, periodo, limpiar_periodo = seleccionar_archivos_periodo_hojas()
        return archivos_hojas, periodo, None, limpiar_periodo
    if not args.archivo or not args.periodo:
        parser.error("--archivo y --periodo deben indicarse juntos.")

    periodo = validar_periodo(args.periodo)
    archivos = args.archivo
    if args.hoja is not None and len(args.hoja) != len(archivos):
        parser.error(
            "Si usa --hoja, indique una --hoja por cada --archivo, en el mismo orden."
        )
    if args.source_file is not None and len(args.source_file) != len(archivos):
        parser.error(
            "Si usa --source-file, indique uno por cada --archivo, en el mismo orden."
        )
    hojas = args.hoja if args.hoja is not None else [None] * len(archivos)
    return list(zip(archivos, hojas)), periodo, args.source_file, bool(args.limpiar_periodo)


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL Autogestión CENCO -> TBL_AUTOGES_CENCO")
    parser.add_argument(
        "--archivo",
        action="append",
        help="Ruta de Excel/CSV. Repita la opción para cargar varios archivos.",
    )
    parser.add_argument("--periodo", help="Período en formato YYYYMM.")
    parser.add_argument(
        "--hoja",
        action="append",
        help="Hoja Excel asociada por posición a cada --archivo.",
    )
    parser.add_argument(
        "--source-file",
        action="append",
        help="Nombre a persistir en SOURCE_FILE, asociado por posición a cada --archivo.",
    )
    parser.add_argument(
        "--limpiar-periodo",
        action="store_true",
        help=(
            "Elimina explícitamente los registros existentes del período indicado "
            "antes de insertar la carga validada."
        ),
    )
    args = parser.parse_args()
    archivos_hojas, periodo, source_files, limpiar_periodo = resolver_argumentos(parser, args)

    log("=" * 50)
    log(f"ETL AUTOGESTIÓN CENCO | período: {periodo}")
    log(f"Archivos solicitados: {len(archivos_hojas)}")
    log(
        "Limpieza de período: "
        + ("SÍ, solicitada explícitamente." if limpiar_periodo else "NO, carga incremental.")
    )
    log("=" * 50)

    # No se abre conexión ni se elimina nada hasta validar todos los archivos.
    df_carga, controles, total_entrada, duplicados = preparar_carga(
        archivos_hojas, periodo, source_files
    )
    log(f"Registros leídos: {total_entrada}")
    log(f"Registros evaluados para carga: {len(df_carga)}")
    log(f"Duplicados en archivos (clave de negocio): {duplicados}")

    eliminadas, insertadas = cargar_incremental(df_carga, periodo, limpiar_periodo)
    omitidas_existentes = len(df_carga) - insertadas
    log(f"Registros eliminados del período: {eliminadas}")
    log(f"Registros insertados: {insertadas}")
    log(f"Registros omitidos por existir: {omitidas_existentes}")
    log("ETL FINALIZADO CORRECTAMENTE")

    emitir_resultado(
        ok=True,
        mensaje=(
            f"Carga AUTOGES CENCO finalizada: {insertadas} insertadas, "
            f"{omitidas_existentes} omitidas por duplicado existente."
        ),
        periodo=periodo,
        archivos=controles,
        cantidad_archivos=len(controles),
        total_entrada=total_entrada,
        registros_validos=sum(control["validas"] for control in controles),
        duplicados_en_archivo=duplicados,
        evaluadas_para_carga=len(df_carga),
        limpieza_periodo_solicitada=limpiar_periodo,
        eliminadas_periodo=eliminadas,
        insertadas=insertadas,
        omitidas_existentes=omitidas_existentes,
    )


if __name__ == "__main__":
    ejecutar(main)
