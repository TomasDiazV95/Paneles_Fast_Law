import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import StackedBarChartVertical from '../../../components/charts/StackedBarChartVertical'
import { BUCKET_META, BUCKET_ORDER } from './bucketMeta'

function pivotar(filas) {
  const porFecha = new Map()
  filas.forEach((f) => {
    if (!porFecha.has(f.fecha)) porFecha.set(f.fecha, { fecha: f.fecha })
    porFecha.get(f.fecha)[f.bucket] = f.cuentas
  })
  return Array.from(porFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export default function ActividadDiariaBloque({ periodo, cartera }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    setError('')
    apiFetch(`/panel/uc/actividad-diaria?periodo=${periodo}&cartera=${cartera}`)
      .then(setRows)
      .catch((err) => setError(err.message))
  }, [periodo, cartera])

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>
  if (!rows.length) return <p>Sin fechas de gestión registradas en este período.</p>

  const data = pivotar(rows)
  const series = BUCKET_ORDER.map((b) => ({ key: b, label: BUCKET_META[b].label, color: BUCKET_META[b].color }))

  return (
    <StackedBarChartVertical
      data={data}
      xKey="fecha"
      series={series}
      height={230}
      title="Actividad diaria — cuentas por fecha de última gestión, apiladas por estado"
      xFormatter={(v) => v?.slice(5)}
    />
  )
}
