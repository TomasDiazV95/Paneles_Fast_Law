import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

const DEFAULT_INTERVAL_MS = 3000

/**
 * Pollea GET `${basePath}/${jobId}` cada `intervalMs` mientras el job
 * devuelto tenga status "running", y se detiene automáticamente al llegar a
 * un estado terminal. Lógica compartida por los distintos jobs en background
 * del sistema (actualización de paneles, carga de archivos, recálculo
 * disparado por una carga) para no reimplementar el polling en cada hook.
 */
export function useJobPolling(jobId, basePath, { intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  const [job, setJob] = useState(null)
  const [pollError, setPollError] = useState(null)

  useEffect(() => {
    setJob(null)
    setPollError(null)
    if (!jobId) return undefined

    let cancelled = false
    let intervalId = null

    async function fetchStatus() {
      try {
        const data = await apiFetch(`${basePath}/${jobId}`)
        if (cancelled) return
        setJob(data)
        setPollError(null)
        if (data.status !== 'running' && intervalId) {
          clearInterval(intervalId)
        }
      } catch (err) {
        if (!cancelled) setPollError(err.message)
      }
    }

    fetchStatus()
    intervalId = setInterval(fetchStatus, intervalMs)

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [jobId, basePath, intervalMs])

  return { job, pollError }
}
