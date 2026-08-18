import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import DonutChart from '../../../components/charts/DonutChart'

export default function EmbargoTab({ cartera }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    apiFetch(`/panel/araucana/embargo?cartera=${cartera}`).then(setRows).catch((err) => setError(err.message))
  }, [cartera])

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>

  const total = rows.find((r) => r.clasificacion_etapas === 'TOTAL')
  const detalle = rows.filter((r) => r.clasificacion_etapas !== 'TOTAL')

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="Total Juicios" value={total?.total_juicios.toLocaleString('es-CL')} />
        <KpiCard label="Total Deudores" value={total?.total_deudores.toLocaleString('es-CL')} />
        <KpiCard label="Monto Cuantía" value={total?.monto_cuantia.toLocaleString('es-CL')} />
      </div>

      <DonutChart data={detalle.map((r) => ({ label: r.clasificacion_etapas, value: r.total_juicios }))} />

      <table className="panel-table">
        <thead>
          <tr>
            <th>Clasificación por etapa</th>
            <th>Juicios</th>
            <th>Deudores</th>
            <th>Monto cuantía</th>
            <th>% Juicios</th>
            <th>% Cuantía</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.clasificacion_etapas} className={row.clasificacion_etapas === 'TOTAL' ? 'fila-total' : ''}>
              <td>{row.clasificacion_etapas}</td>
              <td>{row.total_juicios.toLocaleString('es-CL')}</td>
              <td>{row.total_deudores.toLocaleString('es-CL')}</td>
              <td>{row.monto_cuantia.toLocaleString('es-CL')}</td>
              <td>{row.pct_juicios}%</td>
              <td>{row.pct_cuantia}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
