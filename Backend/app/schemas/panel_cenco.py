from pydantic import BaseModel


class ComparativoFilaCenco(BaseModel):
    ord: int
    nro_dia: int | None
    fecha_actual: str | None
    fecha_anterior: str | None
    monto_actual: int | None
    monto_anterior: int | None
    acum_actual: int | None
    acum_anterior: int | None
    tipo_fila: str
    gestor_origen: str


class PeriodoOptionCenco(BaseModel):
    periodo: str
    causas: int


class EstadoCarteraCenco(BaseModel):
    clasificacion: str
    cantidad_causas: int
    cuantia_total: int
    ticket_promedio: float


class ContactabilidadFilaCenco(BaseModel):
    clasificacion: str
    tipo_contacto: str
    cantidad_deudores: int


class ResumenContactoCenco(BaseModel):
    total_deudores: int
    con_contacto: int
    sin_gestion: int


class ContactabilidadResponseCenco(BaseModel):
    matriz: list[ContactabilidadFilaCenco]
    resumen: list[ResumenContactoCenco]


class PagosFilaCenco(BaseModel):
    clasificacion: str
    cantidad_documentos: int
    monto_total: int


class PagosDiarioCenco(BaseModel):
    fecha: str
    monto_dia: int
    monto_acumulado: int


class PagosResponseCenco(BaseModel):
    resumen: list[PagosFilaCenco]
    diario: list[PagosDiarioCenco]


class ReprosFilaCenco(BaseModel):
    clasificacion: str
    cantidad_documentos: int
    monto_total: int


class ReprosDiarioCenco(BaseModel):
    fecha: str
    monto_dia: int
    monto_acumulado: int


class ReprosResponseCenco(BaseModel):
    resumen: list[ReprosFilaCenco]
    diario: list[ReprosDiarioCenco]


class EjecutivoCenco(BaseModel):
    codigo_usuario: str
    cantidad_contactos: int
    cantidad_pagos: int
    monto_pagos: int
    cantidad_repros: int
    monto_repros: int


class ComparativoResponseCenco(BaseModel):
    pagos: list[ComparativoFilaCenco]
    repros: list[ComparativoFilaCenco]


class SalidaFilaCenco(BaseModel):
    cuenta: str
    rut: int
    operacion: str | None
    numero_juicio: str | None
    marca_glosa_abogados: str | None
    marca: str | None
    es_duplicado: bool
    fecha_salida: str | None
    casos_dia: int
