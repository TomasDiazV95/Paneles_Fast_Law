import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'
import BarChartVertical from '../../../components/charts/BarChartVertical'
import LineChartFilled from '../../../components/charts/LineChartFilled'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'

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
        <KpiCard label="Total Repro" value={total?.total_repro.toLocaleString('es-CL')} icon={<EventRepeatIcon />} highlight />
        <KpiCard label="Causas con Repro" value={total?.cantidad_causas.toLocaleString('es-CL')} icon={<CheckCircleIcon />} />
        <KpiCard label="Saldo Acumulado al Día" value={saldoAlDia.toLocaleString('es-CL')} icon={<AccountBalanceWalletIcon />} />
      </div>

      <div className="chart-row">
        <BarChartHorizontal
          title="Total repro por clasificación"
          data={detalle.map((r) => ({ label: r.clasificacion, value: r.total_repro }))}
        />
      </div>

      <p className="panel-section-title">Evolución diaria</p>
      <div className="chart-row">
        <BarChartVertical title="Repro del día" data={diario} xKey="fecha_repro" yKey="saldo_dia" color="#C55A11" />
        <LineChartFilled title="Saldo acumulado del mes" data={diario} xKey="fecha_repro" yKey="saldo_acumulado" color="#C55A11" />
      </div>

      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Clasificación</th>
              <th className="num">Causas</th>
              <th className="num">% Distribución</th>
              <th className="num">Total Repro</th>
              <th className="num">Ticket Recupero</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((row) => (
              <tr key={row.clasificacion} className={row.clasificacion === 'TOTAL GENERAL' ? 'fila-total' : ''}>
                <td>{row.clasificacion}</td>
                <td className="num">{row.cantidad_causas.toLocaleString('es-CL')}</td>
                <td className="num">{row.pct_distribucion}%</td>
                <td className="num">{row.total_repro.toLocaleString('es-CL')}</td>
                <td className="num">{row.ticket_recupero.toLocaleString('es-CL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
