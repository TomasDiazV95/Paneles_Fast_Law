import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'
import GroupIcon from '@mui/icons-material/Group'
import PaymentsIcon from '@mui/icons-material/Payments'
import PhoneIcon from '@mui/icons-material/Phone'

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
        <KpiCard label="N° Ejecutivos" value={rows.length} icon={<GroupIcon />} />
        <KpiCard label="Total Gestiones" value={totalGestiones.toLocaleString('es-CL')} icon={<PhoneIcon />} highlight />
        <KpiCard label="Total Monto Pagos" value={totalMontoPagos.toLocaleString('es-CL')} icon={<PaymentsIcon />} />
        <KpiCard label="Total Monto Repros" value={totalMontoRepros.toLocaleString('es-CL')} icon={<EventRepeatIcon />} />
      </div>

      <div className="chart-row">
        <BarChartHorizontal
          title="Monto pagos por ejecutivo"
          data={rows.map((r) => ({ label: r.codigo_usuario, value: r.monto_pagos }))}
        />
        <BarChartHorizontal
          title="Monto repros por ejecutivo"
          data={rows.map((r) => ({ label: r.codigo_usuario, value: r.monto_repros }))}
        />
      </div>

      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Ejecutivo</th>
              <th className="num">Gestiones</th>
              <th className="num">Contactos</th>
              <th className="num">Ruts Pagos</th>
              <th className="num">Monto Pagos</th>
              <th className="num">Ruts Repros</th>
              <th className="num">Monto Repros</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.codigo_usuario}>
                <td>{row.codigo_usuario}</td>
                <td className="num">{row.cantidad_gestiones.toLocaleString('es-CL')}</td>
                <td className="num">{row.cantidad_contactos.toLocaleString('es-CL')}</td>
                <td className="num">{row.cantidad_rut_pagos.toLocaleString('es-CL')}</td>
                <td className="num">{row.monto_pagos.toLocaleString('es-CL')}</td>
                <td className="num">{row.cantidad_rut_repros.toLocaleString('es-CL')}</td>
                <td className="num">{row.monto_repros.toLocaleString('es-CL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
