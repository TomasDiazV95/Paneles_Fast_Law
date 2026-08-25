"""
ETL CLA RL - Excel -> JUDICIAL.dbo.TBL_CLA_RL

Uso interactivo:
    python etl_cla_rl.py

Uso automatizado:
    python etl_cla_rl.py --archivo rl.xlsx --periodo 202608 --hoja Hoja1
"""

import argparse
import os
import re
import unicodedata
from datetime import datetime
from decimal import Decimal, InvalidOperation

import pandas as pd
import pyodbc

from _conn import build_pyodbc_conn_str
from _resultado import ejecutar, emitir_resultado

ID_PRODUCTO = 204
CONN_STR = build_pyodbc_conn_str()
BATCH_SIZE = 5_000

STRING_COLUMNS = {
    "EMPEX": 9,
    "FOLIO": 15,
    "TIPO": 7,
    "DV": 1,
    "OBSERVACION_CARGA": 50,
    "ESTATUS_CLA": 50,
    "ARCHIVO_DE_PAGO": 50,
    "NEGOCIO": 50,
    "CASOS_PENDIENTES": 50,
    "EJECUTIVO": 20,
}
DATE_COLUMNS = {"FECHA_REPRO"}
INTEGER_COLUMNS = {
    "RUT_AFILIADO",
    "OFERTA_DE_REPRO",
    "N_CUOTAS",
    "MONTO_CUOTA",
    "COSTO_TOTAL",
    "ABONO",
}
DECIMAL_COLUMNS = {"TASA_PROY": 2, "TASA_ANUAL": 2, "CAE": 3}

HEADER_ALIASES = {
    "EMPEX": ("empex",),
    "FECHA_REPRO": ("fecha_repro","FECHA REPRO"),
    "FOLIO": ("folio","FOLIO"),
    "TIPO": ("tipo","Tipo"),
    "RUT_AFILIADO": ("rut_afiliado","RUT_AFILIADO"),
    "DV": ("dv","DV"),
    "OFERTA_DE_REPRO": ("oferta_de_repro","oferta de repro"),
    "TASA_PROY": ("tasa_proy","TASA_PROY"),
    "TASA_ANUAL": ("tasa_anual",),
    "N_CUOTAS": ("n_cuotas",),
    "MONTO_CUOTA": ("monto_cuota",),
    "CAE": ("cae",),
    "COSTO_TOTAL": ("costo_total",),
    "OBSERVACION_CARGA": ("observacion_carga","OBSERVACION CARGA"),
    "ESTATUS_CLA": ("estatus_cla","ESTATUS CLA"),
    "ARCHIVO_DE_PAGO": ("archivo_de_pago","ARCHIVO DE PAGO"),
    "NEGOCIO": ("negocio",),
    "CASOS_PENDIENTES": ("casos_pendientes","CASOS PENDIENTES"),
    "EJECUTIVO": ("ejecutivo",),
    "ABONO": ("abono",),
}
TABLE_COLUMNS = ["ID_PRODUCTO", "PERIODO", *HEADER_ALIASES.keys()]


def log(message: str) -> None:
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}")


def validar_periodo(periodo: str) -> str:
    periodo_limpio = (periodo or "").strip()
    if len(periodo_limpio) != 6 or not periodo_limpio.isdigit():
        raise ValueError(f"Periodo invalido: {periodo}. Debe tener formato YYYYMM.")
    return periodo_limpio


def normalizar_encabezado(value: object) -> str:
    texto = unicodedata.normalize("NFKD", str(value))
    texto = texto.encode("ascii", "ignore").decode("ascii").lower().strip()
    return re.sub(r"[^a-z0-9]+", "_", texto).strip("_")


