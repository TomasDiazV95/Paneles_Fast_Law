import os
import platform
from urllib.parse import quote_plus

from sqlalchemy import create_engine

from app.core.config import (
    DB_DATABASE,
    DB_PASSWORD,
    DB_SERVER,
    DB_USER,
)

if os.getenv("DB_CONN_STR"):
    odbc_string = os.getenv("DB_CONN_STR")

elif platform.system() == "Windows":
    odbc_string = (
        "DRIVER={ODBC Driver 17 for SQL Server};"
        f"SERVER={DB_SERVER};"
        f"DATABASE={DB_DATABASE};"
        f"UID={DB_USER};"
        f"PWD={DB_PASSWORD};"
        "TrustServerCertificate=yes;"
    )

else:
    odbc_string = (
        "DRIVER={FreeTDS};"
        "SERVERNAME=judicial_sql;"
        f"DATABASE={DB_DATABASE};"
        f"UID={DB_USER};"
        f"PWD={DB_PASSWORD};"
    )

connection_url = (
    "mssql+pyodbc:///?odbc_connect="
    + quote_plus(odbc_string)
)

engine = create_engine(
    connection_url,
    pool_pre_ping=True,
    isolation_level="AUTOCOMMIT",
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
)