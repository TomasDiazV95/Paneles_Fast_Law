import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'
import BarChartVertical from '../../../components/charts/BarChartVertical'
import LineChartFilled from '../../../components/charts/LineChartFilled'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PaymentsIcon from '@mui/icons-material/Payments'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'

export default function PagosTab({ periodo }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    apiFetch(`/panel/cla/pagos?periodo=${periodo}`).then(setData).catch((err) => setError(err.message))
  }, [periodo])

  if (error) return <p className="login-error">{error}</p>
  if (!data) return <p>Cargando...</p>

  const { resumen, diario } = data
  const total = resumen.find((r) => r.clasificacion === 'TOTAL GENERAL')
  const detalle = resumen.filter((r) => r.clasificacion !== 'TOTAL GENERAL')
  const acumuladoAlDia = diario.length ? diario[diario.length - 1].monto_acumulado : 0

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="Total Pagos" value={total?.total_pagos.toLocaleString('es-CL')} icon={<PaymentsIcon />} highlight />
        <KpiCard label="Causas con Pago" value={total?.cantidad_causas.toLocaleString('es-CL')} icon={<CheckCircleIcon />} />
        <KpiCard label="Acumulado al Día" value={acumuladoAlDia.toLocaleString('es-CL')} icon={<TrendingUpIcon />} />
      </div>

      <BarChartHorizontal
        title="Total pagos por clasificación"
        data={detalle.map((r) => ({ label: r.clasificacion, value: r.total_pagos }))}
      />

      <p className="panel-section-title">Evolución diaria</p>
      <div className="chart-row">
        <BarChartVertical title="Pago del día" data={diario} xKey="fecha_pago" yKey="monto_dia" />
        <LineChartFilled title="Acumulado del mes" data={diario} xKey="fecha_pago" yKey="monto_acumulado" />
      </div>

      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Clasificación</th>
              <th className="num">Causas</th>
              <th className="num">% Distribución</th>
              <th className="num">Total Pagos</th>
              <th className="num">Ticket Recupero</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((row) => (
              <tr key={row.clasificacion} className={row.clasificacion === 'TOTAL GENERAL' ? 'fila-total' : ''}>
                <td>{row.clasificacion}</td>
                <td className="num">{row.cantidad_causas.toLocaleString('es-CL')}</td>
                <td className="num">{row.pct_distribucion}%</td>
                <td className="num">{row.total_pagos.toLocaleString('es-CL')}</td>
                <td className="num">{row.ticket_recupero.toLocaleString('es-CL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