def seleccionar_archivo_y_periodo() -> tuple[str, str, str]:
    """Solicita archivo, periodo y hoja cuando se ejecuta sin argumentos."""
    import tkinter as tk
    from tkinter import filedialog, messagebox, simpledialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        archivo = filedialog.askopenfilename(
            title="Seleccionar archivo RL de CLA",
            filetypes=[("Excel", "*.xlsx *.xls"), ("Todos", "*.*")],
            parent=root,
        )
        if not archivo:
            messagebox.showwarning("Cancelado", "No se selecciono ningun archivo.", parent=root)
            raise SystemExit(0)

        periodo_ingresado = simpledialog.askstring(
            "Periodo",
            "Ingrese el periodo (formato YYYYMM)\nEjemplo: 202608",
            initialvalue=datetime.now().strftime("%Y%m"),
            parent=root,
        )
        if not periodo_ingresado:
            messagebox.showwarning("Cancelado", "No se ingreso el periodo.", parent=root)
            raise SystemExit(0)

        try:
            periodo = validar_periodo(periodo_ingresado)
        except ValueError as error:
            messagebox.showerror("Error", str(error), parent=root)
            raise SystemExit(1) from error

        hojas = pd.ExcelFile(archivo).sheet_names
        if len(hojas) == 1:
            return archivo, periodo, hojas[0]

        hoja = simpledialog.askstring(
            "Hoja de Excel",
            f"Hojas disponibles:\n{', '.join(hojas)}\n\nIngrese el nombre de la hoja a cargar:",
            parent=root,
        )
        if hoja not in hojas:
            messagebox.showerror("Error", "Debe seleccionar una hoja existente.", parent=root)
            raise SystemExit(1)
        return archivo, periodo, hoja
    finally:
        root.destroy()


def resolver_hoja(archivo: str, hoja: str | None) -> str:
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


