from pydantic import BaseModel


class PeriodoOptionUC(BaseModel):
    periodo: str
    cuentas: int
    fecha_proceso: str


class KpiPeriodoUC(BaseModel):
    periodo: str
    cuentas: int
    deuda: int
    ticket_promedio: float
    sin_gestion: int
    deuda_sin_gestion: int
    cobertura_pct: float
    gestiones: int
    gestiones_por_cuenta_gestionada: float
    contactos: int
    contactabilidad_pct: float
    contacto_directo: int
    contacto_directo_pct: float
    compromisos: int
    conversion_compromiso_pct: float
    compromisos_rotos: int
    incumplimiento_pct: float
    intensidad_media: float


class KpiResumenUC(BaseModel):
    actual: KpiPeriodoUC
    anterior: KpiPeriodoUC | None = None


class EstadoCarteraFilaUC(BaseModel):
    bucket: str
    etiqueta: str
    cuentas: int
    deuda: int
    gestiones: int
    pct_cuentas: float


class EmbudoEtapaUC(BaseModel):
    etapa: str
    cuentas: int
    pct_del_total: float
    pct_conversion_etapa: float | None = None


class EvolucionFilaUC(BaseModel):
    periodo: str
    cuentas: int
    deuda: int
    gestiones: int
    sin_gestion: int
    contactabilidad_pct: float
    compromisos: int
    compromisos_rotos: int


class ActividadDiariaFilaUC(BaseModel):
    fecha: str
    bucket: str
    cuentas: int


class FranjaHorariaFilaUC(BaseModel):
    hora: int
    gestiones: int
    contactos: int


class DimensionFilaUC(BaseModel):
    valor: str
    cuentas: int
    deuda: int
    contactos: int
    compromisos: int
    sin_gestion: int


class DimensionesResponseUC(BaseModel):
    prioridad: list[DimensionFilaUC]
    estado_convenio: list[DimensionFilaUC]
    ejecutivo: list[DimensionFilaUC]
    tipificacion: list[DimensionFilaUC]
    intensidad: list[DimensionFilaUC]
    bucket: list[DimensionFilaUC]


class CuentaDetalleUC(BaseModel):
    rut_deudor: int
    dv_deudor: str | None
    nombre_deudor: str | None
    numero_documento: str
    monto_asignado: int | None
    saldo_insoluto: int | None
    plazo: int | None
    anho_vehiculo: str | None
    categoria_vehiculo: str | None
    estado_convenio: str | None
    tipo_contacto: str
    tipificacion: str | None
    fecha_ultima_gestion: str | None
    ejecutivo: str | None
    prioridad: int | None
    cantidad_gestiones: int
    fecha_agendamiento: str | None
    monto_agendamiento: int | None
    monto_pagado_periodo: int
    cuotas_pagadas: int
    bucket: str


class DetalleResponseUC(BaseModel):
    total: int
    pagina: int
    tamano_pagina: int
    filas: list[CuentaDetalleUC]


class PagosResumenUC(BaseModel):
    casos: int
    monto: int


class PagoDiaUC(BaseModel):
    fecha_pago: str
    casos: int
    monto: int
