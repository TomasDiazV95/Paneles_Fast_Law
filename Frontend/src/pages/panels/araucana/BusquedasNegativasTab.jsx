import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../../api/client'

function ordenTipo(tipo) {
  const t = tipo.toUpperCase()
  if (t.includes('PRIMERA')) return 0
  if (t.includes('SEGUNDA')) return 1
  if (t.includes('TERCERA')) return 2
  return 99
}

export default function BusquedasNegativasTab({ cartera }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    apiFetch(`/panel/araucana/busquedas-negativas?cartera=${cartera}`).then(setRows).catch((err) => setError(err.message))
  }, [cartera])

  const { columnas, filas } = useMemo(() => {
    if (!rows) return { columnas: [], filas: [] }
    const columnas = [...new Set(rows.map((r) => r.q_busquedas))].sort((a, b) => a - b)
    const tipos = [...new Set(rows.map((r) => r.ultimo_tipo_busqueda))].sort(
      (a, b) => ordenTipo(a) - ordenTipo(b) || a.localeCompare(b),
    )
    const filas = tipos.map((tipo) => {
      const celdas = columnas.map((q) => {
        const fila = rows.find((r) => r.ultimo_tipo_busqueda === tipo && r.q_busquedas === q)
        return fila?.total_juicios ?? 0
      })
      return { tipo, celdas, total: celdas.reduce((s, v) => s + v, 0) }
    })
    return { columnas, filas }
  }, [rows])

  if (error) return <p className="login-error">{error}</p>
  if (!rows) return <p>Cargando...</p>
  if (rows.length === 0) return <p>Sin datos de búsquedas negativas para este período.</p>

  const totalesPorColumna = columnas.map((_, i) => filas.reduce((s, f) => s + f.celdas[i], 0))

  return (
    <>
      <p className="panel-section-title">Solo causas no notificadas</p>
      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Último tipo de búsqueda</th>
              {columnas.map((q) => (
                <th key={q} className="num">{q}</th>
              ))}
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.tipo}>
                <td>{f.tipo}</td>
                {f.celdas.map((v, i) => (
                  <td key={i} className="num">{v.toLocaleString('es-CL')}</td>
                ))}
                <td className="num">{f.total.toLocaleString('es-CL')}</td>
              </tr>
            ))}
            <tr className="fila-total">
              <td>Total</td>
              {totalesPorColumna.map((v, i) => (
                <td key={i} className="num">{v.toLocaleString('es-CL')}</td>
              ))}
              <td className="num">{totalesPorColumna.reduce((s, v) => s + v, 0).toLocaleString('es-CL')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
