"""
ETL — BASE OFERTAS CAJA LOS ANDES
Lee Excel hoja por hoja, filtra AGENCIA=FASTCO, inserta en SQL Server.
Nunca carga mas de una hoja en memoria a la vez.

Uso: python etl_base_ofertas.py
     python etl_base_ofertas.py <ruta_excel> <periodo>
"""

import sys
import os
import pyodbc
import pandas as pd
from datetime import datetime
import tkinter as tk
from tkinter import filedialog, simpledialog, messagebox

from _conn import build_pyodbc_conn_str
from _resultado import ejecutar, emitir_resultado

# ─── CONFIGURACION ────────────────────────────────────────────
CONN_STR = build_pyodbc_conn_str()

COLUMNAS_ESPERADAS = [
    'DMACCT','TIPO_CREDITO','CARTERA','BANDA','RUT','DV','COTIZANTE',
    'NOMBRE_COMPLETO','DEUDA_TOTAL','MORA_DOWN','SALDO_INS_DOWN',
    'MORA_CALCULO','SALDO_INS_CALCULO','GESTOR','OFERTA_CANCELACION',
    'OFERTA_3M','OFERTA_2M','OFERTA_1M','OFERTA_REPROGRAMACION',
    'FECHA_REPROGRAMACION','FLGDIASMORA','FINIQUITADO','CUMPLE_CESANTIA',
    'U6FLGOPCAST','DIRECCION','COMUNA','CIUDAD','CORREO','FONO','SEXO',
    'ROL','AGENCIA','ESTADO','JUZGADO','ETAPA_JUDICIAL','U6FLGCXC',
    'EXC_PAGO','EXC_CURA','EXC_IMED','EXC_REPRO12','EXC_FILA_AGENCIA',
    'EXC_SIR','OTRAS_EXC','OFERTA_CONVENIO'
]

COLUMNAS_DECIMAL = [
    'DEUDA_TOTAL','MORA_DOWN','SALDO_INS_DOWN','MORA_CALCULO',
    'SALDO_INS_CALCULO','OFERTA_CANCELACION','OFERTA_3M','OFERTA_2M',
    'OFERTA_1M','OFERTA_REPROGRAMACION','OFERTA_CONVENIO'
]

COLUMNAS_INT = ['FLGDIASMORA','EXC_PAGO','EXC_CURA','EXC_IMED',
                'EXC_REPRO12','EXC_FILA_AGENCIA','EXC_SIR','OTRAS_EXC']

BATCH_SIZE = 100000

# ─── FUNCIONES ────────────────────────────────────────────────

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def seleccionar_archivo():
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)

    ruta = filedialog.askopenfilename(
        title='Seleccionar archivo BASE OFERTAS',
        filetypes=[('Excel', '*.xlsx *.xls'), ('Todos', '*.*')]
    )
    if not ruta:
        messagebox.showwarning('Cancelado', 'No se selecciono ningun archivo.')
        sys.exit(0)

    periodo = simpledialog.askstring(
        'Periodo',
        'Ingrese el periodo (formato YYYYMM)\nEjemplo: 202606',
        initialvalue=datetime.now().strftime('%Y%m')
    )
    if not periodo:
        messagebox.showwarning('Cancelado', 'No se ingreso el periodo.')
        sys.exit(0)

    periodo = periodo.strip()
    if len(periodo) != 6 or not periodo.isdigit():
        messagebox.showerror('Error', f'Periodo invalido: {periodo}\nDebe ser YYYYMM')
        sys.exit(1)

    root.destroy()
    return ruta, periodo

def limpiar_df(df, periodo):
    # Normalizar columnas
    df.columns = [c.strip().upper() for c in df.columns]

    # Filtrar solo FASTCO
    antes = len(df)
    df = df[df['AGENCIA'].str.upper().str.strip() == 'FASTCO'].copy()
    log(f"    AGENCIA=FASTCO: {antes} → {len(df)} filas")

    if len(df) == 0:
        return df

    df['PERIODO']     = periodo
    df['FECHA_CARGA'] = datetime.now()

    # Decimales — limpiar puntos/comas y convertir
    for col in COLUMNAS_DECIMAL:
        if col in df.columns:
            df[col] = (df[col].astype(str)
                       .str.replace(',', '.', regex=False)
                       .str.replace(' ', '', regex=False)
                       .str.replace('$', '', regex=False))
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).round(2)
            # Asegurar que no supera precision DECIMAL(18,2)
            df[col] = df[col].clip(-9999999999999999.99, 9999999999999999.99)

    # Enteros
    for col in COLUMNAS_INT:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)

    # Strings
    cols_str = [c for c in COLUMNAS_ESPERADAS if c not in COLUMNAS_DECIMAL + COLUMNAS_INT]
    for col in cols_str:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str[:200]
            df[col] = df[col].replace({'nan': None, 'None': None, '': None})

    return df

