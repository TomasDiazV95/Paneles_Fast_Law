import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../../api/client'
import ComparativoBloque from './ComparativoBloque'

export default function ComparativoTab({ periodo, cartera }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [gestorOrigen, setGestorOrigen] = useState('TODOS')

  useEffect(() => {
    setData(null)
    setGestorOrigen('TODOS')
    apiFetch(`/panel/cenco/comparativo?periodo=${periodo}&cartera=${cartera}`)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [periodo, cartera])

  const gestores = useMemo(() => {
    if (!data) return ['TODOS']
    return [...new Set([...data.pagos, ...data.repros].map((f) => f.gestor_origen))]
  }, [data])

  if (error) return <p className="login-error">{error}</p>
  if (!data) return <p>Cargando...</p>

  const pagosFiltrados = data.pagos.filter((f) => f.gestor_origen === gestorOrigen)
  const reprosFiltrados = data.repros.filter((f) => f.gestor_origen === gestorOrigen)

  return (
    <>
      <label className="panel-selector">
        Gestor Origen
        <select value={gestorOrigen} onChange={(e) => setGestorOrigen(e.target.value)}>
          {gestores.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      <ComparativoBloque titulo="Pagos" filas={pagosFiltrados} />
      <ComparativoBloque titulo="Reprogramaciones" filas={reprosFiltrados} />
    </>
  )
}
