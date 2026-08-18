import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import DonutChart from '../../../components/charts/DonutChart'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'

export default function EstadoCarteraTab({ periodo }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    apiFetch(`/panel/cla/estado-cartera?periodo=${periodo}`).then(setRows).catch((err) => setError(err.message))
  }, [periodo])

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>

  const total = rows.find((r) => r.clasificacion === 'TOTAL GENERAL')
  const detalle = rows.filter((r) => r.clasificacion !== 'TOTAL GENERAL')

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="Total Causas" value={total?.cantidad_causas.toLocaleString('es-CL')} />
        <KpiCard label="Cuantía Total" value={total?.cuantia_total.toLocaleString('es-CL')} />
        <KpiCard label="Ticket Promedio" value={total?.ticket_promedio.toLocaleString('es-CL')} />
      </div>

      <div className="chart-row">
        <BarChartHorizontal data={detalle.map((r) => ({ label: r.clasificacion, value: r.cantidad_causas }))} />
        <DonutChart data={detalle.map((r) => ({ label: r.clasificacion, value: r.cantidad_causas }))} />
      </div>

      <table className="panel-table">
        <thead>
          <tr>
            <th>Clasificación</th>
            <th>Causas</th>
            <th>Cuantía total</th>
            <th>Ticket promedio</th>
            <th>% Distribución</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.clasificacion} className={row.clasificacion === 'TOTAL GENERAL' ? 'fila-total' : ''}>
              <td>{row.clasificacion}</td>
              <td>{row.cantidad_causas.toLocaleString('es-CL')}</td>
              <td>{row.cuantia_total.toLocaleString('es-CL')}</td>
              <td>{row.ticket_promedio.toLocaleString('es-CL')}</td>
              <td>{row.pct_distribucion}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
