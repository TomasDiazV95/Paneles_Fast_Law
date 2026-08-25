import { useEffect, useState } from 'react'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { apiFetch } from '../api/client'
import { useCargaArchivo } from '../hooks/useCargaArchivo'
import { useJobPolling } from '../hooks/useJobPolling'

const STATUS_LABEL = {
  running: 'En curso',
  done: 'Completado',
  error: 'Falló',
}

// Reutiliza los modificadores visuales ya definidos para admin-refresh-status
// (running/completed/failed) aunque el vocabulario de status del job de
// carga sea distinto (running/done/error).
const STATUS_CLASS_SUFFIX = {
  running: 'running',
  done: 'completed',
  error: 'failed',
}

const RECALCULO_STATUS_LABEL = {
  running: 'en curso',
  completed: 'completado',
  completed_with_errors: 'completado con errores',
  failed: 'falló',
}

function todayYearMonth() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}`
}

export default function CargaArchivos() {
  const [tipos, setTipos] = useState([])
  const [tiposLoading, setTiposLoading] = useState(true)
  const [tiposError, setTiposError] = useState(null)
  const [selectedTipo, setSelectedTipo] = useState(null)

  const [archivo, setArchivo] = useState(null)
  const [periodoInput, setPeriodoInput] = useState(todayYearMonth)
  const [hoja, setHoja] = useState('')
  const [forzar, setForzar] = useState(false)

  const carga = useCargaArchivo()
  const { job: recalculoJob } = useJobPolling(
    carga.job?.recalculo_job_id ?? null,
    '/admin/panel-refresh',
  )

  useEffect(() => {
    let cancelled = false
    apiFetch('/carga/tipos')
      .then((data) => {
        if (!cancelled) setTipos(data)
      })
      .catch((err) => {
        if (!cancelled) setTiposError(err.message)
      })
      .finally(() => {
        if (!cancelled) setTiposLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Si al montar se recupera un job activo desde localStorage, selecciona su
  // tipo para mostrar el progreso correcto en vez del selector.
  useEffect(() => {
    if (carga.tipoCarga) setSelectedTipo(carga.tipoCarga)
  }, [carga.tipoCarga])

  const config = tipos.find((t) => t.tipo === selectedTipo) ?? null
  const isTerminalState = Boolean(carga.job) && carga.job.status !== 'running'

  function resetForm() {
    setArchivo(null)
    setPeriodoInput(todayYearMonth())
    setHoja('')
    setForzar(false)
  }

  function handleSelectTipo(tipo) {
    setSelectedTipo(tipo)
    resetForm()
  }

  function handleVolverSelector() {
    carga.dismiss()
    setSelectedTipo(null)
    resetForm()
  }

  function handleNuevaCarga() {
    carga.dismiss()
    resetForm()
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!config || !archivo) return

    const formData = new FormData()
    formData.append('archivo', archivo)
    if (config.requiere_periodo) {
      formData.append('periodo', periodoInput.replace('-', ''))
    }
    if (config.requiere_hoja && hoja.trim()) {
      formData.append('hoja', hoja.trim())
    }
    if (config.permite_forzar) {
      formData.append('forzar', forzar ? 'true' : 'false')
    }

    carga.start(config.tipo, formData)
  }

  const periodoValue = periodoInput.replace('-', '')
  const periodoValido = !config?.requiere_periodo || /^\d{6}$/.test(periodoValue)
  const submitDisabled =
    !archivo || !periodoValido || carga.isStarting || carga.isRunning || carga.conflictNoJobId

  const status = carga.job?.status ?? 'running'

  return (
    <div className="mandante-page carga-page">
      <h2>Carga de archivos</h2>
      <p>Elige el tipo de carga, sube el archivo y sigue el progreso del proceso.</p>

      {tiposLoading && <p>Cargando tipos de carga…</p>}

      {tiposError && (
        <div className="admin-alert admin-alert--danger">
          <ErrorIcon />
          <span>No se pudieron cargar los tipos de carga: {tiposError}</span>
        </div>
      )}

      {!tiposLoading && !tiposError && !selectedTipo && (
        <div className="carga-tipo-grid">
          {tipos.map((tipo) => (
            <button
              key={tipo.tipo}
              type="button"
              className="mandante-card carga-tipo-card"
              onClick={() => handleSelectTipo(tipo.tipo)}
            >
              {tipo.label}
            </button>
          ))}
        </div>
      )}

      {config && !carga.jobId && (
        <form onSubmit={handleSubmit} className="carga-form-card">
          <div className="carga-form-header">
            <h3>{config.label}</h3>
            <button type="button" className="theme-toggle" onClick={handleVolverSelector}>
              Cambiar tipo
            </button>
          </div>

          <label className="login-field">
            Archivo ({config.extensiones.join(', ')})
            <input
              type="file"
              accept={config.extensiones.join(',')}
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              required
            />
          </label>

          {config.requiere_periodo && (
            <label className="login-field">
              Período
              <input
                type="month"
                value={periodoInput}
                onChange={(e) => setPeriodoInput(e.target.value)}
                required
              />
            </label>
          )}

          {config.requiere_hoja && (
            <label className="login-field">
              Hoja (opcional)
              <input
                type="text"
                value={hoja}
                onChange={(e) => setHoja(e.target.value)}
                placeholder="Dejar en blanco si el archivo tiene una sola hoja"
              />
            </label>
          )}

          {config.permite_forzar && (
            <label className="carga-checkbox-field">
              <input
                type="checkbox"
                checked={forzar}
                onChange={(e) => setForzar(e.target.checked)}
              />
              Forzar recarga (ignora protección de doble carga del mismo día)
            </label>
          )}

          {carga.submitError && (
            <div className="admin-alert admin-alert--danger">
              <ErrorIcon />
              <span>{carga.submitError}</span>
            </div>
          )}

          <div className="modal-footer">
            <button type="submit" className="login-submit admin-refresh-submit" disabled={submitDisabled}>
              {carga.isStarting ? 'Enviando…' : 'Cargar'}
            </button>
          </div>
        </form>
      )}

      {carga.jobId && (
        <div className="carga-form-card admin-refresh-progress">
          <div className="carga-form-header">
            <h3>{config?.label ?? carga.tipoCarga}</h3>
          </div>

          <div className="admin-refresh-summary">
            <span className={`admin-refresh-status admin-refresh-status--${STATUS_CLASS_SUFFIX[status]}`}>
              {STATUS_LABEL[status]}
            </span>
            {carga.job?.archivo_nombre && (
              <span className="admin-refresh-periodo">{carga.job.archivo_nombre}</span>
            )}
          </div>

          {status === 'running' && (
            <div className="admin-alert admin-alert--info">
              <AutorenewIcon className="spin" />
              <span>Procesando el archivo. Este proceso puede tardar algunos minutos.</span>
            </div>
          )}

          {carga.job?.status === 'done' && (
            <div className="admin-alert admin-alert--success">
              <CheckCircleIcon />
              <div>
                <p style={{ margin: 0 }}>{carga.job.mensaje}</p>
                {carga.job.detalle && (
                  <ul className="carga-detalle-list">
                    {Object.entries(carga.job.detalle).map(([key, value]) => (
                      <li key={key}>
                        <strong>{key}:</strong> {String(value)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {carga.job?.status === 'error' && (
            <div
              className={`admin-alert ${
                carga.job.tipo_error === 'datos' ? 'admin-alert--warning' : 'admin-alert--danger'
              }`}
            >
              <ErrorIcon />
              <span>{carga.job.mensaje}</span>
            </div>
          )}

          {carga.job?.recalculo_job_id && (
            <div className="admin-alert admin-alert--info">
              <InfoOutlinedIcon />
              <span>
                También se disparó el recálculo del panel UC (
                {recalculoJob ? RECALCULO_STATUS_LABEL[recalculoJob.status] ?? recalculoJob.status : 'en curso'}
                ).
              </span>
            </div>
          )}

          {carga.pollError && (
            <div className="admin-alert admin-alert--warning">
              <ErrorIcon />
              <span>No se pudo consultar el estado más reciente: {carga.pollError}. Reintentando…</span>
            </div>
          )}

          {isTerminalState && (
            <div className="modal-footer">
              <button type="button" className="theme-toggle" onClick={handleVolverSelector}>
                Elegir otro tipo
              </button>
              <button type="button" className="login-submit admin-refresh-submit" onClick={handleNuevaCarga}>
                Cargar otro archivo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
