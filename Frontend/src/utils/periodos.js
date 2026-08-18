const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function toOption(anio, mesIndex) {
  const mes = mesIndex + 1
  const value = `${anio}${String(mes).padStart(2, '0')}`
  const label = `${String(mes).padStart(2, '0')} — ${NOMBRES_MES[mesIndex]} ${anio}`
  return { value, label }
}

export function getPeriodoOptions(now = new Date()) {
  const anio = now.getFullYear()
  const mesIndex = now.getMonth()
  const actual = toOption(anio, mesIndex)
  const anterior = mesIndex === 0 ? toOption(anio - 1, 11) : toOption(anio, mesIndex - 1)
  return [actual, anterior]
}
