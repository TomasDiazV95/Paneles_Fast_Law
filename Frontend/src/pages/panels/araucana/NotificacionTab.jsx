import { Fragment, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../../api/client'

const MESES = Array.from({ length: 12 }, (_, i) => i + 1)
const COLUMNAS = [...MESES, 13]
const ETIQUETA_COLUMNA = (mes) => (mes === 13 ? '+12' : `${mes} mes${mes > 1 ? 'es' : ''}`)

export default function NotificacionTab({ cartera }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState(() => new Set())

  useEffect(() => {
    setRows(null)
    setExpandido(new Set())
    apiFetch(`/panel/araucana/notificacion?cartera=${cartera}`).then(setRows).catch((err) => setError(err.message))
  }, [cartera])

  const grupos = useMemo(() => {
    if (!rows) return []
    const tipos = [...new Set(rows.map((r) => r.tipo_notificacion))]
    return tipos.map((tipo) => {
      const filasTipo = rows.filter((r) => r.tipo_notificacion === tipo)
      const clasificaciones = [...new Set(filasTipo.map((r) => r.clasificacion_actual))]
      const detalle = clasificaciones.map((clasificacion) => {
        const celdas = COLUMNAS.map((mes) => {
          const fila = filasTipo.find((r) => r.clasificacion_actual === clasificacion && r.meses_desde_notif === mes)
          return fila?.total_juicios ?? 0
        })
        return { clasificacion, celdas, total: celdas.reduce((s, v) => s + v, 0) }
      })
      const totalesPorColumna = COLUMNAS.map((_, i) => detalle.reduce((s, d) => s + d.celdas[i], 0))
      return {
        tipo,
        detalle,
        totalesPorColumna,
        total: totalesPorColumna.reduce((s, v) => s + v, 0),
      }
    })
  }, [rows])

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>
  if (rows.length === 0) return <p>Sin datos de notificación para este período.</p>

  function toggle(tipo) {
    setExpandido((prev) => {
      const next = new Set(prev)
      if (next.has(tipo)) next.delete(tipo)
      else next.add(tipo)
      return next
    })
  }

  return (
    <div className="panel-table-wrapper">
      <table className="panel-table">
        <thead>
          <tr>
            <th>Tipo notificación / Clasificación</th>
            {COLUMNAS.map((mes) => (
              <th key={mes} className="num">{ETIQUETA_COLUMNA(mes)}</th>
            ))}
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <Fragment key={grupo.tipo}>
              <tr className="fila-total" style={{ cursor: 'pointer' }} onClick={() => toggle(grupo.tipo)}>
                <td>{expandido.has(grupo.tipo) ? '▼' : '▶'} {grupo.tipo}</td>
                {grupo.totalesPorColumna.map((v, i) => (
                  <td key={i} className="num">{v.toLocaleString('es-CL')}</td>
                ))}
                <td className="num">{grupo.total.toLocaleString('es-CL')}</td>
              </tr>
              {expandido.has(grupo.tipo) &&
                grupo.detalle.map((d) => (
                  <tr key={`${grupo.tipo}-${d.clasificacion}`}>
                    <td style={{ paddingLeft: 28 }}>{d.clasificacion}</td>
                    {d.celdas.map((v, i) => (
                      <td key={i} className="num">{v.toLocaleString('es-CL')}</td>
                    ))}
                    <td className="num">{d.total.toLocaleString('es-CL')}</td>
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
