// Compatibility shim.
// The authoritative species dataset now lives in species-reference.json.

import { SPECIES_REFERENCE, getSpeciesReference } from './species-reference.js'

export const YOLO_CODES = Object.fromEntries(
  Object.entries(SPECIES_REFERENCE)
    .filter(([, info]) => Number.isFinite(Number(info?.yoloCode)))
    .map(([name, info]) => [name, Math.round(Number(info.yoloCode))])
)

export function getYoloSpeciesInfo(speciesName) {
  return getSpeciesReference(speciesName)
}
