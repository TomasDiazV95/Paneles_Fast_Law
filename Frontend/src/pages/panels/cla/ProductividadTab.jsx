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
      <div className="panel-toolbar" style={{ marginBottom: 10 }}>
        <div className="panel-toolbar-filters">
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
      </div>
      <BarChartHorizontal title={`Avance ${cartera} — ${categoria}`} data={data} height={200} />
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
      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Cartera</th>
              <th className="num">Q Base</th>
              <th className="num">Saldo Insoluto</th>
              <th className="num">Pagos Estudio</th>
              <th className="num">Repros Estudio</th>
              <th className="num">Pagos Inbound</th>
              <th className="num">Total Pagos</th>
              <th className="num">Total Repros</th>
            </tr>
          </thead>
          <tbody>
            {general.map((row) => (
              <tr key={row.cartera} className={row.cartera === 'TOTALES' ? 'fila-total' : ''}>
                <td>{row.cartera}</td>
                <td className="num">{row.cantidad_base.toLocaleString('es-CL')}</td>
                <td className="num">{row.saldo_insoluto.toLocaleString('es-CL')}</td>
                <td className="num">{row.pagos_estudio.toLocaleString('es-CL')}</td>
                <td className="num">{row.repros_estudio.toLocaleString('es-CL')}</td>
                <td className="num">{row.pagos_inbound.toLocaleString('es-CL')}</td>
                <td className="num">{row.total_pagos.toLocaleString('es-CL')}</td>
                <td className="num">{row.total_repros.toLocaleString('es-CL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="panel-section-title">Avance por etapa</p>
      {carteras.map((cartera) => (
        <AvanceEtapaCartera key={cartera} cartera={cartera} filas={avanceEtapa.filter((f) => f.cartera === cartera)} />
      ))}
    </>
  )
}
