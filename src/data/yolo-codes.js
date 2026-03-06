/**
 * @deprecated Unused compatibility shim — do not import.
 * The authoritative species dataset lives in species-reference.json / species-reference.js.
 * This file is retained only to avoid breaking any external references and may be removed
 * in a future cleanup.
 */

import { SPECIES_REFERENCE, getSpeciesReference } from './species-reference.js'

export const YOLO_CODES = Object.fromEntries(
  Object.entries(SPECIES_REFERENCE)
    .filter(([, info]) => Number.isFinite(Number(info?.yoloCode)))
    .map(([name, info]) => [name, Math.round(Number(info.yoloCode))])
)

export function getYoloSpeciesInfo(speciesName) {
  return getSpeciesReference(speciesName)
}
