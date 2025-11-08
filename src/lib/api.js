const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001'

async function http(method, path, body) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HTTP ${res.status}: ${text}`)
    }
    return res.json()
  } catch (err) {
    if (err.message.includes('fetch')) {
      throw new Error('Backend no disponible. Verifica que el servidor esté corriendo.')
    }
    throw err
  }
}

export const listBlueprints = (author) => http('GET', `/api/blueprints?author=${encodeURIComponent(author)}`)
export const getBlueprint = (author, name) => http('GET', `/api/blueprints/${encodeURIComponent(author)}/${encodeURIComponent(name)}`)
export const createBlueprint = (author, name) => http('POST', '/api/blueprints', { author, name, points: [] })
export const updateBlueprint = (author, name, points) => http('PUT', `/api/blueprints/${encodeURIComponent(author)}/${encodeURIComponent(name)}`, { points })
export const deleteBlueprint = (author, name) => http('DELETE', `/api/blueprints/${encodeURIComponent(author)}/${encodeURIComponent(name)}`)
