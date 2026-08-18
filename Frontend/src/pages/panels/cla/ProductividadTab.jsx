import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import BarChartHorizontal from '../../../components/charts/BarChartHorizontal'

const CATEGORIAS = ['BUSQUEDA NEGATIVA', 'BUSQUEDA POSITIVA', 'NOTIFICACION', 'EMBARGO', 'OTROS']

function AvanceEtapaCartera({ cartera, filas }) {
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [tipo, setTipo] = useState('cantidad')

  const fila = filas.find((f) => f.categoria === categoria)
  if (!fila) return null

  const campo = (sufijo) => (tipo === 'cantidad' ? `q_${sufijo}` : `saldo_${sufijo}`)
  const data = [
    { label: 'Prom. 3 Meses', value: fila[campo('prom_3meses')] },
    { label: 'Mes Anterior', value: fila[campo('mes_anterior')] },
    { label: 'Mes Actual', value: fila[campo('mes_actual')] },
    { label: 'Proyectado Cierre', value: fila[campo('proyectado_cierre')] },
  ]

  return (
    <div style={{ width: '100%' }}>
      <div className="panel-header" style={{ justifyContent: 'flex-start', gap: 12 }}>
        <strong>{cartera}</strong>
        <label className="panel-selector">
          Categoría
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="panel-selector">
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="cantidad">Cantidad</option>
            <option value="saldo">Saldo</option>
          </select>
        </label>
      </div>
      <BarChartHorizontal data={data} height={200} />
    </div>
  )
}

export default function ProductividadTab({ periodo }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    apiFetch(`/panel/cla/productividad?periodo=${periodo}`).then(setData).catch((err) => setError(err.message))
  }, [periodo])

  if (error) return <p className="login-error">{error}</p>
  if (!data) return <p>Cargando...</p>

  const { general, avance_etapa: avanceEtapa } = data
  const carteras = [...new Set(avanceEtapa.map((f) => f.cartera))]

  return (
    <>
      <p className="panel-section-title">Productividad general</p>
      <table className="panel-table">
        <thead>
          <tr>
            <th>Cartera</th>
            <th>Q Base</th>
            <th>Saldo Insoluto</th>
            <th>Pagos Estudio</th>
            <th>Repros Estudio</th>
            <th>Pagos Inbound</th>
            <th>Total Pagos</th>
            <th>Total Repros</th>
          </tr>
        </thead>
        <tbody>
          {general.map((row) => (
            <tr key={row.cartera} className={row.cartera === 'TOTALES' ? 'fila-total' : ''}>
              <td>{row.cartera}</td>
              <td>{row.cantidad_base.toLocaleString('es-CL')}</td>
              <td>{row.saldo_insoluto.toLocaleString('es-CL')}</td>
              <td>{row.pagos_estudio.toLocaleString('es-CL')}</td>
              <td>{row.repros_estudio.toLocaleString('es-CL')}</td>
              <td>{row.pagos_inbound.toLocaleString('es-CL')}</td>
              <td>{row.total_pagos.toLocaleString('es-CL')}</td>
              <td>{row.total_repros.toLocaleString('es-CL')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="panel-section-title">Avance por etapa</p>
      {carteras.map((cartera) => (
        <AvanceEtapaCartera key={cartera} cartera={cartera} filas={avanceEtapa.filter((f) => f.cartera === cartera)} />
      ))}
    </>
  )
}
