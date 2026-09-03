from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel


class TipoCarga(str, Enum):
    cla_base_ofertas = "cla_base_ofertas"
    cla_rl = "cla_rl"
    cla_transferencias = "cla_transferencias"
    cenco_pagos = "cenco_pagos"
    cenco_repros = "cenco_repros"
    cenco_salidas = "cenco_salidas"
    cenco_stock = "cenco_stock"
    cenco_autoges = "cenco_autoges"
    uc_pagos_unicre = "uc_pagos_unicre"


CargaJobStatus = Literal["running", "done", "error"]
TipoErrorCarga = Literal["datos", "infra"]


class TipoCargaOut(BaseModel):
    tipo: TipoCarga
    label: str
    extensiones: list[str]
    requiere_periodo: bool
    requiere_hoja: bool
    permite_forzar: bool
    # Si el tipo de carga acepta 1..N archivos en una misma solicitud (ej.
    # cenco_autoges, donde el usuario puede subir varios archivos del mismo
    # período en cargas separadas o en una sola). Distinto de `permite_forzar`,
    # que controla "ignorar protección de doble carga el mismo día".
    permite_multiples_archivos: bool
    # Si el tipo expone el control de "borrar el período antes de cargar"
    # (DELETE previo por PERIODO) en vez de (o además de) la carga incremental
    # con dedupe. Distinto de `permite_forzar`.
    permite_limpiar_periodo: bool


class CargaAccepted(BaseModel):
    job_id: str


class CargaJobOut(BaseModel):
    job_id: str
    tipo_carga: TipoCarga
    # Para cargas multi-archivo (permite_multiples_archivos=True) se concatenan
    # los nombres originales de todos los archivos subidos, separados por ", ".
    # Para cargas de un solo archivo (todos los demás tipos) es el nombre tal
    # cual, sin cambios de comportamiento respecto al contrato previo.
    archivo_nombre: str
    periodo: Optional[str] = None
    status: CargaJobStatus
    started_at: str
    finished_at: Optional[str] = None
    ok: Optional[bool] = None
    mensaje: Optional[str] = None
    tipo_error: Optional[TipoErrorCarga] = None
    detalle: Optional[dict[str, Any]] = None
    recalculo_job_id: Optional[str] = None


class UltimaCargaOut(BaseModel):
    tipo_carga: TipoCarga
    tiene_registro: bool
    usuario: Optional[str] = None
    archivo_nombre: Optional[str] = None
    fecha: Optional[str] = None
