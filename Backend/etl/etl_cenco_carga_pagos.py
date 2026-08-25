"""
ETL Cenco — Excel → JUDICIAL.TBL_CARGA_PAGOS_CENCO
===================================================
Ejecutar sin argumentos → abre selector de archivo y pregunta el tipo.
O con argumentos:
    python etl_cenco.py --tipo pagos   --archivo Pagos_H1_20260605.xlsx
    python etl_cenco.py --tipo repros  --archivo Renegociaciones_Convenios_H1_20260605.xlsx
    python etl_cenco.py --forzar       (ignorar protección anti-doble carga)

Prerequisito: ejecutar primero 01_crear_TBL_CARGA_PAGOS_CENCO.sql en SSMS
"""

import argparse
import os
import sys
import logging
from datetime import datetime, date
import pandas as pd
import pyodbc

from _conn import DB_DATABASE, DB_SERVER, build_pyodbc_conn_str
from _resultado import ejecutar, emitir_resultado

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
ID_PRODUCTO = 5
SERVER      = DB_SERVER
DATABASE    = DB_DATABASE
CONN_STR    = build_pyodbc_conn_str()

# ─── LOGGING ──────────────────────────────────────────────────────────────────
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)
LOG_PATH = os.path.join(
    LOG_DIR,
    f'etl_cenco_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'
)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_PATH)
    ]
)
log = logging.getLogger('etl_cenco')


# ─── HELPERS DE TIPO (nivel módulo) ───────────────────────────────────────────

def _fecha(v) -> str:
    """
    Convierte cualquier representación de fecha a string 'YYYY-MM-DD'.
    Acepta: date, datetime, pd.NaT, int YYYYMMDD, string YYYYMMDD, string YYYY-MM-DD.
    Retorna None si el valor es nulo o irreconocible.
    """
    import pandas as pd
    # Nulos explícitos: None, pd.NaT, float nan
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    # Strings
    if isinstance(v, str):
        v = v.strip()
        if v in ('', 'None', 'nan', 'NaT'):
            return None
        if len(v) == 10 and v[4] == '-':
            return v
        if len(v) == 8 and v.isdigit():
            return f'{v[:4]}-{v[4:6]}-{v[6:]}'
    # Objeto datetime (antes de date, porque datetime es subclase de date)
    if isinstance(v, datetime):
        return v.strftime('%Y-%m-%d')
    # Objeto date
    if isinstance(v, date):
        return v.strftime('%Y-%m-%d')
    # pd.Timestamp
    try:
        if isinstance(v, pd.Timestamp):
            return v.strftime('%Y-%m-%d')
    except Exception:
        pass
    # Int o float YYYYMMDD
    try:
        s = str(int(float(str(v))))
        if len(s) == 8:
            return f'{s[:4]}-{s[4:6]}-{s[6:]}'
    except (ValueError, TypeError):
        pass
    return None


def _str(v, maxlen: int = None) -> str:
    """Convierte a string limpio o None. Trunca si se especifica maxlen."""
    if v is None:
        return None
    s = str(v).strip()
    if s in ('', 'None', 'nan', 'NaT'):
        return None
    return s[:maxlen] if maxlen else s


def _int(v) -> int:
    """Convierte a int nativo Python o None."""
    if v is None:
        return None
    s = str(v).strip()
    if s in ('', 'None', 'nan'):
        return None
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None


# ─── SELECTOR DE ARCHIVO ──────────────────────────────────────────────────────

def seleccionar_archivo() -> tuple:
    """Abre diálogo Windows para elegir el Excel. Retorna (ruta, tipo)."""
    try:
        import tkinter as tk
        from tkinter import filedialog, messagebox
    except ImportError:
        log.error('tkinter no disponible. Use --archivo y --tipo como argumentos.')
        sys.exit(1)

    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)

    archivo = filedialog.askopenfilename(
        title='Seleccionar archivo Excel de Cenco',
        filetypes=[('Excel files', '*.xlsx *.xls'), ('All files', '*.*')],
        parent=root
    )
    if not archivo:
        log.error('No se seleccionó ningún archivo. Abortando.')
        root.destroy()
        sys.exit(0)

    # Detectar tipo por nombre del archivo
    nombre = os.path.basename(archivo).lower()
    if 'pago' in nombre:
        tipo_sugerido = 'pagos'
    elif any(x in nombre for x in ('reneg', 'convenio', 'repro')):
        tipo_sugerido = 'repros'
    else:
        tipo_sugerido = None

    if tipo_sugerido:
        confirmado = messagebox.askyesno(
            'Confirmar tipo',
            f'El archivo parece ser de tipo: {tipo_sugerido.upper()}\n\n'
            f'¿Es correcto?\n\n'
            f'(No = cambiar a {"repros" if tipo_sugerido == "pagos" else "pagos"})',
            parent=root
        )
        tipo = tipo_sugerido if confirmado else ('repros' if tipo_sugerido == 'pagos' else 'pagos')
    else:
        respuesta = messagebox.askyesno(
            'Tipo de archivo',
            '¿Es un archivo de PAGOS?\n\n(No = Reprogramaciones/Convenios)',
            parent=root
        )
        tipo = 'pagos' if respuesta else 'repros'

    root.destroy()
    return archivo, tipo


