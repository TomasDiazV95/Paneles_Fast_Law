"""Router de carga de archivos ETL.

Permite subir un archivo (Excel/CSV) desde la web y ejecutar el ETL
correspondiente (scripts en `Backend/etl/`) como subprocess, en background,
con el mismo patrón job/polling/lock ya usado en `admin.py` — pero con un
lock **por tipo de carga** (`_running_by_tipo`) en vez de global, para que
dos tipos distintos puedan cargarse en paralelo.

Solo la carga `uc_pagos_unicre` encadena automáticamente, tras terminar con
éxito, el recálculo del panel UC (reutilizando `iniciar_job_pasos` de
`admin.py`, best-effort). Los otros 4 tipos no disparan nada automático.
"""

import json
import logging
import os
import re
import subprocess
import sys
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.core.authz import require_mantenedor
from app.routers import admin
from app.schemas.auth import UserOut
from app.schemas.carga import (
    CargaAccepted,
    CargaJobOut,
    TipoCarga,
    TipoCargaOut,
    UltimaCargaOut,
)

router = APIRouter(prefix="/carga", tags=["carga"])
logger = logging.getLogger(__name__)

_STDERR_LOG_MAX_CHARS = 2000

_PERIODO_RE = re.compile(r"^\d{6}$")
_MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MB
_SUBPROCESS_TIMEOUT_SECONDS = 1800  # 30 min
_CHUNK_SIZE = 1024 * 1024

BACKEND_DIR = Path(__file__).resolve().parents[2]
ETL_DIR = BACKEND_DIR / "etl"
UPLOADS_DIR = BACKEND_DIR / "uploads_tmp"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class CargaContext:
    archivo_path: Path
    archivo_nombre_original: str
    periodo: Optional[str]
    hoja: Optional[str]
    forzar: bool


@dataclass
class CargaConfig:
    label: str
    script: str
    extensiones: tuple[str, ...]
    requiere_periodo: bool
    requiere_hoja: bool
    permite_forzar: bool
    build_args: Callable[[CargaContext], list[str]]


def _args_base_ofertas(ctx: CargaContext) -> list[str]:
    # etl_base_oferta_cla.py usa argumentos posicionales, no flags.
    return [str(ctx.archivo_path), ctx.periodo]


def _args_cla_con_hoja(ctx: CargaContext) -> list[str]:
    args = ["--archivo", str(ctx.archivo_path), "--periodo", ctx.periodo]
    if ctx.hoja:
        args += ["--hoja", ctx.hoja]
    return args


def _args_cenco(tipo: str) -> Callable[[CargaContext], list[str]]:
    def _build(ctx: CargaContext) -> list[str]:
        args = ["--tipo", tipo, "--archivo", str(ctx.archivo_path)]
        if ctx.forzar:
            args.append("--forzar")
        return args

    return _build


def _args_uc(ctx: CargaContext) -> list[str]:
    return ["--archivo", str(ctx.archivo_path), "--periodo", ctx.periodo]


def _args_cenco_salidas(ctx: CargaContext) -> list[str]:
    args = ["--archivo", str(ctx.archivo_path), "--periodo", ctx.periodo]
    if ctx.hoja:
        args += ["--hoja", ctx.hoja]
    if ctx.archivo_nombre_original:
        args += ["--source-file", ctx.archivo_nombre_original]
    return args


CARGA_CONFIG: dict[TipoCarga, CargaConfig] = {
    TipoCarga.cla_base_ofertas: CargaConfig(
        label="CLA · Base de Ofertas",
        script="etl_base_oferta_cla.py",
        extensiones=(".xlsx", ".xls"),
        requiere_periodo=True,
        requiere_hoja=False,
        permite_forzar=False,
        build_args=_args_base_ofertas,
    ),
    TipoCarga.cla_rl: CargaConfig(
        label="CLA · RL",
        script="etl_cla_rl.py",
        extensiones=(".xlsx", ".xls"),
        requiere_periodo=True,
        requiere_hoja=True,
        permite_forzar=False,
        build_args=_args_cla_con_hoja,
    ),
    TipoCarga.cla_transferencias: CargaConfig(
        label="CLA · Transferencias",
        script="etl_cla_transferencia.py",
        extensiones=(".xlsx", ".xls"),
        requiere_periodo=True,
        requiere_hoja=True,
        permite_forzar=False,
        build_args=_args_cla_con_hoja,
    ),
    TipoCarga.cenco_pagos: CargaConfig(
        label="CENCO · Pagos",
        script="etl_cenco_carga_pagos.py",
        extensiones=(".xlsx", ".xls"),
        requiere_periodo=False,
        requiere_hoja=False,
        permite_forzar=True,
        build_args=_args_cenco("pagos"),
    ),
    TipoCarga.cenco_repros: CargaConfig(
        label="CENCO · Repros",
        script="etl_cenco_carga_pagos.py",
        extensiones=(".xlsx", ".xls"),
        requiere_periodo=False,
        requiere_hoja=False,
        permite_forzar=True,
        build_args=_args_cenco("repros"),
    ),
    TipoCarga.cenco_salidas: CargaConfig(
        label="CENCO · Salidas",
        script="etl_cenco_salidas.py",
        extensiones=(".xlsx", ".xls", ".csv"),
        requiere_periodo=True,
        requiere_hoja=True,
        permite_forzar=False,
        build_args=_args_cenco_salidas,
    ),
    TipoCarga.uc_pagos_unicre: CargaConfig(
        label="UC · Pagos Unicre",
        script="etl_unicre_carga_pagos.py",
        extensiones=(".csv",),
        requiere_periodo=True,
        requiere_hoja=False,
        permite_forzar=False,
        build_args=_args_uc,
    ),
}

