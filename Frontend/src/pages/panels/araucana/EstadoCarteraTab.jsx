import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import DonutChart from '../../../components/charts/DonutChart'

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
        <KpiCard label="Total Juicios" value={totalJuicios.toLocaleString('es-CL')} />
        <KpiCard label="Total Deudores" value={totalDeudores.toLocaleString('es-CL')} />
        <KpiCard label="Monto Cuantía" value={totalCuantia.toLocaleString('es-CL')} />
      </div>

      <DonutChart data={rows.map((r) => ({ label: r.clasificacion, value: r.total_juicios }))} />

      <table className="panel-table">
        <thead>
          <tr>
            <th>Clasificación</th>
            <th>Juicios</th>
            <th>Deudores</th>
            <th>Monto cuantía</th>
            <th>% Juicios</th>
            <th>% Cuantía</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.clasificacion}>
              <td>{row.clasificacion}</td>
              <td>{row.total_juicios.toLocaleString('es-CL')}</td>
              <td>{row.total_deudores.toLocaleString('es-CL')}</td>
              <td>{row.monto_cuantia.toLocaleString('es-CL')}</td>
              <td>{row.pct_juicios}%</td>
              <td>{row.pct_cuantia}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
