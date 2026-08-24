"""Endpoints administrativos: recálculo manual de los paneles de los 4 mandantes.

Nota de arquitectura: el store de jobs (`_jobs`) vive en un dict en memoria del
proceso, protegido por un `threading.Lock`. Esto es suficiente porque la API
corre como un único proceso/worker; no sobrevive un restart y no funciona si
en el futuro se despliega con múltiples workers (gunicorn -w N, por ejemplo).
Si eso cambiara, este store debería migrar a algo compartido (tabla en BD,
Redis, etc.).
"""

import re
import threading
import time
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.database import engine
from app.routers.auth import get_current_user
from app.schemas.admin import PanelRefreshAccepted, PanelRefreshRequest, RefreshJobOut
from app.schemas.auth import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])

_PERIODO_RE = re.compile(r"^\d{6}$")


def _validar_periodo(periodo: str) -> str:
    if not _PERIODO_RE.match(periodo):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Periodo inválido: formato esperado YYYYMM",
        )
    return periodo


def require_admin(current_user: UserOut = Depends(get_current_user)) -> UserOut:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol ADMIN para ejecutar esta acción",
        )
    return current_user


# --- Definición de los 11 pasos de recálculo ---------------------------------
# Cada paso ejecuta un SP existente. Los mandantes son independientes entre sí:
# si un paso falla no se abortan los siguientes.

_STEPS = [
    {
        "mandante": "CLA",
        "cartera": "204",
        "label": "CLA",
        "sql": (
            "EXEC dbo.SP_Panel1_Proceso_Caja_Los_Andes "
            "@CARTERA=204, @Periodo=:periodo, @Producto=1, @CARTERA_INBOUND=162, @Forzar=1"
        ),
        "params": {},
    },
    {
        "mandante": "CENCO",
        "cartera": "427",
        "label": "CENCO · H1",
        "sql": (
            "EXEC dbo.SP_Panel_Proceso_Cenco "
            "@CARTERA=:cartera, @Periodo=:periodo, @Producto=5, @CARTERA_INBOUND=NULL"
        ),
        "params": {"cartera": 427},
    },
    {
        "mandante": "CENCO",
        "cartera": "875",
        "label": "CENCO · T4",
        "sql": (
            "EXEC dbo.SP_Panel_Proceso_Cenco "
            "@CARTERA=:cartera, @Periodo=:periodo, @Producto=5, @CARTERA_INBOUND=NULL"
        ),
        "params": {"cartera": 875},
    },
    {
        "mandante": "ARAUCANA",
        "cartera": "16",
        "label": "ARAUCANA · Juicio Ordinario",
        "sql": "EXEC dbo.SP_Panel_Proceso_ARAUCANA @Producto=:producto, @Periodo=:periodo",
        "params": {"producto": 16},
    },
    {
        "mandante": "ARAUCANA",
        "cartera": "13",
        "label": "ARAUCANA · Caja La Araucana",
        "sql": "EXEC dbo.SP_Panel_Proceso_ARAUCANA @Producto=:producto, @Periodo=:periodo",
        "params": {"producto": 13},
    },
    {
        "mandante": "ARAUCANA",
        "cartera": "19",
        "label": "ARAUCANA · Lipigas",
        "sql": "EXEC dbo.SP_Panel_Proceso_ARAUCANA @Producto=:producto, @Periodo=:periodo",
        "params": {"producto": 19},
    },
    {
        "mandante": "ARAUCANA",
        "cartera": "21",
        "label": "ARAUCANA · Forum",
        "sql": "EXEC dbo.SP_Panel_Proceso_ARAUCANA @Producto=:producto, @Periodo=:periodo",
        "params": {"producto": 21},
    },
    {
        "mandante": "ARAUCANA",
        "cartera": "6",
        "label": "ARAUCANA · Santander",
        "sql": "EXEC dbo.SP_Panel_Proceso_ARAUCANA @Producto=:producto, @Periodo=:periodo",
        "params": {"producto": 6},
    },
    {
        "mandante": "ARAUCANA",
        "cartera": "1",
        "label": "ARAUCANA · Caja Los Andes",
        "sql": "EXEC dbo.SP_Panel_Proceso_ARAUCANA @Producto=:producto, @Periodo=:periodo",
        "params": {"producto": 1},
    },
    {
        "mandante": "ARAUCANA",
        "cartera": "5",
        "label": "ARAUCANA · Cencosud",
        "sql": "EXEC dbo.SP_Panel_Proceso_ARAUCANA @Producto=:producto, @Periodo=:periodo",
        "params": {"producto": 5},
    },
    {
        "mandante": "UC",
        "cartera": "890",
        "label": "UC",
        "sql": "EXEC dbo.SP_Panel_UC_Proceso @CARTERA=890, @Periodo=:periodo",
        "params": {},
    },
]


