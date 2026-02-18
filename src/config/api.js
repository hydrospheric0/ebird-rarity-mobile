const DEV_PROXY_BASE = '/worker'
const PROD_DEFAULT_BASE = 'https://ebird-rarity-mapper.bartwickel.workers.dev'

export const API_BASE_URL = import.meta.env.DEV
  ? DEV_PROXY_BASE
  : (import.meta.env.VITE_API_BASE_URL || PROD_DEFAULT_BASE)

export async function fetchWorkerHealth() {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/api/regions?country=US`, { cache: 'no-store' })
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    throw new Error(`Network/CORS error: ${details}. If you see origin permission issues, use the Vite dev URL so /worker proxy is active.`)
  }

  if (!response.ok) {
    throw new Error(`Worker request failed: ${response.status}`)
  }
  return response.json()
}
