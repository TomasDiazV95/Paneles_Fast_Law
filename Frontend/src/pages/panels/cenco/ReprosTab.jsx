import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'
import BarChartVertical from '../../../components/charts/BarChartVertical'
import LineChartFilled from '../../../components/charts/LineChartFilled'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'

export default function ReprosTab({ periodo, cartera }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    apiFetch(`/panel/cenco/repros?periodo=${periodo}&cartera=${cartera}`)
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
        <KpiCard label="Total Repros" value={total?.monto_total.toLocaleString('es-CL')} icon={<EventRepeatIcon />} highlight />
        <KpiCard label="Q Documentos" value={total?.cantidad_documentos.toLocaleString('es-CL')} icon={<CheckCircleIcon />} />
        <KpiCard label="Acumulado al Día" value={acumuladoAlDia.toLocaleString('es-CL')} icon={<AccountBalanceWalletIcon />} />
      </div>

      <BarChartHorizontal data={detalle.map((r) => ({ label: r.clasificacion, value: r.monto_total }))} />

      <p className="panel-section-title">Evolución diaria</p>
      <div className="chart-row">
        <BarChartVertical data={diario} xKey="fecha" yKey="monto_dia" color="#C55A11" />
        <LineChartFilled data={diario} xKey="fecha" yKey="monto_acumulado" color="#C55A11" />
      </div>

      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Clasificación</th>
              <th className="num">Q Documentos</th>
              <th className="num">Monto Total</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((row) => (
              <tr key={row.clasificacion} className={row.clasificacion === 'TOTAL' ? 'fila-total' : ''}>
                <td>{row.clasificacion}</td>
                <td className="num">{row.cantidad_documentos.toLocaleString('es-CL')}</td>
                <td className="num">{row.monto_total.toLocaleString('es-CL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
