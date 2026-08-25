import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { useJobPolling } from './useJobPolling'

const STORAGE_KEY = 'admin_panel_refresh_job'
const POLL_INTERVAL_MS = 3000

function readStoredJob() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.jobId) return parsed
    return null
  } catch {
    return null
  }
}

function persistJob(jobId, periodo) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ jobId, periodo }))
  } catch {
    // almacenamiento no disponible, seguimos solo en memoria
  }
}

function clearStoredJob() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // sin acción posible
  }
}

function extractJobIdFromConflict(body) {
  if (!body) return null
  if (typeof body.job_id === 'string') return body.job_id
  if (body.detail && typeof body.detail === 'object' && typeof body.detail.job_id === 'string') {
    return body.detail.job_id
  }
  // El backend actual devuelve el detail como texto libre, ej:
  // "Ya hay una actualización en curso (job_id=<uuid>)".
  if (typeof body.detail === 'string') {
    const match = body.detail.match(/job_id[=:]\s*([a-zA-Z0-9-]+)/)
    if (match) return match[1]
  }
  return null
}

/**
 * Maneja el ciclo de vida completo del job de "Actualizar paneles":
 * disparo del job, polling de su estado mientras corre, persistencia en
 * localStorage para recuperar el progreso si el componente se desmonta
 * (ej. el admin navega a un panel y vuelve), y manejo del caso 409
 * (job ya en curso) reenganchándose a ese job cuando el backend expone su id.
 */
export function useAdminPanelRefresh() {
  const [jobId, setJobId] = useState(null)
  const [periodo, setPeriodo] = useState(null)
  const [isStarting, setIsStarting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [conflictNoJobId, setConflictNoJobId] = useState(false)

  // Recupera un job activo guardado en localStorage al montar (ej. si el
  // admin cerró el modal, navegó a un panel y volvió).
  useEffect(() => {
    const stored = readStoredJob()
    if (stored) {
      setJobId(stored.jobId)
      setPeriodo(stored.periodo ?? null)
    }
  }, [])

  const { job, pollError } = useJobPolling(jobId, '/admin/panel-refresh', {
    intervalMs: POLL_INTERVAL_MS,
  })

  useEffect(() => {
    if (job && job.status !== 'running') clearStoredJob()
  }, [job])

  const start = useCallback(async (periodoValue, mandantesSeleccionados) => {
    setIsStarting(true)
    setSubmitError(null)
    setConflictNoJobId(false)
    try {
      const data = await apiFetch('/admin/panel-refresh', {
        method: 'POST',
        body: JSON.stringify({ periodo: periodoValue, mandantes: mandantesSeleccionados }),
      })
      setPeriodo(periodoValue)
      setJobId(data.job_id)
      persistJob(data.job_id, periodoValue)
    } catch (err) {
      if (err.status === 409) {
        let existingJobId = extractJobIdFromConflict(err.body)
        let existingPeriodo = err.body?.periodo ?? periodoValue

        // Si el backend no expuso el job_id en el 409, intentamos recuperar
        // el job en curso vía el endpoint auxiliar antes de rendirnos.
        if (!existingJobId) {
          try {
            const last = await apiFetch('/admin/panel-refresh/last')
            if (last?.status === 'running') {
              existingJobId = last.job_id
              existingPeriodo = last.periodo
            }
          } catch {
            // sin fallback disponible, seguimos con el mensaje genérico
          }
        }

        if (existingJobId) {
          setPeriodo(existingPeriodo)
          setJobId(existingJobId)
          persistJob(existingJobId, existingPeriodo)
          setSubmitError('Ya había una actualización en curso. Mostrando su progreso.')
        } else {
          setConflictNoJobId(true)
          setSubmitError(err.message || 'Ya hay una actualización en curso. Espera a que termine.')
        }
      } else {
        setSubmitError(err.message || 'No se pudo iniciar la actualización.')
      }
    } finally {
      setIsStarting(false)
    }
  }, [])

  const dismiss = useCallback(() => {
    clearStoredJob()
    setJobId(null)
    setPeriodo(null)
    setSubmitError(null)
    setConflictNoJobId(false)
  }, [])

  const isRunning = Boolean(jobId) && (!job || job.status === 'running')

  return {
    jobId,
    periodo,
    job,
    isStarting,
    isRunning,
    submitError,
    pollError,
    conflictNoJobId,
    start,
    dismiss,
  }
}
