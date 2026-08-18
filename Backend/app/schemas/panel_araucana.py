from pydantic import BaseModel


class EstadoCarteraAraucana(BaseModel):
    clasificacion: str
    total_juicios: int
    total_deudores: int
    monto_cuantia: int
    pct_juicios: float
    pct_cuantia: float


class EmbargoAraucana(BaseModel):
    clasificacion_etapas: str
    total_juicios: int
    total_deudores: int
    monto_cuantia: int
    pct_juicios: float
    pct_cuantia: float


class NotificacionFilaAraucana(BaseModel):
    tipo_notificacion: str
    clasificacion_actual: str
    meses_desde_notif: int
    total_juicios: int


class BusquedaNegativaFilaAraucana(BaseModel):
    ultimo_tipo_busqueda: str
    q_busquedas: int
    total_juicios: int
