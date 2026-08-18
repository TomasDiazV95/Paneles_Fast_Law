import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import DonutChart from '../../../components/charts/DonutChart'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'
import FolderIcon from '@mui/icons-material/Folder'
import PaymentsIcon from '@mui/icons-material/Payments'
import ReceiptIcon from '@mui/icons-material/Receipt'

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
        <KpiCard
          label="Total Causas"
          value={total?.cantidad_causas.toLocaleString('es-CL')}
          icon={<FolderIcon />}
          highlight
        />
        <KpiCard label="Cuantía Total" value={total?.cuantia_total.toLocaleString('es-CL')} icon={<PaymentsIcon />} />
        <KpiCard label="Ticket Promedio" value={total?.ticket_promedio.toLocaleString('es-CL')} icon={<ReceiptIcon />} />
      </div>

      <div className="chart-row">
        <BarChartHorizontal
          title="Causas por clasificación"
          data={detalle.map((r) => ({ label: r.clasificacion, value: r.cantidad_causas }))}
        />
        <DonutChart
          title="Distribución de causas"
          data={detalle.map((r) => ({ label: r.clasificacion, value: r.cantidad_causas }))}
        />
      </div>

      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Clasificación</th>
              <th className="num">Causas</th>
              <th className="num">Cuantía total</th>
              <th className="num">Ticket promedio</th>
              <th className="num">% Distribución</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.clasificacion} className={row.clasificacion === 'TOTAL GENERAL' ? 'fila-total' : ''}>
                <td>{row.clasificacion}</td>
                <td className="num">{row.cantidad_causas.toLocaleString('es-CL')}</td>
                <td className="num">{row.cuantia_total.toLocaleString('es-CL')}</td>
                <td className="num">{row.ticket_promedio.toLocaleString('es-CL')}</td>
                <td className="num">{row.pct_distribucion}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