# Orden fijo para que la respuesta de /carga/tipos sea determinista.
_TIPOS_ORDEN = [
    TipoCarga.cla_base_ofertas,
    TipoCarga.cla_rl,
    TipoCarga.cla_transferencias,
    TipoCarga.cenco_pagos,
    TipoCarga.cenco_repros,
    TipoCarga.cenco_salidas,
    TipoCarga.uc_pagos_unicre,
]


# --- Store de jobs en memoria, con lock por tipo_carga -----------------------
# Mismas limitaciones que el store de admin.py: proceso único, no sobrevive
# un restart. Ver nota de arquitectura en app/routers/admin.py.

_jobs_lock = threading.Lock()
_jobs: dict[str, dict] = {}
_running_by_tipo: dict[TipoCarga, str] = {}
# Última carga exitosa por tipo_carga (memoria, no sobrevive un restart —
# misma limitación que _jobs).
_ultima_carga_por_tipo: dict[TipoCarga, dict] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _parsear_resultado(stdout: str) -> Optional[dict]:
    """Busca la última línea `ETL_RESULT_JSON:{...}` del stdout del ETL."""
    resultado = None
    for linea in stdout.splitlines():
        linea = linea.strip()
        if linea.startswith("ETL_RESULT_JSON:"):
            try:
                resultado = json.loads(linea[len("ETL_RESULT_JSON:") :])
            except json.JSONDecodeError:
                continue
    return resultado


def _ejecutar_carga(
    job_id: str, tipo_carga: TipoCarga, config: CargaConfig, ctx: CargaContext
) -> None:
    script_path = ETL_DIR / config.script
    args = config.build_args(ctx)

    ok = False
    tipo_error: Optional[str] = "infra"
    mensaje = "Error inesperado al ejecutar la carga."
    detalle: Optional[dict] = None

    # Fuerza UTF-8 en stdout/stderr del subproceso: los scripts imprimen
    # caracteres no-ASCII (tildes, "→", "·") y, en Windows, un stdout
    # redirigido a una pipe puede caer al codepage de la consola (cp1252),
    # que no los soporta y rompe con UnicodeEncodeError.
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}

    try:
        proceso = subprocess.run(
            [sys.executable, str(script_path), *args],
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=_SUBPROCESS_TIMEOUT_SECONDS,
            cwd=str(ETL_DIR),
            env=env,
        )
        resultado = _parsear_resultado(proceso.stdout)

        if resultado is not None:
            ok = bool(resultado.get("ok"))
            mensaje = str(
                resultado.get("mensaje")
                or ("Carga finalizada." if ok else "La carga finalizó con errores.")
            )
            extra = {k: v for k, v in resultado.items() if k not in ("ok", "mensaje")}
            detalle = extra or None
            tipo_error = None if ok else ("datos" if proceso.returncode == 2 else "infra")
        else:
            # El script no imprimió el contrato esperado: nunca exponemos
            # stderr crudo (puede incluir detalles de conexión) al cliente,
            # pero sí lo dejamos registrado server-side para diagnóstico.
            ok = False
            tipo_error = "infra"
            mensaje = "El proceso de carga no devolvió un resultado interpretable."
            logger.error(
                "Carga sin ETL_RESULT_JSON interpretable (tipo_carga=%s, job_id=%s, "
                "returncode=%s): stderr=%s",
                tipo_carga,
                job_id,
                proceso.returncode,
                (proceso.stderr or "")[:_STDERR_LOG_MAX_CHARS],
            )

    except subprocess.TimeoutExpired:
        ok = False
        tipo_error = "infra"
        mensaje = "La carga excedió el tiempo máximo de ejecución."
    except Exception:  # noqa: BLE001 - un job no debe tumbar el thread
        ok = False
        tipo_error = "infra"
        mensaje = "Error inesperado al ejecutar la carga."
    finally:
        try:
            ctx.archivo_path.unlink(missing_ok=True)
        except OSError:
            pass

    recalculo_job_id: Optional[str] = None
    if ok and tipo_carga == TipoCarga.uc_pagos_unicre:
        try:
            recalculo_job_id = admin.iniciar_job_pasos([admin.UC_STEP], ctx.periodo)
        except Exception:  # noqa: BLE001 - best-effort, no revierte la carga ya exitosa
            recalculo_job_id = None

    with _jobs_lock:
        job = _jobs[job_id]
        job["status"] = "done" if ok else "error"
        job["finished_at"] = _now_iso()
        job["ok"] = ok
        job["mensaje"] = mensaje
        job["tipo_error"] = tipo_error
        job["detalle"] = detalle
        job["recalculo_job_id"] = recalculo_job_id
        if ok:
            _ultima_carga_por_tipo[tipo_carga] = {
                "usuario": job.get("usuario"),
                "archivo_nombre": job.get("archivo_nombre"),
                "fecha": job["finished_at"],
            }
        if _running_by_tipo.get(tipo_carga) == job_id:
            del _running_by_tipo[tipo_carga]


