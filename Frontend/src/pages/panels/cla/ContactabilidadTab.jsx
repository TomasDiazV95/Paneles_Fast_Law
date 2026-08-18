import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import DonutChart from '../../../components/charts/DonutChart'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import FolderIcon from '@mui/icons-material/Folder'
import PhoneIcon from '@mui/icons-material/Phone'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'

export default function ContactabilidadTab({ periodo }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    apiFetch(`/panel/cla/contactabilidad?periodo=${periodo}`).then(setData).catch((err) => setError(err.message))
  }, [periodo])

  if (error) return <p className="login-error">{error}</p>
  if (!data) return <p>Cargando...</p>

  const { matriz, resumen, inbound } = data

  const clasificaciones = [...new Set(matriz.map((r) => r.clasificacion))]
  const tiposContacto = [...new Set(matriz.map((r) => r.tipo_contacto))]

  const totalCausas = resumen.reduce((sum, r) => sum + r.cantidad_causas, 0)
  const totalGestiones = resumen.reduce((sum, r) => sum + r.total_gestiones, 0)
  const diasHabiles = resumen[0]?.dias_habiles ?? 0
  const promGestionesDia = diasHabiles > 0 ? (totalGestiones / diasHabiles).toFixed(1) : '0'

  const inboundTotal = inbound.find((r) => r.clasificacion === 'TOTAL GENERAL')

  return (
    <>
      <div className="kpi-row">
        <KpiCard label="Total Causas" value={totalCausas.toLocaleString('es-CL')} icon={<FolderIcon />} highlight />
        <KpiCard label="Total Gestiones" value={totalGestiones.toLocaleString('es-CL')} icon={<PhoneIcon />} />
        <KpiCard label="Días Hábiles" value={diasHabiles} icon={<CalendarMonthIcon />} />
        <KpiCard label="Prom. Gestiones/Día" value={promGestionesDia} icon={<TrendingUpIcon />} />
      </div>

      <div className="chart-row">
        <DonutChart
          title="Gestiones por tipo de contacto"
          data={resumen.map((r) => ({ label: r.tipo_contacto, value: r.cantidad_causas }))}
        />
        {inboundTotal && (
          <DonutChart
            title="Contactabilidad Inbound"
            data={[
              { label: 'Contacto Directo Inbound', value: inboundTotal.contacto_directo_inbound },
              { label: 'Sin Contacto Inbound', value: inboundTotal.sin_contacto_inbound },
            ]}
          />
        )}
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
                  return (
                    <td key={tipo} className="num">
                      {celda ? celda.cantidad_causas.toLocaleString('es-CL') : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
