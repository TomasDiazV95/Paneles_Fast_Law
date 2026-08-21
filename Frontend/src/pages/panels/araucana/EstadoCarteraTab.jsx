import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import DonutChart from '../../../components/charts/DonutChart'
import FolderIcon from '@mui/icons-material/Folder'
import GroupIcon from '@mui/icons-material/Group'
import PaymentsIcon from '@mui/icons-material/Payments'

export default function EstadoCarteraTab({ cartera }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    apiFetch(`/panel/araucana/estado-cartera?cartera=${cartera}`).then(setRows).catch((err) => setError(err.message))
  }, [cartera])

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>

  const totalJuicios = rows.reduce((sum, r) => sum + r.total_juicios, 0)
  const totalDeudores = rows.reduce((sum, r) => sum + r.total_deudores, 0)
  const totalCuantia = rows.reduce((sum, r) => sum + r.monto_cuantia, 0)

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="Total Juicios" value={totalJuicios.toLocaleString('es-CL')} icon={<FolderIcon />} highlight />
        <KpiCard label="Total Deudores" value={totalDeudores.toLocaleString('es-CL')} icon={<GroupIcon />} />
        <KpiCard label="Monto Cuantía" value={totalCuantia.toLocaleString('es-CL')} icon={<PaymentsIcon />} />
      </div>

      <DonutChart data={rows.map((r) => ({ label: r.clasificacion, value: r.total_juicios }))} />

      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Clasificación</th>
              <th className="num">Juicios</th>
              <th className="num">Deudores</th>
              <th className="num">Monto cuantía</th>
              <th className="num">% Juicios</th>
              <th className="num">% Cuantía</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.clasificacion}>
                <td>{row.clasificacion}</td>
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