@router.get("/tipos", response_model=list[TipoCargaOut])
def listar_tipos(current_user: UserOut = Depends(require_mantenedor)):
    return [
        TipoCargaOut(
            tipo=tipo,
            label=CARGA_CONFIG[tipo].label,
            extensiones=list(CARGA_CONFIG[tipo].extensiones),
            requiere_periodo=CARGA_CONFIG[tipo].requiere_periodo,
            requiere_hoja=CARGA_CONFIG[tipo].requiere_hoja,
            permite_forzar=CARGA_CONFIG[tipo].permite_forzar,
        )
        for tipo in _TIPOS_ORDEN
    ]


@router.post("/{tipo_carga}", response_model=CargaAccepted, status_code=status.HTTP_202_ACCEPTED)
def crear_carga(
    tipo_carga: TipoCarga,
    archivo: UploadFile = File(...),
    periodo: Optional[str] = Form(None),
    hoja: Optional[str] = Form(None),
    forzar: bool = Form(False),
    current_user: UserOut = Depends(require_mantenedor),
):
    config = CARGA_CONFIG[tipo_carga]

    nombre_original = archivo.filename or ""
    extension = Path(nombre_original).suffix.lower()
    if extension not in config.extensiones:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Extensión no permitida para {config.label}: "
                f"'{extension or '(sin extensión)'}'. "
                f"Extensiones permitidas: {', '.join(config.extensiones)}."
            ),
        )

    periodo_limpio: Optional[str] = None
    if config.requiere_periodo:
        if not periodo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="periodo es obligatorio para este tipo de carga",
            )
        if not _PERIODO_RE.match(periodo):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Periodo inválido: formato esperado YYYYMM",
            )
        periodo_limpio = periodo

    hoja_limpia = hoja.strip() if hoja and hoja.strip() else None

    with _jobs_lock:
        job_en_curso = _running_by_tipo.get(tipo_carga)
        if job_en_curso is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya hay una carga de este tipo en curso (job_id={job_en_curso})",
            )
        job_id = str(uuid4())
        _running_by_tipo[tipo_carga] = job_id

    tmp_path = UPLOADS_DIR / f"{job_id}{extension}"
    tamano = 0
    try:
        with open(tmp_path, "wb") as destino:
            while True:
                chunk = archivo.file.read(_CHUNK_SIZE)
                if not chunk:
                    break
                tamano += len(chunk)
                if tamano > _MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="El archivo excede el tamaño máximo permitido (50 MB)",
                    )
                destino.write(chunk)
    except HTTPException:
        tmp_path.unlink(missing_ok=True)
        with _jobs_lock:
            if _running_by_tipo.get(tipo_carga) == job_id:
                del _running_by_tipo[tipo_carga]
        raise
    finally:
        archivo.file.close()

    ctx = CargaContext(
        archivo_path=tmp_path,
        archivo_nombre_original=nombre_original,
        periodo=periodo_limpio,
        hoja=hoja_limpia,
        forzar=forzar,
    )

    with _jobs_lock:
        _jobs[job_id] = {
            "job_id": job_id,
            "tipo_carga": tipo_carga,
            "archivo_nombre": nombre_original,
            "periodo": periodo_limpio,
            "usuario": current_user.user,
            "status": "running",
            "started_at": _now_iso(),
            "finished_at": None,
            "ok": None,
            "mensaje": None,
            "tipo_error": None,
            "detalle": None,
            "recalculo_job_id": None,
        }

    thread = threading.Thread(
        target=_ejecutar_carga, args=(job_id, tipo_carga, config, ctx), daemon=True
    )
    thread.start()

    return CargaAccepted(job_id=job_id)


@router.get("/{tipo_carga}/ultima", response_model=UltimaCargaOut)
def ultima_carga(tipo_carga: TipoCarga, current_user: UserOut = Depends(require_mantenedor)):
    with _jobs_lock:
        registro = _ultima_carga_por_tipo.get(tipo_carga)

    if registro is None:
        return UltimaCargaOut(
            tipo_carga=tipo_carga,
            tiene_registro=False,
            usuario=None,
            archivo_nombre=None,
            fecha=None,
        )

    return UltimaCargaOut(
        tipo_carga=tipo_carga,
        tiene_registro=True,
        usuario=registro.get("usuario"),
        archivo_nombre=registro.get("archivo_nombre"),
        fecha=registro.get("fecha"),
    )


@router.get("/{job_id}", response_model=CargaJobOut)
def estado_carga(job_id: str, current_user: UserOut = Depends(require_mantenedor)):
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job no encontrado")
        return CargaJobOut(**job)
