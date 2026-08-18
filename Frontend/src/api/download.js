import { getToken } from './client'

const BASE_URL = '/api'

export async function downloadFile(path, fallbackFilename) {
  const token = getToken()
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!response.ok) {
    let detail = 'No se pudo generar la descarga'
    try {
      const body = await response.json()
      detail = body.detail ?? detail
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new Error(detail)
  }

  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename=([^;]+)/)
  const filename = match ? match[1].trim() : fallbackFilename

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
