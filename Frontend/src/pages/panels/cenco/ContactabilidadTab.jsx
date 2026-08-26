import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import DonutChart from '../../../components/charts/DonutChart'
import GroupIcon from '@mui/icons-material/Group'
import PhoneIcon from '@mui/icons-material/Phone'
import PhoneDisabledIcon from '@mui/icons-material/PhoneDisabled'

export default function ContactabilidadTab({ periodo, cartera }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    apiFetch(`/panel/cenco/contactabilidad?periodo=${periodo}&cartera=${cartera}`)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [periodo, cartera])

  if (error) return <p className="login-error">{error}</p>
  if (!data) return <p>Cargando...</p>

  const { matriz, resumen } = data
  const clasificaciones = [...new Set(matriz.map((r) => r.clasificacion))]
  const tiposContacto = [...new Set(matriz.map((r) => r.tipo_contacto))]

  const totalPorTipo = tiposContacto.map((tipo) => ({
    label: tipo,
    value: matriz.filter((r) => r.tipo_contacto === tipo).reduce((sum, r) => sum + r.cantidad_deudores, 0),
  }))

  const resumenFila = resumen[0]
  const pctContactoTitular = resumenFila?.total_deudores
    ? ((resumenFila.con_contacto / resumenFila.total_deudores) * 100).toFixed(1)
    : '0'
  const pctSinGestion = resumenFila?.total_deudores
    ? ((resumenFila.sin_gestion / resumenFila.total_deudores) * 100).toFixed(1)
    : '0'

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="Total Deudores" value={resumenFila?.total_deudores.toLocaleString('es-CL')} icon={<GroupIcon />} highlight />
        <KpiCard label="Contacto Titular" value={`${resumenFila?.con_contacto.toLocaleString('es-CL')} (${pctContactoTitular}%)`} icon={<PhoneIcon />} />
        <KpiCard label="Sin Gestión" value={`${resumenFila?.sin_gestion.toLocaleString('es-CL')} (${pctSinGestion}%)`} icon={<PhoneDisabledIcon />} />
      </div>

      <div className="chart-row">
        <DonutChart data={totalPorTipo} />
      </div>

      <div className="panel-table-wrapper">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Clasificación</th>
              {tiposContacto.map((tipo) => (
                <th key={tipo} className="num">{tipo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clasificaciones.map((clasificacion) => (
              <tr key={clasificacion}>
                <td>{clasificacion}</td>
                {tiposContacto.map((tipo) => {
                  const celda = matriz.find((r) => r.clasificacion === clasificacion && r.tipo_contacto === tipo)
                  return <td key={tipo} className="num">{celda ? celda.cantidad_deudores.toLocaleString('es-CL') : '—'}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
