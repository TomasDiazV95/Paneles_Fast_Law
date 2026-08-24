import { useEffect, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { MANDANTES } from '../../config/mandantes'

const STATUS_LABEL = {
  running: 'En curso',
  completed: 'Completado',
  completed_with_errors: 'Completado con errores',
  failed: 'Falló',
}

function mandanteLabel(code) {
  const found = MANDANTES.find((m) => m.code === code.toLowerCase())
  return found ? found.label : code
}

function groupStepsByMandante(steps) {
  const groups = []
  const byMandante = new Map()
  steps.forEach((step) => {
    if (!byMandante.has(step.mandante)) {
      const group = { mandante: step.mandante, steps: [] }
      byMandante.set(step.mandante, group)
      groups.push(group)
    }
    byMandante.get(step.mandante).steps.push(step)
  })
  return groups
}

function formatDuration(totalSeconds) {
  if (totalSeconds == null) return null
  const seconds = Math.round(totalSeconds)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}m ${rest}s`
}

function StepStatusIcon({ status }) {
  if (status === 'done') return <CheckCircleIcon className="step-icon step-icon--done" />
  if (status === 'error') return <ErrorIcon className="step-icon step-icon--error" />
  if (status === 'running') return <AutorenewIcon className="step-icon step-icon--running spin" />
  return <HourglassEmptyIcon className="step-icon step-icon--pending" />
}

function useElapsedSeconds(startedAt, active) {
  const [, forceTick] = useState(0)
  useEffect(() => {
    if (!active || !startedAt) return undefined
    const id = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [active, startedAt])

  if (!startedAt) return null
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  return elapsed
}

function todayYearMonth() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}`
}

