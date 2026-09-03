import { useEffect, useState } from 'react'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import CloseIcon from '@mui/icons-material/Close'
import { apiFetch } from '../api/client'
import { useCargaArchivo } from '../hooks/useCargaArchivo'
import { useJobPolling } from '../hooks/useJobPolling'

const MAX_ARCHIVOS_MULTIPLES = 5

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

function formatFechaCarga(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CargaArchivos() {
  const [tipos, setTipos] = useState([])
  const [tiposLoading, setTiposLoading] = useState(true)
  const [tiposError, setTiposError] = useState(null)
  const [selectedTipo, setSelectedTipo] = useState(null)

  const [archivo, setArchivo] = useState(null)
  const [archivosMultiples, setArchivosMultiples] = useState([])
  const [hojasMultiples, setHojasMultiples] = useState([])
  const [archivosMultiplesError, setArchivosMultiplesError] = useState(null)
  const [periodoInput, setPeriodoInput] = useState(todayYearMonth)
  const [hoja, setHoja] = useState('')
  const [forzar, setForzar] = useState(false)
  const [limpiarPeriodo, setLimpiarPeriodo] = useState(false)

  const [ultimaCarga, setUltimaCarga] = useState(null)
  const [ultimaCargaError, setUltimaCargaError] = useState(false)

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

  // Consulta la última carga exitosa cada vez que cambia el tipo elegido
  // (no se cachea entre tipos distintos).
  useEffect(() => {
    if (!selectedTipo) {
      setUltimaCarga(null)
      setUltimaCargaError(false)
      return undefined
    }
    let cancelled = false
    setUltimaCarga(null)
    setUltimaCargaError(false)
    apiFetch(`/carga/${selectedTipo}/ultima`)
      .then((data) => {
        if (!cancelled) setUltimaCarga(data)
      })
      .catch(() => {
        // Informativo, no crítico: si falla, simplemente no se muestra el cuadro.
        if (!cancelled) setUltimaCargaError(true)
      })
    return () => {
      cancelled = true
    }
  }, [selectedTipo])

  // Refresca el dato de última carga cuando el job termina con éxito, para
  // que el usuario lo vea actualizado sin recargar la página.
  useEffect(() => {
    if (carga.job?.status === 'done' && carga.job?.ok && carga.tipoCarga) {
      apiFetch(`/carga/${carga.tipoCarga}/ultima`)
        .then((data) => setUltimaCarga(data))
        .catch(() => {
          // silencioso: no bloquea el flujo de carga
        })
    }
  }, [carga.job?.status, carga.job?.ok, carga.tipoCarga])

  const config = tipos.find((t) => t.tipo === selectedTipo) ?? null
  const isTerminalState = Boolean(carga.job) && carga.job.status !== 'running'

  function resetForm() {
    setArchivo(null)
    setArchivosMultiples([])
    setHojasMultiples([])
    setArchivosMultiplesError(null)
    setPeriodoInput(todayYearMonth())
    setHoja('')
    setForzar(false)
    setLimpiarPeriodo(false)
  }

  function handleArchivosMultiplesChange(e) {
    const nuevos = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (nuevos.length === 0) return

    const disponibles = MAX_ARCHIVOS_MULTIPLES - archivosMultiples.length
    if (disponibles <= 0) {
      setArchivosMultiplesError(`Ya seleccionaste el máximo de ${MAX_ARCHIVOS_MULTIPLES} archivos permitidos.`)
      return
    }

    const aAgregar = nuevos.slice(0, disponibles)
    setArchivosMultiplesError(
      nuevos.length > disponibles
        ? `Solo se agregaron ${aAgregar.length} archivo(s); el máximo permitido es ${MAX_ARCHIVOS_MULTIPLES}.`
        : null,
    )
    setArchivosMultiples((prev) => [...prev, ...aAgregar])
    setHojasMultiples((prev) => [...prev, ...aAgregar.map(() => '')])
  }

  function handleQuitarArchivoMultiple(index) {
    setArchivosMultiples((prev) => prev.filter((_, i) => i !== index))
    setHojasMultiples((prev) => prev.filter((_, i) => i !== index))
    setArchivosMultiplesError(null)
  }

  function handleHojaMultipleChange(index, value) {
    setHojasMultiples((prev) => prev.map((v, i) => (i === index ? value : v)))
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
    if (!config) return

    const esMultiple = config.permite_multiples_archivos
    const archivosAEnviar = esMultiple ? archivosMultiples : archivo ? [archivo] : []
    if (archivosAEnviar.length === 0) return

    const formData = new FormData()
    archivosAEnviar.forEach((file) => formData.append('archivo', file))

    if (config.requiere_periodo) {
      formData.append('periodo', periodoInput.replace('-', ''))
    }

    if (config.requiere_hoja) {
      if (esMultiple) {
        // Una entrada de "hoja" por archivo, en el mismo orden posicional.
        // Los CSV nunca llevan hoja (el backend rechaza cualquier valor no
        // vacío para ellos).
        const hojasAEnviar = archivosAEnviar.map((file, index) => {
          if (file.name.toLowerCase().endsWith('.csv')) return ''
          return (hojasMultiples[index] ?? '').trim()
        })
        if (hojasAEnviar.some((valor) => valor !== '')) {
          hojasAEnviar.forEach((valor) => formData.append('hoja', valor))
        }
      } else if (hoja.trim()) {
        formData.append('hoja', hoja.trim())
      }
    }

    if (config.permite_forzar) {
      formData.append('forzar', forzar ? 'true' : 'false')
    }

    if (config.permite_limpiar_periodo) {
      formData.append('limpiar_periodo', limpiarPeriodo ? 'true' : 'false')
    }

    carga.start(config.tipo, formData)
  }

  const periodoValue = periodoInput.replace('-', '')
  const periodoValido = !config?.requiere_periodo || /^\d{6}$/.test(periodoValue)
  const archivosSeleccionados = config?.permite_multiples_archivos
    ? archivosMultiples
    : archivo
      ? [archivo]
      : []
  const submitDisabled =
    archivosSeleccionados.length === 0 ||
    !periodoValido ||
    carga.isStarting ||
    carga.isRunning ||
    carga.conflictNoJobId

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

          {!ultimaCargaError && ultimaCarga && (
            <div className="admin-alert admin-alert--info carga-ultima-alert">
              <InfoOutlinedIcon />
              {ultimaCarga.tiene_registro ? (
                <span>
                  Última carga: <strong>{ultimaCarga.usuario}</strong> —{' '}
                  {formatFechaCarga(ultimaCarga.fecha)}
                  {ultimaCarga.archivo_nombre && (
                    <>
                      {' '}
                      — archivo: <em>{ultimaCarga.archivo_nombre}</em>
                    </>
                  )}
                </span>
              ) : (
                <span>
                  Todavía no hay registro de cargas para este tipo en esta sesión del servidor.
                </span>
              )}
            </div>
          )}

          {config.permite_multiples_archivos ? (
            <div className="login-field">
              <span>
                Archivos ({config.extensiones.join(', ')}) — de 1 a {MAX_ARCHIVOS_MULTIPLES}
              </span>
              <input
                type="file"
                accept={config.extensiones.join(',')}
                multiple
                onChange={handleArchivosMultiplesChange}
              />

              {archivosMultiples.length > 0 && (
                <ul className="carga-archivos-list">
                  {archivosMultiples.map((file, index) => {
                    const esCsv = file.name.toLowerCase().endsWith('.csv')
                    return (
                      <li key={`${file.name}-${index}`} className="carga-archivos-list-item">
                        <span className="carga-archivos-list-name" title={file.name}>
                          {file.name}
                        </span>
                        {config.requiere_hoja &&
                          (esCsv ? (
                            <span className="carga-archivos-list-hoja-csv">CSV (sin hoja)</span>
                          ) : (
                            <input
                              type="text"
                              className="carga-archivos-list-hoja-input"
                              value={hojasMultiples[index] ?? ''}
                              onChange={(e) => handleHojaMultipleChange(index, e.target.value)}
                              placeholder="Hoja (opcional)"
                              aria-label={`Hoja para ${file.name}`}
                            />
                          ))}
                        <button
                          type="button"
                          className="modal-close-btn"
                          aria-label={`Quitar ${file.name}`}
                          onClick={() => handleQuitarArchivoMultiple(index)}
                        >
                          <CloseIcon />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {archivosMultiples.length === 0 && (
                <p className="carga-archivos-hint">Selecciona entre 1 y {MAX_ARCHIVOS_MULTIPLES} archivos.</p>
              )}
              {archivosMultiplesError && <p className="carga-archivos-error">{archivosMultiplesError}</p>}
            </div>
          ) : (
            <label className="login-field">
              Archivo ({config.extensiones.join(', ')})
              <input
                type="file"
                accept={config.extensiones.join(',')}
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                required
              />
            </label>
          )}

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

          {config.requiere_hoja && !config.permite_multiples_archivos && (
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

          {config.permite_limpiar_periodo && (
            <div className="carga-checkbox-field-group">
              <label className="carga-checkbox-field">
                <input
                  type="checkbox"
                  checked={limpiarPeriodo}
                  onChange={(e) => setLimpiarPeriodo(e.target.checked)}
                />
                Eliminar los registros existentes de este período antes de cargar
              </label>
              <p className="carga-checkbox-hint">
                Por defecto la carga es incremental y no borra nada. Usa esta opción solo en la
                primera carga de un período nuevo, o para recargar todo desde cero. Si vas a
                subir un segundo archivo del mismo período, no marques esta opción: borraría lo
                ya cargado por el primer archivo.
              </p>
            </div>
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
