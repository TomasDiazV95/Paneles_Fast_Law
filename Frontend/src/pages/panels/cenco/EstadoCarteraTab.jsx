import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import DonutChart from '../../../components/charts/DonutChart'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'
import FolderIcon from '@mui/icons-material/Folder'
import PaymentsIcon from '@mui/icons-material/Payments'
import CategoryIcon from '@mui/icons-material/Category'

export default function EstadoCarteraTab({ periodo, cartera }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    apiFetch(`/panel/cenco/estado-cartera?periodo=${periodo}&cartera=${cartera}`)
      .then(setRows)
      .catch((err) => setError(err.message))
  }, [periodo, cartera])

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>

  const totalCausas = rows.reduce((sum, r) => sum + r.cantidad_causas, 0)
  const totalCuantia = rows.reduce((sum, r) => sum + r.cuantia_total, 0)

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="Total Causas" value={totalCausas.toLocaleString('es-CL')} icon={<FolderIcon />} highlight />
        <KpiCard label="Cuantía Total" value={totalCuantia.toLocaleString('es-CL')} icon={<PaymentsIcon />} />
        <KpiCard label="N° Clasificaciones" value={rows.length} icon={<CategoryIcon />} />
      </div>

      <div className="chart-row">
        <BarChartHorizontal data={rows.map((r) => ({ label: r.clasificacion, value: r.cantidad_causas }))} />
        <DonutChart data={rows.map((r) => ({ label: r.clasificacion, value: r.cantidad_causas }))} />
      </div>

      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Clasificación</th>
              <th className="num">Causas</th>
              <th className="num">Cuantía total</th>
              <th className="num">Ticket promedio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.clasificacion}>
                <td>{row.clasificacion}</td>
                <td className="num">{row.cantidad_causas.toLocaleString('es-CL')}</td>
                <td className="num">{row.cuantia_total.toLocaleString('es-CL')}</td>
                <td className="num">{row.ticket_promedio.toLocaleString('es-CL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