# --- Store de jobs en memoria -------------------------------------------------

_jobs_lock = threading.Lock()
_jobs: dict[str, dict] = {}
_running_job_id: str | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _crear_job(job_id: str, periodo: str) -> dict:
    return {
        "job_id": job_id,
        "periodo": periodo,
        "status": "running",
        "started_at": _now_iso(),
        "finished_at": None,
        "steps": [
            {
                "mandante": paso["mandante"],
                "cartera": paso["cartera"],
                "label": paso["label"],
                "status": "pending",
                "started_at": None,
                "finished_at": None,
                "duration_seconds": None,
                "error": None,
            }
            for paso in _STEPS
        ],
    }


def _ejecutar_job(job_id: str, periodo: str) -> None:
    global _running_job_id
    hubo_error = False

    for indice, paso in enumerate(_STEPS):
        with _jobs_lock:
            step = _jobs[job_id]["steps"][indice]
            step["status"] = "running"
            step["started_at"] = _now_iso()

        inicio = time.monotonic()
        error_msg: str | None = None
        try:
            params = {"periodo": periodo, **paso["params"]}
            with engine.connect() as conn:
                conn.execute(text(paso["sql"]), params)
        except SQLAlchemyError as exc:
            # No exponer connection string ni detalles internos del driver;
            # solo la clase de error y un mensaje corto.
            error_msg = f"{type(exc.orig).__name__ if getattr(exc, 'orig', None) else type(exc).__name__}: fallo al ejecutar el SP"
            hubo_error = True
        except Exception as exc:  # noqa: BLE001 - un paso no debe tumbar el job completo
            error_msg = "Error inesperado al ejecutar el paso"
            hubo_error = True

        duracion = round(time.monotonic() - inicio, 2)

        with _jobs_lock:
            step = _jobs[job_id]["steps"][indice]
            step["finished_at"] = _now_iso()
            step["duration_seconds"] = duracion
            if error_msg is None:
                step["status"] = "done"
            else:
                step["status"] = "error"
                step["error"] = error_msg

    with _jobs_lock:
        _jobs[job_id]["status"] = "completed_with_errors" if hubo_error else "completed"
        _jobs[job_id]["finished_at"] = _now_iso()
        _running_job_id = None


@router.post("/panel-refresh", response_model=PanelRefreshAccepted, status_code=status.HTTP_202_ACCEPTED)
def panel_refresh(payload: PanelRefreshRequest, current_user: UserOut = Depends(require_admin)):
    periodo = _validar_periodo(payload.periodo)

    global _running_job_id
    with _jobs_lock:
        if _running_job_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya hay una actualización en curso (job_id={_running_job_id})",
            )
        job_id = str(uuid4())
        _jobs[job_id] = _crear_job(job_id, periodo)
        _running_job_id = job_id

    thread = threading.Thread(target=_ejecutar_job, args=(job_id, periodo), daemon=True)
    thread.start()

    return PanelRefreshAccepted(job_id=job_id)


@router.get("/panel-refresh/last", response_model=RefreshJobOut)
def panel_refresh_last(current_user: UserOut = Depends(require_admin)):
    with _jobs_lock:
        if not _jobs:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No hay jobs registrados")
        ultimo = max(_jobs.values(), key=lambda j: j["started_at"])
        return RefreshJobOut(**ultimo)


@router.get("/panel-refresh/{job_id}", response_model=RefreshJobOut)
def panel_refresh_status(job_id: str, current_user: UserOut = Depends(require_admin)):
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job no encontrado")
        return RefreshJobOut(**job)
