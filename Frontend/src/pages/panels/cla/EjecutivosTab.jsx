import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'

export default function EjecutivosTab({ periodo }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    apiFetch(`/panel/cla/ejecutivos?periodo=${periodo}`).then(setRows).catch((err) => setError(err.message))
  }, [periodo])

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>

  const totalGestiones = rows.reduce((sum, r) => sum + r.cantidad_gestiones, 0)
  const totalMontoPagos = rows.reduce((sum, r) => sum + r.monto_pagos, 0)
  const totalMontoRepros = rows.reduce((sum, r) => sum + r.monto_repros, 0)

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="N° Ejecutivos" value={rows.length} />
        <KpiCard label="Total Gestiones" value={totalGestiones.toLocaleString('es-CL')} />
        <KpiCard label="Total Monto Pagos" value={totalMontoPagos.toLocaleString('es-CL')} />
        <KpiCard label="Total Monto Repros" value={totalMontoRepros.toLocaleString('es-CL')} />
      </div>

      <div className="chart-row">
        <BarChartHorizontal data={rows.map((r) => ({ label: r.codigo_usuario, value: r.monto_pagos }))} />
        <BarChartHorizontal data={rows.map((r) => ({ label: r.codigo_usuario, value: r.monto_repros }))} />
      </div>

      <table className="panel-table">
        <thead>
          <tr>
            <th>Ejecutivo</th>
            <th>Gestiones</th>
            <th>Contactos</th>
            <th>Ruts Pagos</th>
            <th>Monto Pagos</th>
            <th>Ruts Repros</th>
            <th>Monto Repros</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.codigo_usuario}>
              <td>{row.codigo_usuario}</td>
              <td>{row.cantidad_gestiones.toLocaleString('es-CL')}</td>
              <td>{row.cantidad_contactos.toLocaleString('es-CL')}</td>
              <td>{row.cantidad_rut_pagos.toLocaleString('es-CL')}</td>
              <td>{row.monto_pagos.toLocaleString('es-CL')}</td>
              <td>{row.cantidad_rut_repros.toLocaleString('es-CL')}</td>
              <td>{row.monto_repros.toLocaleString('es-CL')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
