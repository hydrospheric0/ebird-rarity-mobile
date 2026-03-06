import { PROD_WORKER_URL } from './worker-url.js'

const DEV_PROXY_BASE = '/worker'

export const API_BASE_URL = import.meta.env.DEV
  ? DEV_PROXY_BASE
  : (import.meta.env.VITE_API_BASE_URL || PROD_WORKER_URL)

export async function fetchWorkerHealth(apiKey = null) {
  let response
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 9000)
  try {
    const headers = {}
    const key = String(apiKey || '').trim()
    if (key) headers['X-eBirdApiToken'] = key
    response = await fetch(`${API_BASE_URL}/api/regions?country=US`, { cache: 'no-store', headers, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Health check timed out after 9s.')
    const details = error instanceof Error ? error.message : String(error)
    throw new Error(`Network/CORS error: ${details}. If you see origin permission issues, use the Vite dev URL so /worker proxy is active.`)
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new Error(`Worker request failed: ${response.status}`)
  }
  return response.json()
}
