from pydantic import BaseModel


class EstadoCarteraCLA(BaseModel):
    clasificacion: str
    cantidad_causas: int
    cuantia_total: int
    ticket_promedio: float
    pct_distribucion: float


class ContactabilidadFilaCLA(BaseModel):
    clasificacion: str
    tipo_contacto: str
    cantidad_causas: int
    pct_dentro_clasificacion: float
    promedio_intensidad: float
    dias_habiles: int


class ResumenContactoCLA(BaseModel):
    tipo_contacto: str
    cantidad_causas: int
    pct: float
    dias_habiles: int
    total_gestiones: int
    promedio_gestiones_diarias: float


class InboundCLA(BaseModel):
    clasificacion: str
    q_total: int
    contacto_directo_inbound: int
    sin_contacto_inbound: int


class ContactabilidadResponseCLA(BaseModel):
    matriz: list[ContactabilidadFilaCLA]
    resumen: list[ResumenContactoCLA]
    inbound: list[InboundCLA]


class PagosFilaCLA(BaseModel):
    clasificacion: str
    cantidad_causas: int
    pct_distribucion: float
    total_pagos: float
    ticket_recupero: float


class PagosDiarioCLA(BaseModel):
    fecha_pago: str
    monto_dia: float
    monto_acumulado: float


class PagosResponseCLA(BaseModel):
    resumen: list[PagosFilaCLA]
    diario: list[PagosDiarioCLA]


class ReprosFilaCLA(BaseModel):
    clasificacion: str
    cantidad_causas: int
    pct_distribucion: float
    total_repro: float
    ticket_recupero: float


class ReprosDiarioCLA(BaseModel):
    fecha_repro: str
    saldo_dia: float
    saldo_acumulado: float


class ReprosResponseCLA(BaseModel):
    resumen: list[ReprosFilaCLA]
    diario: list[ReprosDiarioCLA]


class EjecutivoCLA(BaseModel):
    codigo_usuario: str
    cantidad_gestiones: int
    cantidad_contactos: int
    cantidad_rut_pagos: int
    monto_pagos: float
    cantidad_rut_repros: int
    monto_repros: float


class ComparativoFilaCLA(BaseModel):
    nro_dia: int
    fecha_actual: str | None
    fecha_anterior: str | None
    monto_actual: float | None
    monto_anterior: float | None
    acum_actual: float | None
    acum_anterior: float | None
    pct_variacion: float | None
    es_proyeccion: int


class ComparativoResponseCLA(BaseModel):
    pagos: list[ComparativoFilaCLA]
    repros: list[ComparativoFilaCLA]


class ProductividadFilaCLA(BaseModel):
    cartera: str
    cantidad_base: int
    saldo_insoluto: float
    pagos_estudio: float
    repros_estudio: float
    pagos_inbound: float
    total_pagos: float
    total_repros: float


class AvanceEtapaFilaCLA(BaseModel):
    cartera: str
    categoria: str
    q_prom_3meses: float
    saldo_prom_3meses: float
    q_mes_anterior: int
    saldo_mes_anterior: float
    q_mes_actual: int
    saldo_mes_actual: float
    q_proyectado_cierre: float
    saldo_proyectado_cierre: float


class ProductividadResponseCLA(BaseModel):
    general: list[ProductividadFilaCLA]
    avance_etapa: list[AvanceEtapaFilaCLA]