def mapear_columnas(df_origen: pd.DataFrame) -> dict[str, str]:
    columnas_normalizadas = {
        columna: normalizar_encabezado(columna) for columna in df_origen.columns
    }
    mapeo: dict[str, str] = {}
    usadas: set[str] = set()

    for destino, alternativas in HEADER_ALIASES.items():
        origen = next(
            (
                columna
                for columna, nombre_normalizado in columnas_normalizadas.items()
                if columna not in usadas and nombre_normalizado in alternativas
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


def convertir_texto(value: object, columna: str, longitud_maxima: int) -> str | None:
    if pd.isna(value):
        return None
    texto = str(value).strip()
    if not texto or texto.lower() in {"nan", "none", "nat"}:
        return None
    if len(texto) > longitud_maxima:
        raise ValueError(
            f"{columna} supera el largo maximo de {longitud_maxima} caracteres: '{texto}'."
        )
    return texto


def normalizar_numero(
    value: object, columna: str, permitir_tres_decimales: bool = False
) -> Decimal | None:
    if pd.isna(value) or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, bool):
        raise ValueError(f"{columna} no acepta valores booleanos.")
    if isinstance(value, (int, float)):
        return Decimal(str(value))

    texto = str(value).strip().replace("$", "").replace("%", "").replace(" ", "")
    if "," in texto and "." in texto:
        separador_decimal = "," if texto.rfind(",") > texto.rfind(".") else "."
        separador_miles = "." if separador_decimal == "," else ","
        texto = texto.replace(separador_miles, "").replace(separador_decimal, ".")
    elif "," in texto or "." in texto:
        separador = "," if "," in texto else "."
        parte_final = texto.rsplit(separador, 1)[1]
        es_decimal = permitir_tres_decimales or len(parte_final) <= 2
        texto = texto.replace(separador, "." if es_decimal else "")

    try:
        return Decimal(texto)
    except InvalidOperation as error:
        raise ValueError(f"{columna} debe ser numerico: {value}.") from error


def convertir_entero(value: object, columna: str) -> int | None:
    numero = normalizar_numero(value, columna)
    if numero is None:
        return None
    if numero != numero.to_integral_value():
        raise ValueError(f"{columna} debe ser entero: {value}.")
    return int(numero)


def convertir_decimal(value: object, columna: str, escala: int) -> Decimal | None:
    numero = normalizar_numero(value, columna, permitir_tres_decimales=True)
    if numero is None:
        return None
    maximo_decimales = Decimal(1).scaleb(-escala)
    try:
        return numero.quantize(maximo_decimales)
    except InvalidOperation as error:
        raise ValueError(
            f"{columna} no puede convertirse a decimal con {escala} decimales: {value}."
        ) from error


def transformar(df_origen: pd.DataFrame, periodo: str) -> pd.DataFrame:
    mapeo = mapear_columnas(df_origen)
    resultado = pd.DataFrame(index=df_origen.index)
    resultado["ID_PRODUCTO"] = ID_PRODUCTO
    resultado["PERIODO"] = periodo

    for destino, origen in mapeo.items():
        if destino in STRING_COLUMNS:
            resultado[destino] = df_origen[origen].map(
                lambda value: convertir_texto(value, destino, STRING_COLUMNS[destino])
            )
        elif destino in INTEGER_COLUMNS:
            resultado[destino] = df_origen[origen].map(
                lambda value: convertir_entero(value, destino)
            )
        elif destino in DECIMAL_COLUMNS:
            resultado[destino] = df_origen[origen].map(
                lambda value: convertir_decimal(value, destino, DECIMAL_COLUMNS[destino])
            )
        elif destino in DATE_COLUMNS:
            fechas = pd.to_datetime(df_origen[origen], errors="coerce", dayfirst=True)
            filas_sin_fecha = fechas.isna()
            if filas_sin_fecha.any():
                filas = ", ".join(
                    str(indice + 2) for indice in df_origen.index[filas_sin_fecha][:10]
                )
                raise ValueError(
                    f"{destino} es obligatoria y falta o es invalida. Filas: {filas}."
                )
            resultado[destino] = fechas.dt.date

    return resultado[TABLE_COLUMNS]


def leer_excel(archivo: str, hoja: str) -> pd.DataFrame:
    if not os.path.isfile(archivo):
        raise FileNotFoundError(f"Archivo no encontrado: {archivo}")
    log(f"Leyendo hoja '{hoja}' del archivo: {archivo}")
    return pd.read_excel(archivo, sheet_name=hoja)


def cargar_periodo(df: pd.DataFrame, periodo: str) -> tuple[int, int]:
    placeholders = ", ".join("?" for _ in TABLE_COLUMNS)
    columnas_sql = ", ".join(f"[{columna}]" for columna in TABLE_COLUMNS)
    sql_insert = f"INSERT INTO dbo.TBL_CLA_RL ({columnas_sql}) VALUES ({placeholders})"
    valores = [
        tuple(None if pd.isna(value) else value for value in fila)
        for fila in df.itertuples(index=False, name=None)
    ]

    with pyodbc.connect(CONN_STR) as conexion:
        cursor = conexion.cursor()
        cursor.execute(
            "DELETE FROM dbo.TBL_CLA_RL WHERE ID_PRODUCTO = ? AND PERIODO = ?",
            ID_PRODUCTO,
            periodo,
        )
        eliminadas = cursor.rowcount

        cursor.fast_executemany = True
        for inicio in range(0, len(valores), BATCH_SIZE):
            cursor.executemany(sql_insert, valores[inicio : inicio + BATCH_SIZE])
        conexion.commit()

    return eliminadas, len(valores)


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL Excel CLA RL -> TBL_CLA_RL")
    parser.add_argument("--archivo", help="Ruta al archivo Excel")
    parser.add_argument("--periodo", help="Periodo en formato YYYYMM")
    parser.add_argument("--hoja", help="Nombre de la hoja de Excel")
    args = parser.parse_args()

    if args.archivo and args.periodo:
        archivo = args.archivo
        periodo = validar_periodo(args.periodo)
        hoja = resolver_hoja(archivo, args.hoja)
    elif args.archivo or args.periodo or args.hoja:
        parser.error("--archivo y --periodo deben indicarse juntos; --hoja es opcional.")
    else:
        archivo, periodo, hoja = seleccionar_archivo_y_periodo()

    log(f"Inicio ETL CLA RL | producto={ID_PRODUCTO} | periodo={periodo}")
    df_origen = leer_excel(archivo, hoja)
    log(f"Filas leidas: {len(df_origen)}")
    df = transformar(df_origen, periodo)
    eliminadas, insertadas = cargar_periodo(df, periodo)
    log(
        f"Carga finalizada: {eliminadas} filas eliminadas del periodo y "
        f"{insertadas} filas insertadas."
    )
    emitir_resultado(
        ok=True,
        mensaje=f"Carga finalizada: {eliminadas} eliminadas, {insertadas} insertadas.",
        periodo=periodo,
        eliminadas=eliminadas,
        insertadas=insertadas,
    )


if __name__ == "__main__":
    ejecutar(main)
