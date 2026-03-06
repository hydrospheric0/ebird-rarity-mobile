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

function getRingAreaAndCentroid(ring) {
  const normalized = normalizeRingCoordinates(ring)
  if (!normalized || normalized.length < 4) return null

  let twiceArea = 0
  let centroidLngTimes6Area = 0
  let centroidLatTimes6Area = 0

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const [x1, y1] = normalized[index]
    const [x2, y2] = normalized[index + 1]
    const cross = (x1 * y2) - (x2 * y1)
    twiceArea += cross
    centroidLngTimes6Area += (x1 + x2) * cross
    centroidLatTimes6Area += (y1 + y2) * cross
  }

  if (Math.abs(twiceArea) < 1e-12) return null

  return {
    area: twiceArea / 2,
    lng: centroidLngTimes6Area / (3 * twiceArea),
    lat: centroidLatTimes6Area / (3 * twiceArea),
  }
}

function getPolygonAreaAndCentroid(polygonCoords) {
  if (!Array.isArray(polygonCoords) || polygonCoords.length === 0) return null

  const outer = getRingAreaAndCentroid(polygonCoords[0])
  if (!outer) return null

  let weightedArea = Math.abs(outer.area)
  let weightedLng = outer.lng * weightedArea
  let weightedLat = outer.lat * weightedArea

  for (let index = 1; index < polygonCoords.length; index += 1) {
    const hole = getRingAreaAndCentroid(polygonCoords[index])
    if (!hole) continue
    const holeArea = Math.abs(hole.area)
    weightedArea -= holeArea
    weightedLng -= hole.lng * holeArea
    weightedLat -= hole.lat * holeArea
  }

  if (weightedArea <= 1e-12) {
    return { area: Math.abs(outer.area), lng: outer.lng, lat: outer.lat }
  }

  return {
    area: weightedArea,
    lng: weightedLng / weightedArea,
    lat: weightedLat / weightedArea,
  }
}

function getFeatureBoundingBox(feature) {
  const geometry = feature?.geometry
  if (!geometry) return null
  const coords = []

  if (geometry.type === 'Polygon') coords.push(geometry.coordinates)
  else if (geometry.type === 'MultiPolygon') coords.push(...(Array.isArray(geometry.coordinates) ? geometry.coordinates : []))
  else return null

  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity

  coords.forEach((polygon) => {
    ;(Array.isArray(polygon) ? polygon : []).forEach((ring) => {
      ;(Array.isArray(ring) ? ring : []).forEach((point) => {
        const lng = Number(point?.[0])
        const lat = Number(point?.[1])
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      })
    })
  })

  if (!Number.isFinite(minLng) || !Number.isFinite(maxLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLat)) return null
  return { minLng, maxLng, minLat, maxLat }
}

function findInteriorPointNearTarget(feature, targetLng, targetLat) {
  const bbox = getFeatureBoundingBox(feature)
  if (!bbox) return null

  const { minLng, maxLng, minLat, maxLat } = bbox
  const steps = 12
  let best = null
  let bestDistance = Infinity

  for (let y = 0; y <= steps; y += 1) {
    const lat = minLat + ((maxLat - minLat) * y) / steps
    for (let x = 0; x <= steps; x += 1) {
      const lng = minLng + ((maxLng - minLng) * x) / steps
      if (!featureContainsPoint(feature, lng, lat)) continue
      const distanceSq = ((lng - targetLng) ** 2) + ((lat - targetLat) ** 2)
      if (distanceSq < bestDistance) {
        bestDistance = distanceSq
        best = { lng, lat }
      }
    }
  }

  return best
}

export function getFeatureVisualCenter(feature) {
  const geometry = feature?.geometry
  if (!geometry) return null

  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates) ? geometry.coordinates : null)

  if (!polygons || !polygons.length) return null

  const polygonCenters = polygons
    .map((polygon) => getPolygonAreaAndCentroid(polygon))
    .filter(Boolean)
    .sort((a, b) => b.area - a.area)

  if (!polygonCenters.length) return null

  const primary = polygonCenters[0]
  if (featureContainsPoint(feature, primary.lng, primary.lat)) {
    return { lng: primary.lng, lat: primary.lat }
  }

  const interior = findInteriorPointNearTarget(feature, primary.lng, primary.lat)
  if (interior) return interior

  return { lng: primary.lng, lat: primary.lat }
}
