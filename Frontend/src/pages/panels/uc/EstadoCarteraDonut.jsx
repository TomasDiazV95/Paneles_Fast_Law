import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import DonutChart from '../../../components/charts/DonutChart'
import { BUCKET_META } from './bucketMeta'

export default function EstadoCarteraDonut({ periodo, cartera, onFiltro }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    setError('')
    apiFetch(`/panel/uc/estado-cartera?periodo=${periodo}&cartera=${cartera}`)
      .then(setRows)
      .catch((err) => setError(err.message))
  }, [periodo, cartera])

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>

  const conDatos = rows.filter((r) => r.cuentas > 0)
  if (!conDatos.length) return <p>Sin datos para este período.</p>

  return (
    // Se envuelve todo en un único div para que .chart-row lo trate como un
    // solo ítem flex (si Donut y la leyenda fueran hermanos sueltos,
    // ocuparían dos columnas independientes en la fila de gráficos).
    <div className={onFiltro ? 'chart-card-legend' : undefined}>
      <DonutChart
        height={240}
        data={conDatos.map((r) => ({ label: r.etiqueta, value: r.cuentas, color: BUCKET_META[r.bucket]?.color }))}
        title="Estado de la cartera — resultado de gestión"
      />
      {onFiltro && (
        <div className="legend">
          {conDatos.map((r) => (
            <span key={r.bucket} onClick={() => onFiltro('bucket', r.bucket)}>
              <i style={{ background: BUCKET_META[r.bucket]?.color ?? 'var(--accent)' }} />
              {r.etiqueta} ({r.cuentas.toLocaleString('es-CL')})
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
