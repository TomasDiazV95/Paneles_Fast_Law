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
# Límite de archivos por solicitud para tipos con permite_multiples_archivos=True
# (hoy solo cenco_autoges). Los tipos single-file siguen exigiendo exactamente 1.
_MAX_ARCHIVOS_MULTIPLES = 5

BACKEND_DIR = Path(__file__).resolve().parents[2]
ETL_DIR = BACKEND_DIR / "etl"
UPLOADS_DIR = BACKEND_DIR / "uploads_tmp"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class CargaContext:
    # Listas siempre alineadas por posición: archivo_paths[i] corresponde a
    # archivo_nombres_originales[i] y hojas[i]. Para los tipos single-file
    # (permite_multiples_archivos=False) estas listas siempre tienen 1 elemento.
    archivo_paths: list[Path]
    archivo_nombres_originales: list[str]
    periodo: Optional[str]
    hojas: list[Optional[str]]
    forzar: bool
    limpiar_periodo: bool


@dataclass
class CargaConfig:
    label: str
    script: str
    extensiones: tuple[str, ...]
    requiere_periodo: bool
    requiere_hoja: bool
    permite_forzar: bool
    permite_multiples_archivos: bool
    permite_limpiar_periodo: bool
    build_args: Callable[[CargaContext], list[str]]


def _args_base_ofertas(ctx: CargaContext) -> list[str]:
    # etl_base_oferta_cla.py usa argumentos posicionales, no flags.
    return [str(ctx.archivo_paths[0]), ctx.periodo]


def _args_cla_con_hoja(ctx: CargaContext) -> list[str]:
    args = ["--archivo", str(ctx.archivo_paths[0]), "--periodo", ctx.periodo]
    hoja = ctx.hojas[0]
    if hoja:
        args += ["--hoja", hoja]
    return args


def _args_cenco(tipo: str) -> Callable[[CargaContext], list[str]]:
    def _build(ctx: CargaContext) -> list[str]:
        args = ["--tipo", tipo, "--archivo", str(ctx.archivo_paths[0])]
        if ctx.forzar:
            args.append("--forzar")
        return args

    return _build


def _args_uc(ctx: CargaContext) -> list[str]:
    return ["--archivo", str(ctx.archivo_paths[0]), "--periodo", ctx.periodo]


def _args_periodo_hoja_source(ctx: CargaContext) -> list[str]:
    # Compartido por los ETL que aceptan --archivo/--periodo/--hoja/--source-file
    # (etl_cenco_salidas.py y etl_cenco_stock.py siguen el mismo patrón de CLI).
    args = ["--archivo", str(ctx.archivo_paths[0]), "--periodo", ctx.periodo]
    hoja = ctx.hojas[0]
    if hoja:
        args += ["--hoja", hoja]
    nombre_original = ctx.archivo_nombres_originales[0]
    if nombre_original:
        args += ["--source-file", nombre_original]
    return args


def _args_cenco_autoges(ctx: CargaContext) -> list[str]:
    # etl_cenco_autoges.py acepta --archivo repetible, con --hoja y
    # --source-file asociados por POSICIÓN a cada --archivo. Si se usa --hoja,
    # el ETL exige una entrada por cada --archivo (ver resolver_argumentos), y
    # un archivo .csv no admite --hoja en absoluto (ni siquiera "" vacío: ver
    # leer_archivo, que rechaza cualquier valor no-None para CSV). Por eso acá
    # solo emitimos --hoja si el usuario indicó hoja para TODOS los archivos Y
    # ninguno de ellos es CSV; en cualquier otro caso omitimos --hoja por
    # completo y dejamos que el ETL auto-resuelva la hoja de cada Excel de una
    # sola hoja (fallará como error de datos, no como crash, si algún Excel
    # multi-hoja queda sin resolver).
    hay_csv = any(path.suffix.lower() == ".csv" for path in ctx.archivo_paths)
    hoja_solicitada = any(hoja is not None for hoja in ctx.hojas)
    incluir_hoja = hoja_solicitada and not hay_csv

    args = ["--periodo", ctx.periodo]
    for idx, path in enumerate(ctx.archivo_paths):
        args += ["--archivo", str(path)]
        if incluir_hoja:
            args += ["--hoja", ctx.hojas[idx] or ""]
    for nombre_original in ctx.archivo_nombres_originales:
        args += ["--source-file", nombre_original]
    if ctx.limpiar_periodo:
        args.append("--limpiar-periodo")
    return args


