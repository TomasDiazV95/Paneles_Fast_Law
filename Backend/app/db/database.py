from sqlalchemy import create_engine
from sqlalchemy.engine import URL

from app.core.config import (
    DB_DATABASE,
    DB_ODBC_DRIVER,
    DB_PASSWORD,
    DB_SERVER,
    DB_USER,
)

connection_url = URL.create(
    "mssql+pyodbc",
    username=DB_USER,
    password=DB_PASSWORD,
    host=DB_SERVER,
    database=DB_DATABASE,
    query={
        "driver": DB_ODBC_DRIVER,
        "Encrypt": "no",
        "TrustServerCertificate": "yes",
    },
)

engine = create_engine(
    connection_url,
    pool_pre_ping=True,
)