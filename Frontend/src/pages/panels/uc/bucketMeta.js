// Estados mutuamente excluyentes de una cuenta dentro del período (ver
// Backend/app/routers/panel_uc.py::BUCKET_LABELS). Mismos colores semánticos
// usados en el mockup del cliente (gris/naranjo/azul/verde/rojo).
export const BUCKET_ORDER = ['SIN_GESTION', 'SIN_CONTACTO', 'CONT_SIN_COMP', 'COMP_PAGO', 'COMP_ROTO']

export const BUCKET_META = {
  SIN_GESTION: { label: 'Sin gestión', color: '#8a8a86' },
  SIN_CONTACTO: { label: 'Sin contacto', color: '#eb6834' },
  CONT_SIN_COMP: { label: 'Contactado sin compromiso', color: '#0773BA' },
  // Compromiso de pago / roto reutilizan los colores semánticos de éxito y
  // error del sistema de diseño (mismos que .pct-positive / .pct-negative).
  COMP_PAGO: { label: 'Compromiso de pago', color: 'var(--success)' },
  COMP_ROTO: { label: 'Compromiso roto', color: 'var(--danger)' },
}

export function pctVariacion(actual, anterior) {
  if (actual == null || anterior == null || anterior === 0) return null
  return (((actual - anterior) / anterior) * 100).toFixed(1)
}

// El ejecutivo 'SYSTEM' identifica gestiones automáticas (discador), no una
// persona real. Se muestra con una etiqueta distinta para no confundir al
// usuario, sin alterar el valor real que se envía como filtro al backend.
export function esEjecutivoSistema(valor) {
  return (valor ?? '').trim().toUpperCase() === 'SYSTEM'
}

export function formatEjecutivo(valor) {
  if (!valor) return valor
  return esEjecutivoSistema(valor) ? 'Automático (discador)' : valor
}