# ─── LECTORES EXCEL ───────────────────────────────────────────────────────────

def leer_pagos(archivo: str) -> pd.DataFrame:
    """
    Lee Excel de pagos. Columnas esperadas:
    U6ID/Cuenta, gestor, RUT, fecpos, monto, Tipo Producto,
    Fecha castigo, gestororigen, Procedencia, Fecha_juicio, Glosa
    """
    log.info(f'Leyendo archivo de pagos: {archivo}')

    # Leer sin dtype=str para preservar tipos nativos (int, date)
    df = pd.read_excel(archivo, sheet_name='Pagos_H1', dtype={'Cuenta': str, 'U6ID': str})
    df.columns = [c.strip() for c in df.columns]

    if 'U6ID' in df.columns:
        col_cuenta = 'U6ID'
    elif 'Cuenta' in df.columns:
        col_cuenta = 'Cuenta'
    else:
        raise ValueError("Columna faltante en pagos: se requiere 'U6ID' o 'Cuenta'")

    requeridas = {'RUT', 'fecpos', 'monto'}
    faltantes = requeridas - set(df.columns)
    if faltantes:
        raise ValueError(f'Columnas faltantes en pagos: {faltantes}')

    registros = []
    errores   = 0

    for i, row in df.iterrows():
        fila = i + 2
        try:
            cuenta = _str(row.get(col_cuenta))
            rut    = _str(row.get('RUT'))
            fecpos = _fecha(row.get('fecpos'))
            monto  = _int(row.get('monto'))

            # Validaciones
            if not cuenta:
                log.warning(f'Fila {fila}: CUENTA vacía — omitida')
                errores += 1
                continue
            if not fecpos:
                log.warning(f'Fila {fila}: FECPOS inválida ({row.get("fecpos")}) — omitida')
                errores += 1
                continue
            if monto is None or monto <= 0:
                log.warning(f'Fila {fila}: MONTO inválido ({row.get("monto")}) — omitida')
                errores += 1
                continue

            registros.append({
                'CUENTA'        : cuenta,
                'GESTOR'        : _str(row.get('gestor'),        maxlen=20),
                'RUT'           : _str(rut,                      maxlen=12),
                'FECPOS'        : fecpos,
                'MONTO'         : monto,
                'TIPO_PRODUCTO' : _str(row.get('Tipo Producto'), maxlen=20),
                'FECHA_CASTIGO' : _fecha(row.get('Fecha castigo')),
                'GESTOR_ORIGEN' : _str(row.get('gestororigen'),  maxlen=20),
                'PROCEDENCIA'   : _str(row.get('Procedencia'),   maxlen=30),
                'FECHA_JUICIO'  : _fecha(row.get('Fecha_juicio')),
                'GLOSA'         : _str(row.get('Glosa'),         maxlen=100),
            })
        except Exception as e:
            log.error(f'Fila {fila}: error inesperado — {e}')
            errores += 1

    log.info(f'Pagos leídos: {len(registros)} ok, {errores} con error')
    return pd.DataFrame(registros)


