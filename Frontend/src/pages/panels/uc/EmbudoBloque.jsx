import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'

export default function EmbudoBloque({ periodo, cartera }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    setError('')
    apiFetch(`/panel/uc/embudo?periodo=${periodo}&cartera=${cartera}`)
      .then(setRows)
      .catch((err) => setError(err.message))
  }, [periodo, cartera])

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>
  if (!rows.length) return <p>Sin datos para este período.</p>

  return (
    <BarChartHorizontal
      data={rows.map((r) => ({ label: r.etapa, value: r.cuentas }))}
      height={240}
      title="Embudo de gestión — del asignado al compromiso cumplido"
    />
  )
}
