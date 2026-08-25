import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import FolderIcon from '@mui/icons-material/Folder'
import AssignmentIcon from '@mui/icons-material/Assignment'
import LoginIcon from '@mui/icons-material/Login'
import LogoutIcon from '@mui/icons-material/Logout'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CancelIcon from '@mui/icons-material/Cancel'
import GavelIcon from '@mui/icons-material/Gavel'

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('es-CL')
}

export default function CuadroResumenBloque({ idProducto, mes, anio, fechaProceso }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!fechaProceso) return
    setData(null)
    setError('')
    const query = `id_producto=${idProducto}&mes=${mes}&anio=${anio}&fecha_proceso=${encodeURIComponent(fechaProceso)}`
    apiFetch(`/panel/crci/metricas?${query}`)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [idProducto, mes, anio, fechaProceso])

  if (!fechaProceso) return <p>Seleccione una iteración para ver el cuadro resumen.</p>
  if (error) return <p className="login-error">{error}</p>
  if (!data) return <p>Cargando métricas...</p>

  const mesLabel = `${String(data.mes).padStart(2, '0')}-${data.anio}`
  const totalSalidas = (data.apercibimiento ?? 0) + (data.retira_demanda ?? 0) + (data.mandamiento ?? 0)

  return (
    <>
      <p className="panel-section-title">Asignación</p>
      <div className="kpi-row">
        <KpiCard label="Stock" value={fmt(data.stock)} icon={<FolderIcon />} highlight />
        <KpiCard
          label={`Flujo mensual (${mesLabel})`}
          value={fmt(data.flujo_asignacion)}
          icon={<AssignmentIcon />}
        />
      </div>

      <p className="panel-section-title">Ingreso</p>
      <div className="kpi-row">
        <KpiCard label="Reingresos" value={fmt(data.reingresos)} icon={<LoginIcon />} highlight />
        <KpiCard
          label={`Flujo mensual (${mesLabel})`}
          value={fmt(data.flujo_ingreso)}
          icon={<AssignmentIcon />}
        />
      </div>

      <p className="panel-section-title">Salida</p>
      <div className="kpi-row">
        <KpiCard label="Total salidas" value={fmt(totalSalidas)} icon={<LogoutIcon />} highlight />
        <KpiCard label="Apercibimiento" value={fmt(data.apercibimiento)} icon={<WarningAmberIcon />} />
        <KpiCard label="Retira demanda" value={fmt(data.retira_demanda)} icon={<CancelIcon />} />
        <KpiCard label="Mandamiento" value={fmt(data.mandamiento)} icon={<GavelIcon />} />
      </div>

      <p style={{ fontSize: 13, color: 'var(--text)', textAlign: 'center' }}>
        Iteración: {data.fecha_proceso} · Producto: {data.id_producto} · Total registros: {fmt(data.total)}
      </p>
    </>
  )
}