def leer_repros(archivo: str) -> pd.DataFrame:
    """
    Lee Excel de reprogramaciones/convenios. Columnas esperadas:
    gestor, Fecha_juicio, U6ID/cuenta, Rut, Dv, fectra, fecpos,
    codtra, monto, Fecha castigo, Pie, Tipo, ¿Convenio Firmado?
    """
    log.info(f'Leyendo archivo de repros: {archivo}')

    df = pd.read_excel(
        archivo,
        sheet_name='Renegociaciones_Convenios_H1',
        dtype={'cuenta': str, 'U6ID': str, 'Rut': str, 'Dv': str}
    )
    df.columns = [c.strip() for c in df.columns]

    if 'U6ID' in df.columns:
        col_cuenta = 'U6ID'
    elif 'cuenta' in df.columns:
        col_cuenta = 'cuenta'
    else:
        raise ValueError("Columna faltante en repros: se requiere 'U6ID' o 'cuenta'")

    requeridas = {'Rut', 'fecpos', 'monto'}
    faltantes  = requeridas - set(df.columns)
    if faltantes:
        raise ValueError(f'Columnas faltantes en repros: {faltantes}')

    registros = []
    errores   = 0

    for i, row in df.iterrows():
        fila = i + 2
        try:
            cuenta = _str(row.get(col_cuenta))
            rut    = _str(row.get('Rut'))
            fecpos = _fecha(row.get('fecpos'))
            monto  = _int(row.get('monto'))

            # Validaciones
            if not cuenta:
                log.warning(f'Fila {fila}: CUENTA vacía — omitida')
                errores += 1
                continue
            if not fecpos:
                log.warning(f'Fila {fila}: FECPOS inválida ({row.get("fecpos")}) — omitida')
                errores += 1
                continue
            if monto is None or monto <= 0:
                log.warning(f'Fila {fila}: MONTO inválido ({row.get("monto")}) — omitida')
                errores += 1
                continue

            registros.append({
                'CUENTA'        : cuenta,
                'GESTOR'        : _str(row.get('gestor'),              maxlen=20),
                'RUT'           : _str(rut,                            maxlen=12),
                'FECPOS'        : fecpos,                              # fecha real del repro
                'MONTO'         : monto,
                'TIPO_PRODUCTO' : _str(row.get('Tipo'),                maxlen=20),
                'FECHA_CASTIGO' : _fecha(row.get('Fecha castigo')),
                'GESTOR_ORIGEN' : _str(row.get('codtra'),              maxlen=20),
                'PROCEDENCIA'   : None,                                # no aplica en repros
                'FECHA_JUICIO'  : _fecha(row.get('Fecha_juicio')),
                'GLOSA'         : _str(row.get('¿Convenio Firmado?'), maxlen=100),
            })
        except Exception as e:
            log.error(f'Fila {fila}: error inesperado — {e}')
            errores += 1

    log.info(f'Repros leídos: {len(registros)} ok, {errores} con error')
    return pd.DataFrame(registros)


# ─── CARGA A SQL SERVER ───────────────────────────────────────────────────────

def conectar() -> pyodbc.Connection:
    log.info(f'Conectando a {SERVER}/{DATABASE}...')
    conn = pyodbc.connect(CONN_STR)
    conn.autocommit = False
    log.info('Conexión establecida')
    return conn


def verificar_duplicado(cursor, tipo_carga: str) -> bool:
    """Retorna True si ya existe una carga del mismo tipo hoy."""
    cursor.execute("""
        SELECT COUNT(1)
        FROM TBL_CARGAS_POR_PRODUCTO_CENCO
        WHERE ID_PRODUCTO = ?
          AND TIPO_CARGA  = ?
          AND CONVERT(date, FECHA_CARGA) = CONVERT(date, GETDATE())
    """, int(ID_PRODUCTO), str(tipo_carga))
    return cursor.fetchone()[0] > 0


def registrar_carga(cursor, tipo_carga: str, q_registros: int) -> int:
    """
    Inserta fila en TBL_CARGAS_POR_PRODUCTO_CENCO.
    Retorna el ID_CARGA_ARCHIVO generado.
    """
    cursor.execute("""
        INSERT INTO TBL_CARGAS_POR_PRODUCTO_CENCO
            (ID_PRODUCTO, TIPO_CARGA, Q_REGISTROS, USUARIO)
        VALUES (?, ?, ?, SYSTEM_USER)
    """, int(ID_PRODUCTO), str(tipo_carga), int(q_registros))

    cursor.execute("SELECT @@IDENTITY")
    id_carga_archivo = int(cursor.fetchone()[0])
    log.info(f'ID_CARGA_ARCHIVO generado: {id_carga_archivo}')
    return id_carga_archivo


