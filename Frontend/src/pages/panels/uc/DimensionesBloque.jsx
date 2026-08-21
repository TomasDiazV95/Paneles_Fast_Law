import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'
import { esEjecutivoSistema, formatEjecutivo } from './bucketMeta'

const PANELES = [
  { key: 'ejecutivo', titulo: 'Ejecutivo — top por cuentas', filtro: 'ejecutivo' },
  { key: 'tipificacion', titulo: 'Tipificación — top por cuentas', filtro: 'tipificacion' },
  { key: 'estado_convenio', titulo: 'Estado de convenio — top por cuentas', filtro: 'estado_convenio' },
  { key: 'prioridad', titulo: 'Prioridad (código crudo) — top por cuentas', filtro: null },
  { key: 'intensidad', titulo: 'Intensidad (gestiones por cuenta) — rango', filtro: null },
  // El filtro por bucket ya se puede aplicar desde la dona "Estado de la
  // cartera" (que usa el código interno, no la etiqueta legible de aquí).
  { key: 'bucket', titulo: 'Estado de gestión — top por cuentas', filtro: null },
]

export default function DimensionesBloque({ periodo, cartera, onFiltro }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    setError('')
    apiFetch(`/panel/uc/dimensiones?periodo=${periodo}&cartera=${cartera}`)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [periodo, cartera])

  if (error) return <p className="login-error">{error}</p>
  if (!data) return <p>Cargando dimensiones...</p>

  return (
    <>
      <div className="chart-row">
        {PANELES.slice(0, 3).map((p) => (
          <PanelDimension key={p.key} config={p} filas={data[p.key]} onFiltro={onFiltro} />
        ))}
      </div>
      <div className="chart-row" style={{ marginTop: 4 }}>
        {PANELES.slice(3, 6).map((p) => (
          <PanelDimension key={p.key} config={p} filas={data[p.key]} onFiltro={onFiltro} />
        ))}
      </div>
    </>
  )
}

function PanelDimension({ config, filas, onFiltro }) {
  const top = (filas ?? []).slice(0, 8)
  // El ejecutivo 'SYSTEM' corresponde a gestiones automáticas del discador,
  // no a una persona: se etiqueta distinto para no confundirlo con el resto
  // del equipo (el valor real enviado al filtro no cambia).
  const etiqueta = (valor) => (config.key === 'ejecutivo' ? formatEjecutivo(valor) : valor)

  if (!top.length) {
    return (
      <div className="chart-box">
        <p className="chart-title">{config.titulo}</p>
        <p style={{ fontSize: 13, color: 'var(--text)' }}>Sin datos.</p>
      </div>
    )
  }

  const tieneLeyenda = Boolean(config.filtro && onFiltro)

  return (
    <div className={tieneLeyenda ? 'chart-card-legend' : undefined}>
      <BarChartHorizontal
        data={top.map((r) => ({ label: etiqueta(r.valor), value: r.cuentas }))}
        height={230}
        title={config.titulo}
      />
      {tieneLeyenda && (
        <div className="legend">
          {top.map((r) => (
            <span
              key={r.valor}
              className={config.key === 'ejecutivo' && esEjecutivoSistema(r.valor) ? 'is-system' : undefined}
              onClick={() => onFiltro(config.filtro, r.valor)}
            >
              {etiqueta(r.valor)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
