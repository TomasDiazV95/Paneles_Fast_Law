import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import LineChartFilled from '../../../components/charts/LineChartFilled'

const METRICAS = [
  { key: 'stock', label: 'Stock', color: '#4A9EE8' },
  { key: 'flujo_asignacion', label: 'Flujo Mensual (asignación)', color: '#1F4E79' },
  { key: 'reingresos', label: 'Reingresos', color: '#375623' },
  { key: 'apercibimiento', label: 'Apercibimiento', color: '#E8A44A' },
  { key: 'retira_demanda', label: 'Retira Demanda', color: '#E74C3C' },
  { key: 'mandamiento', label: 'Mandamiento', color: '#C55A11' },
]

function fmt(n) {
  if (n === null || n === undefined) return '0'
  return Number(n).toLocaleString('es-CL')
}

export default function MovimientoDiarioBloque({ idProducto, mes, anio }) {
  const [dias, setDias] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setDias(null)
    setError('')
    apiFetch(`/panel/crci/movimiento-diario?id_producto=${idProducto}&mes=${mes}&anio=${anio}`)
      .then((data) => setDias(data.dias))
      .catch((err) => setError(err.message))
  }, [idProducto, mes, anio])

  if (error) return <p className="login-error">{error}</p>
  if (!dias) return <p>Cargando movimiento diario...</p>
  if (dias.length === 0) return <p>Sin datos de movimiento para este producto y período.</p>

  return (
    <>
      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Iteración</th>
              <th className="num">Total</th>
              {METRICAS.map((m) => (
                <th key={m.key} className="num">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => (
              <tr key={d.fecha_proceso}>
                <td>{d.dia}</td>
                <td>{d.fecha_proceso}</td>
                <td className="num">{fmt(d.total)}</td>
                {METRICAS.map((m) => (
                  <td key={m.key} className="num">
                    {fmt(d[m.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="chart-row">
        {METRICAS.map((m) => (
          <LineChartFilled
            key={m.key}
            data={dias}
            xKey="dia"
            yKey={m.key}
            color={m.color}
            title={m.label}
            formato="count"
            height={180}
          />
        ))}
      </div>
    </>
  )
}