CARGA_CONFIG: dict[TipoCarga, CargaConfig] = {
    TipoCarga.cla_base_ofertas: CargaConfig(
        label="CLA · Base de Ofertas",
        script="etl_base_oferta_cla.py",
        extensiones=(".xlsx", ".xls"),
        requiere_periodo=True,
        requiere_hoja=False,
        permite_forzar=False,
        permite_multiples_archivos=False,
        permite_limpiar_periodo=False,
        build_args=_args_base_ofertas,
    ),
    TipoCarga.cla_rl: CargaConfig(
        label="CLA · RL",
        script="etl_cla_rl.py",
        extensiones=(".xlsx", ".xls"),
        requiere_periodo=True,
        requiere_hoja=True,
        permite_forzar=False,
        permite_multiples_archivos=False,
        permite_limpiar_periodo=False,
        build_args=_args_cla_con_hoja,
    ),
    TipoCarga.cla_transferencias: CargaConfig(
        label="CLA · Transferencias",
        script="etl_cla_transferencia.py",
        extensiones=(".xlsx", ".xls"),
        requiere_periodo=True,
        requiere_hoja=True,
        permite_forzar=False,
        permite_multiples_archivos=False,
        permite_limpiar_periodo=False,
        build_args=_args_cla_con_hoja,
    ),
    TipoCarga.cenco_pagos: CargaConfig(
        label="CENCO · Pagos",
        script="etl_cenco_carga_pagos.py",
        extensiones=(".xlsx", ".xls"),
        requiere_periodo=False,
        requiere_hoja=False,
        permite_forzar=True,
        permite_multiples_archivos=False,
        permite_limpiar_periodo=False,
        build_args=_args_cenco("pagos"),
    ),
    TipoCarga.cenco_repros: CargaConfig(
        label="CENCO · Repros",
        script="etl_cenco_carga_pagos.py",
        extensiones=(".xlsx", ".xls"),
        requiere_periodo=False,
        requiere_hoja=False,
        permite_forzar=True,
        permite_multiples_archivos=False,
        permite_limpiar_periodo=False,
        build_args=_args_cenco("repros"),
    ),
    TipoCarga.cenco_salidas: CargaConfig(
        label="CENCO · Salidas",
        script="etl_cenco_salidas.py",
        extensiones=(".xlsx", ".xls", ".csv"),
        requiere_periodo=True,
        requiere_hoja=True,
        permite_forzar=False,
        permite_multiples_archivos=False,
        permite_limpiar_periodo=False,
        build_args=_args_periodo_hoja_source,
    ),
    TipoCarga.cenco_stock: CargaConfig(
        label="CENCO · Stock",
        script="etl_cenco_stock.py",
        extensiones=(".xlsx", ".xls", ".csv"),
        requiere_periodo=True,
        requiere_hoja=True,
        permite_forzar=False,
        permite_multiples_archivos=False,
        permite_limpiar_periodo=False,
        build_args=_args_periodo_hoja_source,
    ),
    TipoCarga.cenco_autoges: CargaConfig(
        label="CENCO · Autogestión",
        script="etl_cenco_autoges.py",
        extensiones=(".xlsx", ".xls", ".csv"),
        requiere_periodo=True,
        requiere_hoja=True,
        permite_forzar=False,
        permite_multiples_archivos=True,
        permite_limpiar_periodo=True,
        build_args=_args_cenco_autoges,
    ),
    TipoCarga.uc_pagos_unicre: CargaConfig(
        label="UC · Pagos Unicre",
        script="etl_unicre_carga_pagos.py",
        extensiones=(".csv",),
        requiere_periodo=True,
        requiere_hoja=False,
        permite_forzar=False,
        permite_multiples_archivos=False,
        permite_limpiar_periodo=False,
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
    TipoCarga.cenco_stock,
    TipoCarga.cenco_autoges,
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
        for archivo_path in ctx.archivo_paths:
            try:
                archivo_path.unlink(missing_ok=True)
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
            permite_multiples_archivos=CARGA_CONFIG[tipo].permite_multiples_archivos,
            permite_limpiar_periodo=CARGA_CONFIG[tipo].permite_limpiar_periodo,
        )
        for tipo in _TIPOS_ORDEN
    ]


