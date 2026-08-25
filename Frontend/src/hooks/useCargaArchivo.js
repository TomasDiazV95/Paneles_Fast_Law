import { useCallback, useEffect, useState } from 'react'
import { apiUpload } from '../api/client'
import { useJobPolling } from './useJobPolling'

const STORAGE_KEY = 'carga_archivo_job'
const POLL_INTERVAL_MS = 2500

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

function persistJob(jobId, tipoCarga) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ jobId, tipoCarga }))
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
  // El backend devuelve el detail como texto libre, ej:
  // "Ya hay una carga de este tipo en curso (job_id=<uuid>)".
  if (typeof body.detail === 'string') {
    const match = body.detail.match(/job_id[=:]\s*([a-zA-Z0-9-]+)/)
    if (match) return match[1]
  }
  return null
}

/**
 * Maneja el ciclo de vida completo de un job de carga de archivos: envío del
 * multipart/form-data, polling del estado mientras corre, persistencia en
 * localStorage para recuperar el progreso si el usuario navega y vuelve, y
 * manejo del caso 409 (ya hay una carga de ese tipo en curso) enganchándose
 * al job existente. Análogo a useAdminPanelRefresh pero para un job atómico
 * (sin "steps").
 */
export function useCargaArchivo() {
  const [jobId, setJobId] = useState(null)
  const [tipoCarga, setTipoCarga] = useState(null)
  const [isStarting, setIsStarting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [conflictNoJobId, setConflictNoJobId] = useState(false)

  // Recupera un job activo guardado en localStorage al montar (ej. si el
  // usuario navegó fuera de la página y volvió).
  useEffect(() => {
    const stored = readStoredJob()
    if (stored) {
      setJobId(stored.jobId)
      setTipoCarga(stored.tipoCarga ?? null)
    }
  }, [])

  const { job, pollError } = useJobPolling(jobId, '/carga', {
    intervalMs: POLL_INTERVAL_MS,
  })

  useEffect(() => {
    if (job && job.status !== 'running') clearStoredJob()
  }, [job])

  const start = useCallback(async (tipo, formData) => {
    setIsStarting(true)
    setSubmitError(null)
    setConflictNoJobId(false)
    try {
      const data = await apiUpload(`/carga/${tipo}`, formData)
      setTipoCarga(tipo)
      setJobId(data.job_id)
      persistJob(data.job_id, tipo)
    } catch (err) {
      if (err.status === 409) {
        const existingJobId = extractJobIdFromConflict(err.body)
        if (existingJobId) {
          setTipoCarga(tipo)
          setJobId(existingJobId)
          persistJob(existingJobId, tipo)
          setSubmitError('Ya había una carga de este tipo en curso. Mostrando su progreso.')
        } else {
          setConflictNoJobId(true)
          setSubmitError(err.message || 'Ya hay una carga de este tipo en curso. Espera a que termine.')
        }
      } else {
        setSubmitError(err.message || 'No se pudo iniciar la carga.')
      }
    } finally {
      setIsStarting(false)
    }
  }, [])

  const dismiss = useCallback(() => {
    clearStoredJob()
    setJobId(null)
    setTipoCarga(null)
    setSubmitError(null)
    setConflictNoJobId(false)
  }, [])

  const isRunning = Boolean(jobId) && (!job || job.status === 'running')

  return {
    jobId,
    tipoCarga,
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