def insertar_registros(cursor, df: pd.DataFrame, tipo_carga: str) -> int:
    """Inserta filas en TBL_CARGA_PAGOS_CENCO. Retorna ID_CARGA_ARCHIVO."""

    # 1. Registrar en tabla de control
    id_carga_archivo = registrar_carga(cursor, tipo_carga, len(df))

    # 2. Insertar filas una a una (compatible SQL Server 2008)
    sql = """
        INSERT INTO TBL_CARGA_PAGOS_CENCO (
            ID_CARGA_ARCHIVO,
            ID_PRODUCTO,
            TIPO_CARGA,
            CUENTA,
            GESTOR,
            RUT,
            FECPOS,
            MONTO,
            TIPO_PRODUCTO,
            FECHA_CASTIGO,
            GESTOR_ORIGEN,
            PROCEDENCIA,
            FECHA_JUICIO,
            GLOSA
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """

    insertados = 0
    for _, row in df.iterrows():
        cursor.execute(sql, (
            int(id_carga_archivo),
            int(ID_PRODUCTO),
            str(tipo_carga),
            _str(row['CUENTA']),
            _str(row['GESTOR']),
            _str(row['RUT']),
            _str(row['FECPOS']),        # fecha como string 'YYYY-MM-DD'
            _int(row['MONTO']),
            _str(row['TIPO_PRODUCTO']),
            _str(row['FECHA_CASTIGO']), # fecha como string 'YYYY-MM-DD'
            _str(row['GESTOR_ORIGEN']),
            _str(row['PROCEDENCIA']),
            _str(row['FECHA_JUICIO']),  # fecha como string 'YYYY-MM-DD'
            _str(row['GLOSA']),
        ))
        insertados += 1

    log.info(f'{insertados} registros insertados en TBL_CARGA_PAGOS_CENCO')
    return id_carga_archivo


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def _main():
    parser = argparse.ArgumentParser(description='ETL Cenco — Excel → SQL Server')
    parser.add_argument('--tipo',    choices=['pagos', 'repros'],
                        help='Tipo de archivo: pagos o repros')
    parser.add_argument('--archivo', help='Ruta al archivo Excel')
    parser.add_argument('--forzar',  action='store_true',
                        help='Ignorar protección anti-doble ejecución')
    args = parser.parse_args()

    # Si falta archivo O tipo → abrir selector visual para ambos
    if not args.archivo or not args.tipo:
        log.info('Abriendo selector de archivo...')
        archivo, tipo = seleccionar_archivo()
    else:
        archivo = args.archivo
        tipo    = args.tipo

    tipo_carga = 'PAGO' if tipo == 'pagos' else 'REPRO'
    log.info(f'Archivo : {archivo}')
    log.info(f'Tipo    : {tipo_carga}')

    # Leer Excel
    df = leer_pagos(archivo) if tipo == 'pagos' else leer_repros(archivo)

    if df.empty:
        raise ValueError(
            'No se obtuvieron registros válidos del Excel. Revise el contenido y las '
            'columnas requeridas.'
        )

    # Conectar y cargar
    conn   = conectar()
    cursor = conn.cursor()

    try:
        # Anti-doble carga
        if not args.forzar and verificar_duplicado(cursor, tipo_carga):
            log.warning(
                f'Ya existe una carga de tipo {tipo_carga} para ID_PRODUCTO={ID_PRODUCTO} hoy. '
                f'Use --forzar para recargar.'
            )
            emitir_resultado(
                ok=True,
                mensaje=(
                    f'Ya existe una carga de tipo {tipo_carga} para hoy; no se insertó nada '
                    '(marque "forzar" para recargar).'
                ),
                tipo_carga=tipo_carga,
                registros=0,
                omitido_por_duplicado=True,
            )
            return  # sale limpio, el finally cierra la conexión

        id_carga = insertar_registros(cursor, df, tipo_carga)
        conn.commit()

        log.info('=' * 60)
        log.info('CARGA EXITOSA')
        log.info(f'  Tipo          : {tipo_carga}')
        log.info(f'  ID_PRODUCTO   : {ID_PRODUCTO}')
        log.info(f'  ID_CARGA      : {id_carga}')
        log.info(f'  Registros     : {len(df)}')
        log.info(f'  Log guardado  : {LOG_PATH}')
        log.info('=' * 60)

        emitir_resultado(
            ok=True,
            mensaje=f'Carga exitosa: {len(df)} registros insertados ({tipo_carga}).',
            tipo_carga=tipo_carga,
            id_carga=id_carga,
            registros=len(df),
        )

    except Exception as e:
        conn.rollback()
        log.error(f'ERROR — rollback ejecutado: {e}')
        raise
    finally:
        conn.close()


def main() -> None:
    _main()


if __name__ == '__main__':
    ejecutar(main)