def insertar_df(df, cur, periodo):
    if len(df) == 0:
        return 0

    cols_insert = ['PERIODO','FECHA_CARGA'] + COLUMNAS_ESPERADAS
    placeholders = ','.join(['?' for _ in cols_insert])
    sql = f"INSERT INTO [dbo].[PANEL1_BASE_OFERTAS] ({','.join(cols_insert)}) VALUES ({placeholders})"

    def limpiar_val(v):
        if v is None or (isinstance(v, float) and v != v):  # None o NaN
            return None
        if isinstance(v, datetime):
            return v
        if isinstance(v, (int, float)):
            return float(round(v, 2))
        s = str(v).strip()
        if s in ('', 'nan', 'None', 'NaN', 'NULL'):
            return None
        return s[:200]

    insertados = 0
    for i in range(0, len(df), BATCH_SIZE):
        batch = df.iloc[i:i+BATCH_SIZE]
        rows = list(
            tuple(limpiar_val(valor) for valor in fila)
            for fila in batch.reindex(columns=cols_insert).itertuples(index=False, name=None)
        )
        cur.executemany(sql, rows)
        cur.connection.commit()
        insertados += len(rows)

    return insertados

def procesar_hoja(ruta, hoja, periodo, cur, columnas_excel, tiene_encabezados):
    log(f"  Leyendo hoja: {hoja}...")
    df = pd.read_excel(
        ruta,
        sheet_name=hoja,
        engine='openpyxl',
        dtype=str,
        header=0 if tiene_encabezados else None,
        names=None if tiene_encabezados else columnas_excel,
    )
    log(f"  → {len(df)} filas leidas")

    df = limpiar_df(df, periodo)

    if len(df) == 0:
        log(f"  → Sin filas FASTCO en esta hoja")
        del df
        return 0

    insertados = insertar_df(df, cur, periodo)
    log(f"  → {insertados} filas insertadas")
    del df
    return insertados

def main():
    if len(sys.argv) >= 3:
        ruta_excel = sys.argv[1]
        periodo    = sys.argv[2]
    else:
        ruta_excel, periodo = seleccionar_archivo()

    if not os.path.exists(ruta_excel):
        raise FileNotFoundError(f"Archivo no encontrado: {ruta_excel}")

    log(f"=== ETL BASE OFERTAS === Periodo: {periodo}")
    log(f"Archivo: {ruta_excel}")

    # Conectar
    conn = pyodbc.connect(CONN_STR)
    cur  = conn.cursor()
    cur.fast_executemany = True

    # Eliminar periodo anterior
    log(f"Eliminando datos existentes para periodo {periodo}...")
    cur.execute("DELETE FROM [dbo].[PANEL1_BASE_OFERTAS] WHERE PERIODO = ?", periodo)
    log(f"  {cur.rowcount} filas eliminadas")
    conn.commit()

    # Procesar hoja por hoja
    xl    = pd.ExcelFile(ruta_excel, engine='openpyxl')
    hojas = xl.sheet_names
    log(f"Hojas encontradas: {hojas}")

    # La primera hoja define los encabezados; las siguientes contienen solo datos.
    columnas_excel = pd.read_excel(
        ruta_excel, sheet_name=hojas[0], engine='openpyxl', nrows=0
    ).columns.tolist()

    total = 0
    for indice, hoja in enumerate(hojas):
        insertados = procesar_hoja(
            ruta_excel,
            hoja,
            periodo,
            cur,
            columnas_excel,
            tiene_encabezados=indice == 0,
        )
        total += insertados

    conn.close()

    log(f"=== ETL FINALIZADO === {total} filas cargadas para periodo {periodo}")

    emitir_resultado(
        ok=True,
        mensaje=f"Carga completada: {total} filas cargadas.",
        periodo=periodo,
        filas_cargadas=total,
    )

    # Mensaje final en GUI si no se pasaron argumentos
    if len(sys.argv) < 3:
        root = tk.Tk()
        root.withdraw()
        messagebox.showinfo('ETL Finalizado',
            f'Carga completada exitosamente.\n\nPeriodo: {periodo}\nFilas cargadas: {total:,}')
        root.destroy()

if __name__ == '__main__':
    ejecutar(main)
