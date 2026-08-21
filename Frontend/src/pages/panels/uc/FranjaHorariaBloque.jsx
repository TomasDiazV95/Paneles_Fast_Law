import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS } from '../../../components/charts/colors'

export default function FranjaHorariaBloque({ periodo, cartera }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    setError('')
    apiFetch(`/panel/uc/franja-horaria?periodo=${periodo}&cartera=${cartera}`)
      .then(setRows)
      .catch((err) => setError(err.message))
  }, [periodo, cartera])

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>
  if (!rows.length) return <p>Sin datos horarios para este período.</p>

  const data = rows.map((r) => ({ ...r, horaLabel: `${String(r.hora).padStart(2, '0')}h` }))

  return (
    <div className="chart-box">
      <p className="chart-title">Franja horaria — última gestión efectuada</p>
      <div style={{ height: 230 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, left: 4, right: 12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="horaLabel" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip formatter={(value, name) => [value.toLocaleString('es-CL'), name === 'Gestiones' ? 'Gestiones' : 'Contactos']} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="gestiones" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={30} name="Gestiones" />
            <Bar dataKey="contactos" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} maxBarSize={30} name="Contactos" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
