import { useEffect, useState } from 'react'
import { apiFetch } from '../../../api/client'
import PaidIcon from '@mui/icons-material/Paid'
import CloseIcon from '@mui/icons-material/Close'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

const money = (v) => `$${Math.round(v).toLocaleString('es-CL')}`
const num = (v) => Math.round(v).toLocaleString('es-CL')

function formatFecha(fechaIso) {
  // fechaIso viene como 'YYYY-MM-DD'
  const [anio, mes, dia] = fechaIso.split('-')
  return `${dia}-${mes}-${anio}`
}

// Card compacta de KPI (misma clase/patrón que KpiCard) pero clickeable:
// abre un modal con el desglose diario de pagos.
export default function PagosCard({ periodo, cartera }) {
  const [resumen, setResumen] = useState(null)
  const [error, setError] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)

  useEffect(() => {
    setResumen(null)
    setError('')
    apiFetch(`/panel/uc/pagos-resumen?periodo=${periodo}&cartera=${cartera}`)
      .then(setResumen)
      .catch((err) => setError(err.message))
  }, [periodo, cartera])

  return (
    <>
      <button
        type="button"
        className="kpi-card kpi-card--clickable"
        onClick={() => setModalAbierto(true)}
        aria-haspopup="dialog"
        aria-label="Ver desglose diario de pagos"
      >
        <span className="kpi-icon">
          <PaidIcon />
        </span>
        <span className="kpi-card-body">
          <span className="kpi-label">Pagos</span>
          <span className="kpi-value">{error ? '—' : resumen ? money(resumen.monto) : '…'}</span>
          <span className="kpi-hint">
            {error ? error : resumen ? `${num(resumen.casos)} cuotas pagadas` : 'Cargando...'}
          </span>
        </span>
        <ChevronRightIcon className="kpi-card-chevron" />
      </button>

      {modalAbierto && (
        <PagosDetalleModal periodo={periodo} cartera={cartera} onClose={() => setModalAbierto(false)} />
      )}
    </>
  )
}

function PagosDetalleModal({ periodo, cartera, onClose }) {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState('')

  // El detalle diario se pide recién al abrir el modal, no antes.
  useEffect(() => {
    apiFetch(`/panel/uc/pagos-detalle?periodo=${periodo}&cartera=${cartera}`)
      .then(setFilas)
      .catch((err) => setError(err.message))
  }, [periodo, cartera])

  const totalMonto = filas ? filas.reduce((acc, f) => acc + f.monto, 0) : 0
  const totalCasos = filas ? filas.reduce((acc, f) => acc + f.casos, 0) : 0
  const periodoLabel = `${periodo.slice(4)}/${periodo.slice(0, 4)}`

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card pagos-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Desglose diario de pagos"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Pagos por día — {periodoLabel}</h2>
          <button type="button" className="modal-close-btn" aria-label="Cerrar" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          {error && <p className="login-error">{error}</p>}
          {!filas && !error && <p>Cargando detalle de pagos...</p>}

          {filas && filas.length === 0 && <p>Sin pagos registrados para este período.</p>}

          {filas && filas.length > 0 && (
            <>
              <div className="kpi-row">
                <div className="kpi-card">
                  <span className="kpi-card-body">
                    <span className="kpi-label">Total recaudado</span>
                    <span className="kpi-value">{money(totalMonto)}</span>
                  </span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-card-body">
                    <span className="kpi-label">Cuotas pagadas</span>
                    <span className="kpi-value">{num(totalCasos)}</span>
                  </span>
                </div>
              </div>

              <div className="panel-table-wrapper">
                <table className="panel-table">
                  <thead>
                    <tr>
                      <th>Fecha de pago</th>
                      <th className="num">Cuotas pagadas</th>
                      <th className="num">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.fecha_pago}>
                        <td>{formatFecha(f.fecha_pago)}</td>
                        <td className="num">{num(f.casos)}</td>
                        <td className="num">{money(f.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="login-submit admin-refresh-submit" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
