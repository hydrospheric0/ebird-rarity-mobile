import SPECIES_REFERENCE_DATA from './species-reference.json'

const { species = {}, statusCodes = {}, avibaseStatusCodes = {} } = SPECIES_REFERENCE_DATA || {}

export const STATUS_CODES = statusCodes
export const AVIBASE_STATUS_CODES = avibaseStatusCodes

function normalizeSpeciesName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

let speciesLookupIndex = null

function buildSpeciesLookupIndex() {
  if (speciesLookupIndex) return speciesLookupIndex

  const index = new Map()
  Object.entries(species).forEach(([speciesName, info]) => {
    if (!info || typeof info !== 'object') return

    const aliases = Array.isArray(info.aliases) ? info.aliases.filter(Boolean) : []
    const payload = {
      name: speciesName,
      yoloCode: Number.isFinite(Number(info.yoloCode)) ? Math.round(Number(info.yoloCode)) : null,
      code4: info.code4 || null,
      code6: info.code6 || null,
      status: info.status || null,
      statusCode: info.status ? (STATUS_CODES[info.status] || null) : null,
      avibaseStatus: info.avibaseStatus || null,
      avibaseStatusCode: info.avibaseStatus ? (AVIBASE_STATUS_CODES[info.avibaseStatus] || null) : null,
      scientificName: info.scientificName || null,
      order: info.order || null,
      family: info.family || null,
      aliases,
    }

    const keys = [speciesName, ...aliases]
      .map(normalizeSpeciesName)
      .filter(Boolean)

    keys.forEach((key) => {
      if (!index.has(key)) index.set(key, payload)
    })
  })

  speciesLookupIndex = index
  return speciesLookupIndex
}

export function getSpeciesReference(speciesName) {
  if (!speciesName) return null
  const key = normalizeSpeciesName(speciesName)
  if (!key) return null
  const index = buildSpeciesLookupIndex()
  return index.get(key) || null
}

export function getYoloSpeciesInfo(speciesName) {
  return getSpeciesReference(speciesName)
}

export function getSpeciesMapLabel(speciesName) {
  const info = getSpeciesReference(speciesName)
  if (!info) return speciesName
  return info.code4 || info.code6 || speciesName
}

export const SPECIES_REFERENCE = species
