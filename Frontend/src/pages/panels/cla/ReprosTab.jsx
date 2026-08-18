import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'
import BarChartVertical from '../../../components/charts/BarChartVertical'
import LineChartFilled from '../../../components/charts/LineChartFilled'

export default function ReprosTab({ periodo }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    apiFetch(`/panel/cla/repros?periodo=${periodo}`).then(setData).catch((err) => setError(err.message))
  }, [periodo])

  if (error) return <p className="login-error">{error}</p>
  if (!data) return <p>Cargando...</p>

  const { resumen, diario } = data
  const total = resumen.find((r) => r.clasificacion === 'TOTAL GENERAL')
  const detalle = resumen.filter((r) => r.clasificacion !== 'TOTAL GENERAL')
  const saldoAlDia = diario.length ? diario[diario.length - 1].saldo_acumulado : 0

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="Total Repro" value={total?.total_repro.toLocaleString('es-CL')} />
        <KpiCard label="Causas con Repro" value={total?.cantidad_causas.toLocaleString('es-CL')} />
        <KpiCard label="Saldo Acumulado al Día" value={saldoAlDia.toLocaleString('es-CL')} />
      </div>

      <BarChartHorizontal data={detalle.map((r) => ({ label: r.clasificacion, value: r.total_repro }))} />

      <p className="panel-section-title">Evolución diaria</p>
      <div className="chart-row">
        <BarChartVertical data={diario} xKey="fecha_repro" yKey="saldo_dia" color="#C55A11" />
        <LineChartFilled data={diario} xKey="fecha_repro" yKey="saldo_acumulado" color="#C55A11" />
      </div>

      <table className="panel-table">
        <thead>
          <tr>
            <th>Clasificación</th>
            <th>Causas</th>
            <th>% Distribución</th>
            <th>Total Repro</th>
            <th>Ticket Recupero</th>
          </tr>
        </thead>
        <tbody>
          {resumen.map((row) => (
            <tr key={row.clasificacion} className={row.clasificacion === 'TOTAL GENERAL' ? 'fila-total' : ''}>
              <td>{row.clasificacion}</td>
              <td>{row.cantidad_causas.toLocaleString('es-CL')}</td>
              <td>{row.pct_distribucion}%</td>
              <td>{row.total_repro.toLocaleString('es-CL')}</td>
              <td>{row.ticket_recupero.toLocaleString('es-CL')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
