import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import KpiCard from '../../../components/panel/KpiCard'
import { pctVariacion } from './bucketMeta'
import PeopleIcon from '@mui/icons-material/People'
import PaymentsIcon from '@mui/icons-material/Payments'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk'
import ContactPhoneIcon from '@mui/icons-material/ContactPhone'
import HowToRegIcon from '@mui/icons-material/HowToReg'
import HandshakeIcon from '@mui/icons-material/Handshake'
import HeartBrokenIcon from '@mui/icons-material/HeartBroken'
import SpeedIcon from '@mui/icons-material/Speed'

function hint(actual, anterior, pctdelta) {
  if (anterior == null) return null
  const pct = pctdelta ? (actual - anterior).toFixed(1) : pctVariacion(actual, anterior)
  if (pct == null) return null
  const signo = Number(pct) >= 0 ? '+' : ''
  return `${signo}${pct}${pctdelta ? ' pp' : '%'} vs. mes anterior`
}

export default function KpiGridUC({ periodo, cartera, children }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    setError('')
    apiFetch(`/panel/uc/resumen?periodo=${periodo}&cartera=${cartera}`)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [periodo, cartera])

  if (error) return <p className="login-error">{error}</p>
  if (!data) return <p>Cargando indicadores...</p>

  const { actual: a, anterior: p } = data
  const money = (v) => `$${Math.round(v).toLocaleString('es-CL')}`
  const num = (v) => Math.round(v).toLocaleString('es-CL')
  const pct = (v) => `${v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

  return (
    <div className="kpi-row">
      <KpiCard
        label="Cuentas asignadas"
        value={num(a.cuentas)}
        icon={<PeopleIcon />}
        hint={hint(a.cuentas, p?.cuentas)}
        highlight
      />
      <KpiCard
        label="Deuda asignada"
        value={money(a.deuda)}
        icon={<PaymentsIcon />}
        hint={`Ticket promedio ${money(a.ticket_promedio)}`}
      />
      <KpiCard
        label="Cobertura de gestión"
        value={pct(a.cobertura_pct)}
        icon={<CheckCircleIcon />}
        hint={hint(a.cobertura_pct, p?.cobertura_pct, true)}
      />
      <KpiCard
        label="Sin gestión"
        value={num(a.sin_gestion)}
        icon={<WarningAmberIcon />}
        hint={`${money(a.deuda_sin_gestion)} sin tocar`}
      />
      <KpiCard
        label="Gestiones ejecutadas"
        value={num(a.gestiones)}
        icon={<PhoneInTalkIcon />}
        hint={`${a.gestiones_por_cuenta_gestionada.toFixed(1)} por cuenta gestionada`}
      />
      <KpiCard
        label="Contactabilidad"
        value={pct(a.contactabilidad_pct)}
        icon={<ContactPhoneIcon />}
        hint={hint(a.contactabilidad_pct, p?.contactabilidad_pct, true)}
      />
      <KpiCard
        label="Contacto directo"
        value={num(a.contacto_directo)}
        icon={<HowToRegIcon />}
        hint={`${pct(a.contacto_directo_pct)} del contacto total`}
      />
      <KpiCard
        label="Compromisos de pago"
        value={num(a.compromisos)}
        icon={<HandshakeIcon />}
        hint={`${pct(a.conversion_compromiso_pct)} de conversión sobre contacto directo`}
      />
      <KpiCard
        label="Compromisos rotos"
        value={num(a.compromisos_rotos)}
        icon={<HeartBrokenIcon />}
        hint={`${pct(a.incumplimiento_pct)} de incumplimiento`}
      />
      <KpiCard
        label="Intensidad media"
        value={a.intensidad_media.toFixed(1)}
        icon={<SpeedIcon />}
        hint="gestiones por cuenta"
      />
      {children}
    </div>
  )
}
