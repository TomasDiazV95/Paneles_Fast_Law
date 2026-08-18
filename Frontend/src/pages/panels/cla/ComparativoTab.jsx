import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import ComparativoBloque from './ComparativoBloque'

export default function ComparativoTab({ periodo }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    apiFetch(`/panel/cla/comparativo?periodo=${periodo}`).then(setData).catch((err) => setError(err.message))
  }, [periodo])

  if (error) return <p className="login-error">{error}</p>
  if (!data) return <p>Cargando...</p>

  return (
    <>
      <ComparativoBloque titulo="Pagos" filas={data.pagos} />
      <ComparativoBloque titulo="Reprogramaciones" filas={data.repros} />
    </>
  )
}
