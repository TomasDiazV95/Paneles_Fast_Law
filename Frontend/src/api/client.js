const BASE_URL = '/api'
const TOKEN_KEY = 'access_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function handleResponse(response) {
  if (!response.ok) {
    let detail = 'Ocurrió un error inesperado'
    let body = null
    try {
      body = await response.json()
      detail = body?.detail ?? detail
    } catch {
      // respuesta sin cuerpo JSON
    }
    const error = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
    error.status = response.status
    error.body = body
    throw error
  }

  if (response.status === 204) return null
  return response.json()
}

export async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  return handleResponse(response)
}

// Igual que apiFetch, pero sin forzar Content-Type: al pasar un FormData como
// body, el navegador arma el boundary de multipart/form-data automáticamente.
// Forzar 'application/json' aquí rompería la subida de archivos.
export async function apiUpload(path, formData) {
  const token = getToken()
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  })
  return handleResponse(response)
}
