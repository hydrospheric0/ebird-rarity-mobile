/**
 * Pure GeoJSON / planar-geometry utilities.
 * No external imports, no side-effects.
 */

/**
 * Haversine great-circle distance between two lat/lng points (kilometres).
 */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Ray-casting test: is (lng, lat) inside a single polygon ring?
 */
export function pointInRing(lng, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i]?.[0])
    const yi = Number(ring[i]?.[1])
    const xj = Number(ring[j]?.[0])
    const yj = Number(ring[j]?.[1])
    if (!Number.isFinite(xi) || !Number.isFinite(yi) || !Number.isFinite(xj) || !Number.isFinite(yj)) continue
    const intersects = ((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi)
    if (intersects) inside = !inside
  }
  return inside
}

/**
 * Is (lng, lat) inside a GeoJSON Polygon coordinate array (outer ring + holes)?
 */
export function pointInPolygon(lng, lat, polygonCoords) {
  if (!Array.isArray(polygonCoords) || polygonCoords.length === 0) return false
  const outer = polygonCoords[0]
  if (!Array.isArray(outer) || outer.length < 3) return false
  if (!pointInRing(lng, lat, outer)) return false
  for (let index = 1; index < polygonCoords.length; index += 1) {
    const hole = polygonCoords[index]
    if (Array.isArray(hole) && hole.length >= 3 && pointInRing(lng, lat, hole)) {
      return false
    }
  }
  return true
}

/**
 * Does a GeoJSON Feature (Polygon or MultiPolygon) contain the given point?
 */
export function featureContainsPoint(feature, lng, lat) {
  const geometry = feature?.geometry
  if (!geometry) return false
  if (geometry.type === 'Polygon') {
    return pointInPolygon(lng, lat, geometry.coordinates)
  }
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates)
      && geometry.coordinates.some((polygonCoords) => pointInPolygon(lng, lat, polygonCoords))
  }
  return false
}

/**
 * Validate and close a GeoJSON ring (array of [lng, lat] pairs).
 * Returns null if the ring has fewer than 3 valid points.
 */
export function normalizeRingCoordinates(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null
  const points = ring
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null
      const lng = Number(point[0])
      const lat = Number(point[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
      return [lng, lat]
    })
    .filter(Boolean)

  if (points.length < 3) return null

  const first = points[0]
  const last = points[points.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    points.push([first[0], first[1]])
  }

  return points
}

/**
 * Build a world-polygon-with-holes inverse mask from a set of active county
 * features.  The result can be used as a Leaflet GeoJSON layer to darken
 * everything *outside* the active county.
 */
export function buildInverseMaskFeaturesFromActiveFeatures(activeFeatures) {
  const holes = []

  ;(Array.isArray(activeFeatures) ? activeFeatures : []).forEach((feature) => {
    const geometry = feature?.geometry
    if (!geometry) return

    if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
      const outerRing = normalizeRingCoordinates(geometry.coordinates[0])
      if (outerRing) holes.push(outerRing)
      return
    }

    if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
      geometry.coordinates.forEach((polygonCoordinates) => {
        if (!Array.isArray(polygonCoordinates)) return
        const outerRing = normalizeRingCoordinates(polygonCoordinates[0])
        if (outerRing) holes.push(outerRing)
      })
    }
  })

  if (!holes.length) return []

  const worldRing = [
    [-180, -90],
    [-180, 90],
    [180, 90],
    [180, -90],
    [-180, -90],
  ]

  return [{
    type: 'Feature',
    properties: {
      isInverseMask: true,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [worldRing, ...holes],
    },
  }]
}
