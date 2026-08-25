from pydantic import BaseModel


class ProductoCRCI(BaseModel):
    id_producto: int
    nombre: str


class IteracionesResponseCRCI(BaseModel):
    iteraciones: list[str]


class MetricasCRCI(BaseModel):
    fecha_proceso: str
    id_producto: int
    mes: int
    anio: int
    total: int
    stock: int
    flujo_asignacion: int
    reingresos: int
    flujo_ingreso: int
    apercibimiento: int
    retira_demanda: int
    mandamiento: int


class MovimientoDiarioFilaCRCI(BaseModel):
    dia: str
    fecha_proceso: str
    total: int
    stock: int
    flujo_asignacion: int
    reingresos: int
    flujo_ingreso: int
    apercibimiento: int
    retira_demanda: int
    mandamiento: int


class MovimientoDiarioResponseCRCI(BaseModel):
    dias: list[MovimientoDiarioFilaCRCI]
