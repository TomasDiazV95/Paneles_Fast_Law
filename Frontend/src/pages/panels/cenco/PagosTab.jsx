import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'
import BarChartVertical from '../../../components/charts/BarChartVertical'
import LineChartFilled from '../../../components/charts/LineChartFilled'

export default function PagosTab({ periodo, cartera }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    apiFetch(`/panel/cenco/pagos?periodo=${periodo}&cartera=${cartera}`)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [periodo, cartera])

  if (error) return <p className="login-error">{error}</p>
  if (!data) return <p>Cargando...</p>

  const { resumen, diario } = data
  const total = resumen.find((r) => r.clasificacion === 'TOTAL')
  const detalle = resumen.filter((r) => r.clasificacion !== 'TOTAL')
  const acumuladoAlDia = diario.length ? diario[diario.length - 1].monto_acumulado : 0

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="Total Pagos" value={total?.monto_total.toLocaleString('es-CL')} />
        <KpiCard label="Q Documentos" value={total?.cantidad_documentos.toLocaleString('es-CL')} />
        <KpiCard label="Acumulado al Día" value={acumuladoAlDia.toLocaleString('es-CL')} />
      </div>

      <BarChartHorizontal data={detalle.map((r) => ({ label: r.clasificacion, value: r.monto_total }))} />

      <p className="panel-section-title">Evolución diaria</p>
      <div className="chart-row">
        <BarChartVertical data={diario} xKey="fecha" yKey="monto_dia" />
        <LineChartFilled data={diario} xKey="fecha" yKey="monto_acumulado" />
      </div>

      <table className="panel-table">
        <thead>
          <tr>
            <th>Clasificación</th>
            <th>Q Documentos</th>
            <th>Monto Total</th>
          </tr>
        </thead>
        <tbody>
          {resumen.map((row) => (
            <tr key={row.clasificacion} className={row.clasificacion === 'TOTAL' ? 'fila-total' : ''}>
              <td>{row.clasificacion}</td>
              <td>{row.cantidad_documentos.toLocaleString('es-CL')}</td>
              <td>{row.monto_total.toLocaleString('es-CL')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
