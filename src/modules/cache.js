/**
 * localStorage-backed cache helpers for observations and county context GeoJSON.
 * All functions are pure I/O — no module-level state.
 */

// ---------------------------------------------------------------------------
// Notable observations cache  (key: "notables:<countyRegion>")
// ---------------------------------------------------------------------------

export function buildNotablesCacheKey(countyRegion) {
  return countyRegion ? `notables:${countyRegion}` : null
}

/**
 * Persist a notables API result to localStorage.
 * No-ops silently on storage errors or empty observation arrays.
 */
export function saveNotablesCache(countyRegion, result, meta = {}) {
  const cacheKey = buildNotablesCacheKey(countyRegion)
  if (!cacheKey) return
  if (!Array.isArray(result?.observations) || result.observations.length === 0) return

  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      meta,
      result,
    }))
  } catch {
    // ignore storage errors (e.g. quota exceeded)
  }
}

/**
 * Load a cached notables result from localStorage.
 * Returns null if the entry is absent, unparseable, or older than `maxAgeMs`.
 * Attaches the stored `meta` object as `result.__meta` for downstream use.
 */
export function loadNotablesCache(countyRegion, maxAgeMs = 6 * 60 * 60 * 1000) {
  const cacheKey = buildNotablesCacheKey(countyRegion)
  if (!cacheKey) return null

  try {
    const raw = localStorage.getItem(cacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const age = Date.now() - Number(parsed.timestamp || 0)
    if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) return null
    const result = parsed.result || null
    if (result && typeof result === 'object' && parsed.meta && typeof parsed.meta === 'object') {
      try {
        result.__meta = parsed.meta
      } catch {
        // ignore
      }
    }
    return result
  } catch {
    return null
  }
}

/**
 * Extract the `daysBack` value stored in a cache entry's metadata.
 * Returns null if absent or out of range.
 */
export function getCacheDaysBack(cached) {
  const raw = Number(cached?.__meta?.daysBack)
  if (!Number.isFinite(raw)) return null
  const days = Math.round(raw)
  if (days < 1 || days > 14) return null
  return days
}

// ---------------------------------------------------------------------------
// County context (outline GeoJSON) cache  (key: "county_context:<lat>,<lng>")
// ---------------------------------------------------------------------------

export function countyContextCacheKey(lat, lng) {
  const nLat = Number(lat)
  const nLng = Number(lng)
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null
  return `county_context:${nLat.toFixed(2)},${nLng.toFixed(2)}`
}

/**
 * Store county outline GeoJSON for a lat/lng position.
 * TTL is 24 hours by default (enforced on load, not here).
 */
export function saveCountyContextCache(lat, lng, geojson) {
  const key = countyContextCacheKey(lat, lng)
  if (!key) return
  try {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), geojson }))
  } catch {
    // ignore storage errors
  }
}

/**
 * Load county outline GeoJSON from cache.
 * Returns null if absent, unparseable, or older than `maxAgeMs` (default 24 h).
 */
export function loadCountyContextCache(lat, lng, maxAgeMs = 24 * 60 * 60 * 1000) {
  const key = countyContextCacheKey(lat, lng)
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.geojson) return null
    const age = Date.now() - Number(parsed.timestamp || 0)
    if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) return null
    return parsed.geojson
  } catch {
    return null
  }
}
