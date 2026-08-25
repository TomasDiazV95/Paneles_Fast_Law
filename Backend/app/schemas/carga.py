from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel


class TipoCarga(str, Enum):
    cla_base_ofertas = "cla_base_ofertas"
    cla_rl = "cla_rl"
    cla_transferencias = "cla_transferencias"
    cenco_pagos = "cenco_pagos"
    cenco_repros = "cenco_repros"
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


class CargaAccepted(BaseModel):
    job_id: str


class CargaJobOut(BaseModel):
    job_id: str
    tipo_carga: TipoCarga
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