// El montaje/desmontaje de este modal lo controla el padre (renderizado
// condicional), para no romper las reglas de hooks con un return temprano.
export default function PanelRefreshModal({ onClose, refresh }) {
  const [periodoInput, setPeriodoInput] = useState(todayYearMonth)

  const { jobId, job, isStarting, isRunning, submitError, pollError, conflictNoJobId, start, dismiss } = refresh

  const periodoValue = periodoInput.replace('-', '')
  const periodoValido = /^\d{6}$/.test(periodoValue)
  const startDisabled = !periodoValido || isStarting || isRunning || conflictNoJobId

  const steps = job?.steps ?? []
  const grupos = groupStepsByMandante(steps)
  const doneCount = steps.filter((s) => s.status === 'done').length
  const errorCount = steps.filter((s) => s.status === 'error').length
  const totalCount = steps.length
  const finalizados = doneCount + errorCount
  const progressPct = totalCount ? Math.round((finalizados / totalCount) * 100) : 0

  const elapsed = useElapsedSeconds(job?.started_at, job?.status === 'running')
  const elapsedLabel = elapsed != null ? formatDuration(elapsed) : null

  const isTerminalState = job && job.status !== 'running'

  function handleOverlayClick() {
    onClose()
  }

  function handleStart(e) {
    e.preventDefault()
    if (startDisabled) return
    start(periodoValue)
  }

  function handleClose() {
    if (isTerminalState) dismiss()
    onClose()
  }

  function handleNuevaActualizacion() {
    dismiss()
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-card admin-refresh-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Actualizar paneles"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Actualizar paneles</h2>
          <button type="button" className="modal-close-btn" aria-label="Cerrar" onClick={handleClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          {!jobId && (
            <form onSubmit={handleStart} className="admin-refresh-form">
              <p className="admin-refresh-intro">
                Recalcula los 4 mandantes (CLA, CENCO, ARAUCANA y UC) para el período que indiques.
                El proceso corre en segundo plano y puede tardar varios minutos.
              </p>

              <label className="login-field">
                Período a procesar
                <input
                  type="month"
                  value={periodoInput}
                  onChange={(e) => setPeriodoInput(e.target.value)}
                  required
                />
              </label>

              <div className="admin-alert admin-alert--info">
                <InfoOutlinedIcon />
                <span>
                  ARAUCANA no usa el período para decidir qué datos trae: siempre recalcula con el estado
                  activo actual del sistema origen. El período solo se usa para etiquetar las filas
                  resultantes, así que es normal que sus valores no cambien al elegir otro período.
                </span>
              </div>

              {submitError && (
                <div className="admin-alert admin-alert--danger">
                  <ErrorIcon />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="theme-toggle" onClick={handleClose}>
                  Cancelar
                </button>
                <button type="submit" className="login-submit admin-refresh-submit" disabled={startDisabled}>
                  {isStarting ? 'Iniciando…' : 'Iniciar actualización'}
                </button>
              </div>
            </form>
          )}

          {jobId && (
            <div className="admin-refresh-progress">
              <div className="admin-refresh-summary">
                <span className={`admin-refresh-status admin-refresh-status--${job?.status ?? 'running'}`}>
                  {STATUS_LABEL[job?.status ?? 'running']}
                </span>
                <span className="admin-refresh-periodo">Período {periodo(job, refresh)}</span>
              </div>

              {job?.status === 'running' && (
                <div className="admin-alert admin-alert--info">
                  <InfoOutlinedIcon />
                  <span>
                    Este proceso puede tardar varios minutos (en torno a 6 minutos en total). No es
                    necesario mantener esta ventana abierta: el proceso sigue corriendo en segundo plano.
                    {elapsedLabel && ` Tiempo transcurrido: ${elapsedLabel}.`}
                  </span>
                </div>
              )}

              {job?.status === 'completed' && (
                <div className="admin-alert admin-alert--success">
                  <CheckCircleIcon />
                  <span>Actualización completada correctamente.</span>
                </div>
              )}

              {job?.status === 'completed_with_errors' && (
                <div className="admin-alert admin-alert--warning">
                  <ErrorIcon />
                  <span>
                    Actualización finalizada, pero {errorCount} paso(s) tuvieron error. Revisa el detalle
                    debajo.
                  </span>
                </div>
              )}

              {job?.status === 'failed' && (
                <div className="admin-alert admin-alert--danger">
                  <ErrorIcon />
                  <span>La actualización falló.</span>
                </div>
              )}

              {pollError && (
                <div className="admin-alert admin-alert--warning">
                  <ErrorIcon />
                  <span>No se pudo consultar el estado más reciente: {pollError}. Reintentando…</span>
                </div>
              )}

              {totalCount > 0 && (
                <div className="admin-refresh-progress-bar">
                  <div className="admin-refresh-progress-bar-track">
                    <div
                      className="admin-refresh-progress-bar-fill"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="admin-refresh-progress-label">
                    {finalizados} de {totalCount} completados
                  </span>
                </div>
              )}

              <div className="admin-refresh-steps">
                {grupos.map((grupo) => (
                  <div key={grupo.mandante} className="admin-refresh-group">
                    <p className="admin-refresh-group-title">{mandanteLabel(grupo.mandante)}</p>
                    <ul className="step-list">
                      {grupo.steps.map((step) => (
                        <li key={`${step.mandante}-${step.cartera}`} className={`step-item step-item--${step.status}`}>
                          <StepStatusIcon status={step.status} />
                          <span className="step-label">{step.label}</span>
                          {step.status === 'done' && step.duration_seconds != null && (
                            <span className="step-duration">{formatDuration(step.duration_seconds)}</span>
                          )}
                          {step.status === 'error' && (
                            <span className="step-error">{step.error || 'Error desconocido'}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="modal-footer">
                {isTerminalState && (
                  <button type="button" className="theme-toggle" onClick={handleNuevaActualizacion}>
                    Actualizar otro período
                  </button>
                )}
                <button type="button" className="login-submit admin-refresh-submit" onClick={handleClose}>
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function periodo(job, refresh) {
  const value = job?.periodo ?? refresh.periodo
  if (!value) return '—'
  return `${value.slice(4)}/${value.slice(0, 4)}`
}
