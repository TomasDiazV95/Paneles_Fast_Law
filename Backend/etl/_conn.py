"""Conexión pyodbc compartida por los scripts ETL.

Reemplaza el `Trusted_Connection=yes` (autenticación de Windows) que usaban
originalmente estos scripts por las mismas credenciales SQL que ya usa el
backend, leídas desde el `.env` de la raíz del proyecto. Así los ETL pueden
ejecutarse como subprocess del backend sin depender de qué cuenta de Windows
corre el proceso.
"""

import os
import platform
from pathlib import Path

from dotenv import load_dotenv

# Backend/etl/_conn.py -> parents[0]=etl, parents[1]=Backend, parents[2]=raíz del proyecto
ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

DB_SERVER = os.environ["DB_SERVER"]
DB_DATABASE = os.environ["DB_DATABASE"]
DB_USER = os.environ["DB_USER"]
DB_PASSWORD = os.environ["DB_PASSWORD"]


def build_pyodbc_conn_str() -> str:
    """Arma la cadena de conexión pyodbc, respetando `DB_CONN_STR` si está
    seteada explícitamente en el entorno."""
    conn_str = os.getenv("DB_CONN_STR")
    if conn_str:
        return conn_str

    if platform.system() == "Windows":
        return (
            "DRIVER={ODBC Driver 17 for SQL Server};"
            f"SERVER={DB_SERVER};"
            f"DATABASE={DB_DATABASE};"
            f"UID={DB_USER};"
            f"PWD={DB_PASSWORD};"
            "TrustServerCertificate=yes;"
        )

    return (
        "DRIVER={FreeTDS};"
        "SERVERNAME=judicial_sql;"
        f"DATABASE={DB_DATABASE};"
        f"UID={DB_USER};"
        f"PWD={DB_PASSWORD};"
    )