@router.post("/{tipo_carga}", response_model=CargaAccepted, status_code=status.HTTP_202_ACCEPTED)
def crear_carga(
    tipo_carga: TipoCarga,
    archivo: list[UploadFile] = File(...),
    periodo: Optional[str] = Form(None),
    hoja: Optional[list[str]] = Form(None),
    forzar: bool = Form(False),
    limpiar_periodo: bool = Form(False),
    current_user: UserOut = Depends(require_mantenedor),
):
    config = CARGA_CONFIG[tipo_carga]

    if not archivo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe adjuntar al menos un archivo.",
        )

    if config.permite_multiples_archivos:
        if len(archivo) > _MAX_ARCHIVOS_MULTIPLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{config.label} admite como máximo "
                    f"{_MAX_ARCHIVOS_MULTIPLES} archivos por carga."
                ),
            )
    elif len(archivo) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{config.label} admite exactamente un archivo por carga.",
        )

    nombres_originales = [uploaded.filename or "" for uploaded in archivo]
    extensiones = [Path(nombre).suffix.lower() for nombre in nombres_originales]
    for nombre, extension in zip(nombres_originales, extensiones):
        if extension not in config.extensiones:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Extensión no permitida para {config.label}: "
                    f"'{extension or '(sin extensión)'}' (archivo: "
                    f"'{nombre or '(sin nombre)'}'). "
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

    if hoja is not None:
        if len(hoja) != len(archivo):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Si se especifica 'hoja', debe indicarse exactamente una "
                    "por cada archivo adjunto, en el mismo orden."
                ),
            )
        hojas_limpias: list[Optional[str]] = [
            valor.strip() if valor and valor.strip() else None for valor in hoja
        ]
        for nombre, valor_hoja, extension in zip(nombres_originales, hojas_limpias, extensiones):
            if valor_hoja and extension == ".csv":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"El archivo '{nombre}' es CSV y no admite el parámetro "
                        "'hoja'. Los archivos CSV no tienen hojas; no incluya "
                        "'hoja' para ellos."
                    ),
                )
    else:
        hojas_limpias = [None] * len(archivo)

    with _jobs_lock:
        job_en_curso = _running_by_tipo.get(tipo_carga)
        if job_en_curso is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya hay una carga de este tipo en curso (job_id={job_en_curso})",
            )
        job_id = str(uuid4())
        _running_by_tipo[tipo_carga] = job_id

    archivo_paths: list[Path] = []
    try:
        for idx, (uploaded, extension) in enumerate(zip(archivo, extensiones)):
            tmp_path = UPLOADS_DIR / f"{job_id}_{idx}{extension}"
            archivo_paths.append(tmp_path)
            tamano = 0
            with open(tmp_path, "wb") as destino:
                while True:
                    chunk = uploaded.file.read(_CHUNK_SIZE)
                    if not chunk:
                        break
                    tamano += len(chunk)
                    if tamano > _MAX_UPLOAD_BYTES:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=(
                                f"El archivo '{nombres_originales[idx]}' excede "
                                "el tamaño máximo permitido (500 MB)"
                            ),
                        )
                    destino.write(chunk)
    except HTTPException:
        for archivo_path in archivo_paths:
            archivo_path.unlink(missing_ok=True)
        with _jobs_lock:
            if _running_by_tipo.get(tipo_carga) == job_id:
                del _running_by_tipo[tipo_carga]
        raise
    finally:
        for uploaded in archivo:
            uploaded.file.close()

    ctx = CargaContext(
        archivo_paths=archivo_paths,
        archivo_nombres_originales=nombres_originales,
        periodo=periodo_limpio,
        hojas=hojas_limpias,
        forzar=forzar,
        limpiar_periodo=limpiar_periodo,
    )

    archivo_nombre_job = ", ".join(nombre for nombre in nombres_originales if nombre)

    with _jobs_lock:
        _jobs[job_id] = {
            "job_id": job_id,
            "tipo_carga": tipo_carga,
            "archivo_nombre": archivo_nombre_job,
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
