import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'
import GroupIcon from '@mui/icons-material/Group'
import PhoneIcon from '@mui/icons-material/Phone'
import PaymentsIcon from '@mui/icons-material/Payments'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'

export default function EjecutivosTab({ periodo, cartera }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    apiFetch(`/panel/cenco/ejecutivos?periodo=${periodo}&cartera=${cartera}`)
      .then(setRows)
      .catch((err) => setError(err.message))
  }, [periodo, cartera])

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>

  const totalContactos = rows.reduce((sum, r) => sum + r.cantidad_contactos, 0)
  const totalMontoPagos = rows.reduce((sum, r) => sum + r.monto_pagos, 0)
  const totalMontoRepros = rows.reduce((sum, r) => sum + r.monto_repros, 0)

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="N° Ejecutivos" value={rows.length} icon={<GroupIcon />} />
        <KpiCard label="Total Contactos" value={totalContactos.toLocaleString('es-CL')} icon={<PhoneIcon />} highlight />
        <KpiCard label="Total Pagos" value={totalMontoPagos.toLocaleString('es-CL')} icon={<PaymentsIcon />} />
        <KpiCard label="Total Repros" value={totalMontoRepros.toLocaleString('es-CL')} icon={<EventRepeatIcon />} />
      </div>

      <div className="chart-row">
        <BarChartHorizontal data={rows.map((r) => ({ label: r.codigo_usuario, value: r.monto_pagos }))} />
        <BarChartHorizontal data={rows.map((r) => ({ label: r.codigo_usuario, value: r.monto_repros }))} />
      </div>

      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Ejecutivo</th>
              <th className="num">Contactos</th>
              <th className="num">Q Pagos</th>
              <th className="num">Monto Pagos</th>
              <th className="num">Q Repros</th>
              <th className="num">Monto Repros</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.codigo_usuario}>
                <td>{row.codigo_usuario}</td>
                <td className="num">{row.cantidad_contactos.toLocaleString('es-CL')}</td>
                <td className="num">{row.cantidad_pagos.toLocaleString('es-CL')}</td>
                <td className="num">{row.monto_pagos.toLocaleString('es-CL')}</td>
                <td className="num">{row.cantidad_repros.toLocaleString('es-CL')}</td>
                <td className="num">{row.monto_repros.toLocaleString('es-CL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
