"""
ETL CENCO STOCK - Excel/CSV -> JUDICIAL.dbo.TBL_STOCK_CENCO

Uso interactivo:
    python etl_cenco_stock.py

Uso automatizado:
    python etl_cenco_stock.py --archivo stock.xlsx --periodo 202608 --hoja Hoja1
    python etl_cenco_stock.py --archivo stock.csv --periodo 202608
    python etl_cenco_stock.py --archivo <tmp> --periodo 202608 --source-file Stock_202608.xlsx

Stock es una fotografía por período: cada carga reemplaza por completo el
período indicado. Antes de insertar, se eliminan todos los registros
existentes en TBL_STOCK_CENCO para ese PERIODO y luego se insertan los
registros del archivo, deduplicados dentro del archivo por
PERIODO + U6ID + GESTOR + FECICAR (misma clave de negocio que Salidas).
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

TABLE_NAME = "dbo.TBL_STOCK_CENCO"
ID_PRODUCTO_FIJO = 5
BATCH_SIZE = 5000
CONN_STR = build_pyodbc_conn_str()

STRING_COLUMNS = {
    "SOURCE_FILE": 100,
    "PERIODO": 6,
    "U6ID": 25,
    "GESTOR_MADRE": 4,
    "CARTERA": 4,
    "GESTOR": 2,
    "FECICAR": 8,
    "DV": 1,
    "MARCA": 5,
    "OPERACION": 12,
    "TIPO_TARJETA": 25,
    "TIPO_DE_CUENTA": 10,
    "MARCA_JUDICIALIZACION_CASTIGO": 50,
    "MARCA_PILOTO_DE_CUENTAS_1MM": 50,
    "MARCA_RENEGOCIACION": 10,
    "TRAMO_ANTIGUEDAD_CASTIGO": 25,
    "MARCA_INHIBICION": 50,
    "PILOTO_AVANCE_JUDICIAL": 50,
}

INTEGER_COLUMNS = {
    "RUT",
    "DDA_TOTAL_INICIO",
    "DDA_MOROSA_INICIO",
    "DDA_TOTAL_ACTUAL",
    "DDA_MOROSA_ACTUAL",
    "DEUDA_CAST",
    "N_DE_RENEGOCIACIONES",
    "TRAMO_DE_MORA",
    "PRIORIZACION",
}

DATE_COLUMNS = {
    "FECHA_CASTIGO",
    "FECHA_CREACION_JUICIO",
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
    "MARCA",
    "OPERACION",
    "TIPO_TARJETA",
    "FECHA_CREACION_JUICIO",
    "TIPO_DE_CUENTA",
    "MARCA_JUDICIALIZACION_CASTIGO",
    "MARCA_PILOTO_DE_CUENTAS_1MM",
    "MARCA_RENEGOCIACION",
    "N_DE_RENEGOCIACIONES",
    "TRAMO_DE_MORA",
    "TRAMO_ANTIGUEDAD_CASTIGO",
    "MARCA_INHIBICION",
    "PRIORIZACION",
    "PILOTO_AVANCE_JUDICIAL",
]

# Stock es una fotografía: una fila se identifica por período, cuenta, gestor y FECICAR
# (misma regla que la carga de Salidas por periodo).
DEDUPE_KEY_COLUMNS = ["PERIODO", "U6ID", "GESTOR", "FECICAR"]

TABLE_COLUMNS = [
    "ID_PRODUCTO",
    "FECHA_CARGA",
    "SOURCE_FILE",
    "PERIODO",
    *BUSINESS_COLUMNS,
]

# Los alias se comparan después de normalizar: quitan acentos, espacios y símbolos
# (por ejemplo, "N° de Renegociaciones" -> n_de_renegociaciones y
# "Marca Piloto de Cuentas <1MM" -> marca_piloto_de_cuentas_1mm).
HEADER_ALIASES = {
    "U6ID": ("u6id", "cuenta"),
    "GESTOR_MADRE": ("gestor_madre",),
    "CARTERA": ("cartera",),
    "GESTOR": ("gestor",),
    "FECICAR": ("fecicar", "fec_icar"),
    "RUT": ("rut",),
    "DV": ("dv", "digito_verificador"),
    "DDA_TOTAL_INICIO": ("dda_total_inicio",),
    "DDA_MOROSA_INICIO": ("dda_morosa_inicio",),
    "DDA_TOTAL_ACTUAL": ("dda_total_actual",),
    "DDA_MOROSA_ACTUAL": ("dda_morosa_actual",),
    "DEUDA_CAST": ("deuda_cast", "deuda_castigo"),
    "FECHA_CASTIGO": ("fecha_castigo",),
    "MARCA": ("marca",),
    "OPERACION": ("operacion",),
    "TIPO_TARJETA": ("tipo_tarjeta",),
    "FECHA_CREACION_JUICIO": ("fecha_creacion_juicio",),
    "TIPO_DE_CUENTA": ("tipo_de_cuenta", "tipo_cuenta"),
    "MARCA_JUDICIALIZACION_CASTIGO": ("marca_judicializacion_castigo",),
    "MARCA_PILOTO_DE_CUENTAS_1MM": (
        "marca_piloto_de_cuentas_1mm",
        "marca_piloto_cuentas_1mm",
    ),
    "MARCA_RENEGOCIACION": ("marca_renegociacion",),
    "N_DE_RENEGOCIACIONES": (
        "n_de_renegociaciones",
        "n_renegociaciones",
        "numero_de_renegociaciones",
    ),
    "TRAMO_DE_MORA": ("tramo_de_mora",),
    "TRAMO_ANTIGUEDAD_CASTIGO": ("tramo_antiguedad_castigo",),
    "MARCA_INHIBICION": ("marca_inhibicion",),
    "PRIORIZACION": ("priorizacion",),
    "PILOTO_AVANCE_JUDICIAL": ("piloto_avance_judicial",),
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
            title="Seleccionar archivo de stock CENCO",
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
    with open(ruta_csv, "r", encoding="utf-8-sig", newline="") as file:
        muestra = file.read(4096)
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
    fecha_carga = datetime.now().date()
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
                "PERIODO": periodo,
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
            if registro["RUT"] is None:
                raise ValueError("RUT es obligatorio.")

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


def cargar_reemplazando_periodo(df: pd.DataFrame, periodo: str) -> tuple[int, int]:
    """Reemplaza por completo el período: borra lo existente y carga el archivo.

    Devuelve (eliminadas, insertadas).
    """
    with pyodbc.connect(CONN_STR) as conn:
        conn.autocommit = False
        cur = conn.cursor()
        cur.fast_executemany = True

        try:
            cur.execute(f"DELETE FROM {TABLE_NAME} WHERE [PERIODO] = ?", periodo)
            eliminadas = int(cur.rowcount if cur.rowcount is not None and cur.rowcount >= 0 else 0)

            placeholders = ", ".join("?" for _ in TABLE_COLUMNS)
            columnas_sql = ", ".join(f"[{col}]" for col in TABLE_COLUMNS)
            sql_insert = f"INSERT INTO {TABLE_NAME} ({columnas_sql}) VALUES ({placeholders})"

            valores = [
                tuple(None if pd.isna(value) else value for value in fila)
                for fila in df.itertuples(index=False, name=None)
            ]

            for inicio in range(0, len(valores), BATCH_SIZE):
                cur.executemany(sql_insert, valores[inicio : inicio + BATCH_SIZE])

            insertadas = len(valores)
            conn.commit()
            return eliminadas, insertadas
        except Exception:
            conn.rollback()
            raise


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL stock CENCO -> TBL_STOCK_CENCO")
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

    log(f"Inicio ETL stock CENCO | periodo={periodo}")
    log(f"Archivo: {archivo}")

    source_file = (args.source_file or "").strip() or os.path.basename(archivo)
    df_origen = leer_archivo(archivo, hoja)
    log(f"Filas leidas: {len(df_origen)}")

    df, duplicados_en_archivo = transformar(df_origen, periodo, source_file)
    if duplicados_en_archivo:
        log(
            "Duplicados dentro del archivo para la clave "
            "PERIODO+U6ID+GESTOR+FECICAR: "
            f"{duplicados_en_archivo} fila(s) omitida(s)."
        )

    eliminadas, insertadas = cargar_reemplazando_periodo(df, periodo)

    log(
        f"Carga finalizada: periodo {periodo} reemplazado "
        f"({eliminadas} eliminadas, {insertadas} insertadas)."
    )
    emitir_resultado(
        ok=True,
        mensaje=(
            f"Carga finalizada: se reemplazo el periodo {periodo} "
            f"({eliminadas} eliminadas, {insertadas} insertadas)."
        ),
        periodo=periodo,
        source_file=source_file,
        total_entrada=len(df_origen),
        duplicados_en_archivo=duplicados_en_archivo,
        evaluadas_para_carga=len(df),
        eliminadas_periodo=eliminadas,
        insertadas=insertadas,
    )


if __name__ == "__main__":
    ejecutar(main)
