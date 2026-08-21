import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import LineChartFilled from '../../../components/charts/LineChartFilled'

const METRICAS = [
  { key: 'cuentas', label: 'Cuentas asignadas' },
  { key: 'deuda', label: 'Deuda asignada' },
  { key: 'gestiones', label: 'Gestiones ejecutadas' },
  { key: 'sin_gestion', label: 'Cuentas sin gestión' },
  { key: 'contactabilidad_pct', label: 'Contactabilidad (%)' },
  { key: 'compromisos', label: 'Compromisos de pago' },
  { key: 'compromisos_rotos', label: 'Compromisos rotos' },
]

export default function EvolucionBloque({ cartera }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [metrica, setMetrica] = useState('gestiones')

  useEffect(() => {
    setRows(null)
    setError('')
    apiFetch(`/panel/uc/evolucion?cartera=${cartera}`)
      .then(setRows)
      .catch((err) => setError(err.message))
  }, [cartera])

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>
  if (!rows.length) return <p>Sin períodos procesados todavía.</p>

  const metricaActual = METRICAS.find((m) => m.key === metrica) ?? METRICAS[0]

  const titulo = (
    <span className="chart-title-row">
      Evolución ({rows.length} período{rows.length === 1 ? '' : 's'})
      <select value={metrica} onChange={(e) => setMetrica(e.target.value)}>
        {METRICAS.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>
    </span>
  )

  if (rows.length < 2) {
    return (
      <div className="chart-box">
        <p className="chart-title">{titulo}</p>
        <p style={{ fontSize: 13, color: 'var(--text)' }}>
          Solo hay {rows.length} período procesado ({rows[0]?.periodo}); se necesitan al menos 2 para graficar una
          evolución. Ejecuta SP_Panel_UC_Proceso para los períodos que falten.
        </p>
      </div>
    )
  }

  return <LineChartFilled data={rows} xKey="periodo" yKey={metricaActual.key} height={240} title={titulo} />
}
