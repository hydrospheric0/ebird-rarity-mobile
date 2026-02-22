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

function normalizeCodeToken(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()
}

function stripParenthetical(value) {
  return String(value || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractParentheticalCode(value) {
  const match = String(value || '').match(/\(([A-Za-z0-9]{3,8})\)/)
  return match ? normalizeCodeToken(match[1]) : ''
}

function computeFallbackCode4(speciesName) {
  const raw = stripParenthetical(speciesName)
  const cleaned = String(raw || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''

  // Expand hyphenated tokens (e.g. Rufous-capped -> Rufous + capped)
  const parts = cleaned
    .split(' ')
    .flatMap((t) => t.split('-'))
    .map((t) => t.trim())
    .filter(Boolean)

  const stop = new Set(['and', 'of', 'the', 'a', 'an'])
  const tokens = parts.filter((t) => !stop.has(t))
  if (!tokens.length) return ''

  const take = (t, n) => String(t || '').slice(0, n)
  let code = ''
  if (tokens.length >= 4) {
    code = tokens.slice(0, 4).map((t) => take(t, 1)).join('')
  } else if (tokens.length === 3) {
    code = take(tokens[0], 1) + take(tokens[1], 1) + take(tokens[2], 2)
  } else if (tokens.length === 2) {
    code = take(tokens[0], 2) + take(tokens[1], 2)
  } else {
    code = take(tokens[0], 4)
  }

  const normalized = normalizeCodeToken(code)
  return normalized.length === 4 ? normalized : ''
}

const ABA_CODE_OVERRIDES = new Map([
  ['northern yellow warbler', 1],
  ['yellow warbler', 1],
  ['mangrove yellow warbler', 3],
  ['YEWA', 1],
  ['FEPE', 3],
])

const CODE4_OVERRIDES = new Map([
  ['green winged teal eurasian', 'EGWT'],
])

let speciesLookupIndex = null
let speciesCodeLookupIndex = null

function buildSpeciesLookupIndex() {
  if (speciesLookupIndex && speciesCodeLookupIndex) return speciesLookupIndex

  const index = new Map()
  const codeIndex = new Map()
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

    const code4 = normalizeCodeToken(info.code4)
    const code6 = normalizeCodeToken(info.code6)
    if (code4 && !codeIndex.has(code4)) codeIndex.set(code4, payload)
    if (code6 && !codeIndex.has(code6)) codeIndex.set(code6, payload)
  })

  speciesLookupIndex = index
  speciesCodeLookupIndex = codeIndex
  return speciesLookupIndex
}

export function getSpeciesReference(speciesName) {
  if (!speciesName) return null
  const rawName = String(speciesName || '')
  const key = normalizeSpeciesName(rawName)
  const strippedKey = normalizeSpeciesName(stripParenthetical(rawName))
  const parenCode = extractParentheticalCode(rawName)
  const tokenCode = normalizeCodeToken(rawName)
  const index = buildSpeciesLookupIndex()
  if (key && index.has(key)) return index.get(key) || null
  if (strippedKey && index.has(strippedKey)) return index.get(strippedKey) || null
  if (parenCode && speciesCodeLookupIndex?.has(parenCode)) return speciesCodeLookupIndex.get(parenCode) || null
  if (tokenCode && speciesCodeLookupIndex?.has(tokenCode)) return speciesCodeLookupIndex.get(tokenCode) || null
  return null
}

export function getYoloSpeciesInfo(speciesName) {
  return getSpeciesReference(speciesName)
}

export function getAbaCodeOverride(speciesName, speciesCode = null) {
  const normalizedName = normalizeSpeciesName(speciesName)
  if (normalizedName && ABA_CODE_OVERRIDES.has(normalizedName)) {
    return ABA_CODE_OVERRIDES.get(normalizedName)
  }

  const normalizedCode = normalizeCodeToken(speciesCode)
  if (normalizedCode && ABA_CODE_OVERRIDES.has(normalizedCode)) {
    return ABA_CODE_OVERRIDES.get(normalizedCode)
  }

  const info = getSpeciesReference(speciesName)
  const code4 = normalizeCodeToken(info?.code4)
  if (code4 && ABA_CODE_OVERRIDES.has(code4)) {
    return ABA_CODE_OVERRIDES.get(code4)
  }

  return null
}

export function getSpeciesMapLabel(speciesName) {
  const normalizedName = normalizeSpeciesName(speciesName)
  if (normalizedName && CODE4_OVERRIDES.has(normalizedName)) {
    return CODE4_OVERRIDES.get(normalizedName)
  }
  const info = getSpeciesReference(speciesName)
  if (info) {
    return info.code4 || info.code6 || speciesName
  }

  const fallback = computeFallbackCode4(speciesName)
  return fallback || speciesName
}

export const SPECIES_REFERENCE = species
