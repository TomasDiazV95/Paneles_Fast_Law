import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import DonutChart from '../../../components/charts/DonutChart'
import GavelIcon from '@mui/icons-material/Gavel'
import GroupIcon from '@mui/icons-material/Group'
import PaymentsIcon from '@mui/icons-material/Payments'

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
        <KpiCard label="Total Juicios" value={total?.total_juicios.toLocaleString('es-CL')} icon={<GavelIcon />} highlight />
        <KpiCard label="Total Deudores" value={total?.total_deudores.toLocaleString('es-CL')} icon={<GroupIcon />} />
        <KpiCard label="Monto Cuantía" value={total?.monto_cuantia.toLocaleString('es-CL')} icon={<PaymentsIcon />} />
      </div>

      <div className="chart-row">
        <DonutChart data={detalle.map((r) => ({ label: r.clasificacion_etapas, value: r.total_juicios }))} />
      </div>

      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Clasificación por etapa</th>
              <th className="num">Juicios</th>
              <th className="num">Deudores</th>
              <th className="num">Monto cuantía</th>
              <th className="num">% Juicios</th>
              <th className="num">% Cuantía</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.clasificacion_etapas} className={row.clasificacion_etapas === 'TOTAL' ? 'fila-total' : ''}>
                <td>{row.clasificacion_etapas}</td>
                <td className="num">{row.total_juicios.toLocaleString('es-CL')}</td>
                <td className="num">{row.total_deudores.toLocaleString('es-CL')}</td>
                <td className="num">{row.monto_cuantia.toLocaleString('es-CL')}</td>
                <td className="num">{row.pct_juicios}%</td>
                <td className="num">{row.pct_cuantia}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
