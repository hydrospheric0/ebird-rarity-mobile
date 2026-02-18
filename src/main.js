import './styles.css'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { API_BASE_URL, fetchWorkerHealth } from './config/api.js'
import { getYoloSpeciesInfo, getSpeciesMapLabel } from './data/species-reference.js'

const BUILD_TAG = typeof __BUILD_TAG__ !== 'undefined' ? __BUILD_TAG__ : 'dev'

const app = document.querySelector('#app')

app.innerHTML = `
  <div id="appShell" class="app-shell">
    <header class="app-header">
      <h1 class="app-title">eBird Rarities</h1>

      <div class="top-menu" aria-label="Top menu">
        <select id="headerCountySelect" class="top-menu-select" aria-label="County">
          <option value="">Loading…</option>
        </select>
        <select id="headerDaysBackSelect" class="top-menu-select" aria-label="Days back">
          <option value="1">1</option>
          <option value="3">3</option>
          <option value="7" selected>7</option>
          <option value="14">14</option>
        </select>
      </div>

      <section id="statusPopover" class="status-popover status-hidden" aria-hidden="true">
        <div class="row">
          <span>API Connectivity</span>
          <span id="apiStatus" class="badge warn">Checking...</span>
        </div>
        <p id="apiDetail" class="detail"></p>
        <p id="buildInfo" class="detail">Build: pending</p>

        <div class="row">
          <span>Perf</span>
          <span id="perfBadge" class="badge" style="font-size:0.65rem;letter-spacing:0;min-width:0;padding:0.1rem 0.4rem">—</span>
        </div>
        <p id="perfDetail" class="detail" style="font-family:monospace;font-size:0.62rem;white-space:pre;line-height:1.55"></p>

        <div class="row">
          <span>My Location</span>
          <span id="locationStatus" class="badge warn">Waiting...</span>
        </div>
        <p id="locationDetail" class="detail">iOS tip: choose "Allow While Using App" and keep "Precise Location" enabled for fine-grained positioning.</p>
        <button id="retryLocation" class="primary" type="button">Use My Location</button>

        <div class="filter-group">
          <label for="filterDaysBack" class="filter-label">Days Back: <span id="filterDaysBackValue">14</span></label>
          <input id="filterDaysBack" class="filter-slider" type="range" min="1" max="14" value="14" step="1">
        </div>
        <div class="filter-group">
          <label for="filterAbaMin" class="filter-label">ABA Code ≥ <span id="filterAbaMinValue">1</span></label>
          <input id="filterAbaMin" class="filter-slider" type="range" min="1" max="6" value="1" step="1">
        </div>
      </section>
    </header>

    <section class="map-strip">
      <div id="map" class="map"></div>
      <div class="map-top-right">
        <button id="mapFullscreenToggle" class="map-ctrl-btn" type="button" aria-pressed="false" aria-label="Toggle fullscreen map" title="Fullscreen">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
        </button>
        <button id="mapBasemapToggle" class="map-ctrl-btn" type="button" aria-label="Toggle basemap" title="Toggle satellite/street">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
        </button>
        <button id="mapLocateBtn" class="map-ctrl-btn" type="button" aria-label="Zoom to my location" title="My location">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><polygon points="12,3 19,20 12,16 5,20"/></svg>
        </button>
        <button id="mapLabelToggle" class="map-ctrl-btn" type="button" aria-pressed="true" aria-label="Toggle point labels" title="Toggle labels">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><text x="12" y="17" text-anchor="middle" font-size="9" font-weight="700" font-family="sans-serif" fill="currentColor" stroke="none">B</text></svg>
        </button>
      </div>
      <div id="mapLoading" class="map-loading" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <span id="mapLoadingText">Loading map…</span>
      </div>
    </section>

    <main class="app-main">
      <section id="panelMap" class="panel active">
        <section class="card table-card">
          <div class="obs-stats-bar">
            <div class="stats-left">
              <span id="statTotal" class="obs-stat obs-stat-total" data-label="Total species" tabindex="0" role="button" title="Total species">—</span>
              <span id="statConfirmed" class="obs-stat obs-stat-confirmed" data-label="Confirmed" tabindex="0" role="button" title="Confirmed">—</span>
              <span id="statPending" class="obs-stat obs-stat-pending" data-label="Pending" tabindex="0" role="button" title="Pending">—</span>
              <div id="statsRight" class="stats-right"></div>
            </div>
          </div>
          <div id="countyPicker" class="county-picker" hidden>
            <div class="county-picker-title">Counties</div>
            <div id="countyPickerList" class="county-picker-list" role="listbox" aria-label="County list"></div>
          </div>
          <div id="abaCodePicker" class="county-picker" hidden>
            <div class="county-picker-title">ABA Codes</div>
            <div id="abaCodePickerList" class="county-picker-list" role="listbox" aria-label="ABA code list"></div>
          </div>
          <span id="notableCount" style="display:none">—</span>
          <p id="notableMeta" style="display:none"></p>
          <div class="table-wrap">
            <table class="notable-table">
              <thead>
                <tr>
                  <th class="col-species sortable" id="thSpecies" data-sort="aba">Species<span class="sort-icon" aria-hidden="true"> ↓</span></th>
                  <th class="col-status"></th>
                  <th class="col-date sortable" id="thLast" data-sort="last">Last<span class="sort-icon" aria-hidden="true"></span></th>
                  <th class="col-date sortable" id="thFirst" data-sort="first">First<span class="sort-icon" aria-hidden="true"></span></th>
                  <th class="col-reports">#</th>
                  <th class="col-vis"><input type="checkbox" id="toggleAllVis" title="Show / hide all" checked></th>
                  <th class="col-pin"></th>
                </tr>
              </thead>
              <tbody id="notableRows"></tbody>
            </table>
          </div>
          <p id="tableRenderStatus" class="detail" style="display:none">render: init</p>
        </section>
      </section>

      <section id="panelTable" class="panel">
        <section class="card">
          <h2>Table Mode</h2>
          <p class="detail">Table mode is the next step. Map mode is active first as requested.</p>
        </section>
      </section>
    </main>

    <nav class="bottom-menu" aria-label="Bottom menu">
      <button id="menuInfo" class="menu-btn" type="button" aria-label="Information">i</button>
      <button id="menuSearch" class="menu-btn icon-btn" type="button" aria-label="Search">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"></circle>
          <line x1="16" y1="16" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
        </svg>
      </button>
      <button id="menuPin" class="menu-btn icon-btn" type="button" aria-label="Pin (coming soon)">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 21s6-6.2 6-10a6 6 0 1 0-12 0c0 3.8 6 10 6 10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
          <circle cx="12" cy="11" r="2" fill="currentColor"></circle>
        </svg>
      </button>
      <button id="menuRefresh" class="menu-btn icon-btn" type="button" aria-label="Hard refresh">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          <polyline points="20 4 20 10 14 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
        </svg>
      </button>
    </nav>

    <div id="infoModal" class="app-modal" hidden>
      <div class="app-modal-backdrop" data-close="info"></div>
      <section class="app-modal-panel" role="dialog" aria-modal="true" aria-labelledby="infoTitle">
        <h2 id="infoTitle">About this page</h2>
        <p>This mobile view shows nearby eBird county rarities with map + table syncing.</p>
        <p>Use the top menu to switch county and days back, and use search to filter region/species quickly.</p>
        <p>Technical diagnostics are available at <a href="./log.html">/log.html</a>.</p>
        <button id="infoCloseBtn" class="primary" type="button">Close</button>
      </section>
    </div>

    <div id="searchPopover" class="menu-popover" hidden>
      <div class="menu-popover-card" role="dialog" aria-modal="true" aria-labelledby="searchMenuTitle">
        <div id="searchMenuTitle" class="menu-popover-title">Search</div>
        <label class="menu-popover-field" for="searchRegionSelect">
          <span>Region:</span>
          <select id="searchRegionSelect" class="top-menu-select" aria-label="Search region"></select>
        </label>
        <label class="menu-popover-field" for="searchSpeciesSelect">
          <span>Species:</span>
          <select id="searchSpeciesSelect" class="top-menu-select" aria-label="Search species"></select>
        </label>
        <label class="menu-popover-field" for="searchDaysBackSelect">
          <span>Days Back:</span>
          <select id="searchDaysBackSelect" class="top-menu-select" aria-label="Search days back">
            <option value="1">1</option>
            <option value="3">3</option>
            <option value="7" selected>7</option>
            <option value="14">14</option>
          </select>
        </label>
        <div class="menu-popover-actions">
          <button id="searchApplyBtn" class="primary" type="button">Apply</button>
          <button id="searchCloseBtn" class="menu-btn" type="button">Close</button>
        </div>
      </div>
    </div>
  </div>
`

const apiStatus = document.querySelector('#apiStatus')
const apiDetail = document.querySelector('#apiDetail')
const buildInfo = document.querySelector('#buildInfo')
const locationStatus = document.querySelector('#locationStatus')
const locationDetail = document.querySelector('#locationDetail')
const retryLocationBtn = document.querySelector('#retryLocation')
const filterDaysBackInput = document.querySelector('#filterDaysBack')
const filterDaysBackValue = document.querySelector('#filterDaysBackValue')
const headerDaysBackSelect = document.querySelector('#headerDaysBackSelect')
const headerCountySelect = document.querySelector('#headerCountySelect')
const filterAbaMinInput = document.querySelector('#filterAbaMin')
const filterAbaMinValue = document.querySelector('#filterAbaMinValue')
const statusPopover = document.querySelector('#statusPopover')
const menuInfoBtn = document.querySelector('#menuInfo')
const menuSearchBtn = document.querySelector('#menuSearch')
const menuPinBtn = document.querySelector('#menuPin')
const menuRefreshBtn = document.querySelector('#menuRefresh')
const infoModal = document.querySelector('#infoModal')
const infoCloseBtn = document.querySelector('#infoCloseBtn')
const searchPopover = document.querySelector('#searchPopover')
const searchRegionSelect = document.querySelector('#searchRegionSelect')
const searchSpeciesSelect = document.querySelector('#searchSpeciesSelect')
const searchDaysBackSelect = document.querySelector('#searchDaysBackSelect')
const searchApplyBtn = document.querySelector('#searchApplyBtn')
const searchCloseBtn = document.querySelector('#searchCloseBtn')
const panelMap = document.querySelector('#panelMap')
const panelTable = document.querySelector('#panelTable')
const mapLoading = document.querySelector('#mapLoading')
const mapLoadingText = document.querySelector('#mapLoadingText')
const mapFullscreenToggleBtn = document.querySelector('#mapFullscreenToggle')
const mapBasemapToggleBtn = document.querySelector('#mapBasemapToggle')
const mapLocateBtn = document.querySelector('#mapLocateBtn')
const mapLabelToggleBtn = document.querySelector('#mapLabelToggle')
const mapCountyLabel = document.querySelector('#mapCountyLabel')
const appShell = document.querySelector('#appShell')
const notableCount = document.querySelector('#notableCount')
const notableMeta = document.querySelector('#notableMeta')
const statTotal = document.querySelector('#statTotal')
const statConfirmed = document.querySelector('#statConfirmed')
const statPending = document.querySelector('#statPending')
const statsRight = document.querySelector('#statsRight')
const countyPicker = document.querySelector('#countyPicker')
const countyPickerList = document.querySelector('#countyPickerList')
const abaCodePicker = document.querySelector('#abaCodePicker')
const abaCodePickerList = document.querySelector('#abaCodePickerList')
const notableRows = document.querySelector('#notableRows')
const tableRenderStatus = document.querySelector('#tableRenderStatus')
const perfBadge = document.querySelector('#perfBadge')
const perfDetail = document.querySelector('#perfDetail')
const API_TIMEOUT_MS = 8000
const COUNTY_NOTABLES_TIMEOUT_MS = 5500
const MAP_LABEL_MAX_POINTS = 80
const USER_LOCATION_ZOOM = 11
const MAP_POINTS_FIT_MAX_ZOOM = 10
const MAP_RENDER_BATCH_SIZE = 260
const BASE_TILE_OPTIONS = {
  updateWhenIdle: false,
  updateWhenZooming: false,
  keepBuffer: 8,
}

let map = null
let osmLayer = null
let satelliteLayer = null
let placeNameLayer = null
let mapPointRenderer = null
let currentBasemap = 'satellite'
let userDot = null
let accuracyCircle = null
let countyOverlay = null
let notableLayer = null
let speciesMarkers = new Map()
let neighborLayerRef = null
let activeOutlineLayerRef = null
let countyNameLayerRef = null
let countyDotLayerRef = null
let hiddenSpecies = new Set()
let isMapFullscreen = false
let labelsVisible = true
let lastUserLat = null
let lastUserLng = null
let currentTableData = [] // all rows for re-sorting
let sortState = { col: 'aba', dir: 'desc' } // col: 'aba'|'last'|'first', dir: 'asc'|'desc'
let latestLocationRequestId = 0
let latestNotablesLoadId = 0
let latestCountySwitchRequestId = 0
let currentRawObservations = []
let currentCountyName = null
let currentCountyRegion = null
const hiResCache = new Map() // countyRegion -> GeoJSON FeatureCollection
let hiResSwapInProgress = false
let currentActiveCountyCode = ''
let latestCountyContextGeojson = null
let filterDaysBack = 7
let filterAbaMin = 1
let selectedReviewFilter = null
let selectedSpecies = null
let countyPickerOptions = []
let selectedAbaCode = null
let abaCodePickerOptions = []
let lastMapRenderSignature = ''
let latestMapRenderId = 0
const countySummaryByRegion = new Map()

// ---------------------------------------------------------------------------
// Lightweight render-pipeline profiling
// ---------------------------------------------------------------------------
const PERF_STAGES = ['location', 'county', 'fetch', 'table', 'map']
const _perfStart = {}
const _perfResult = {}

function perfStart(stage) {
  _perfStart[stage] = performance.now()
}

function perfEnd(stage) {
  if (_perfStart[stage] == null) return
  _perfResult[stage] = Math.round(performance.now() - _perfStart[stage])
  delete _perfStart[stage]
  _updatePerfBadge()
}

function _updatePerfBadge() {
  if (!perfBadge) return
  const done = PERF_STAGES.filter((s) => _perfResult[s] != null)
  if (done.length === 0) return
  const total = done.reduce((sum, s) => sum + _perfResult[s], 0)
  const worst = done.reduce((m, s) => (_perfResult[s] > _perfResult[m] ? s : m), done[0])
  perfBadge.textContent = `${total} ms`
  perfBadge.className = `badge ${total < 1500 ? 'ok' : 'warn'}`
  if (perfDetail) {
    perfDetail.textContent = PERF_STAGES
      .filter((s) => _perfResult[s] != null)
      .map((s) => `${s.padEnd(9)}${String(_perfResult[s]).padStart(5)} ms${s === worst && done.length > 1 ? ' ◀' : ''}`)
      .join('\n')
  }
  updateRuntimeLog()
}

function perfReset() {
  PERF_STAGES.forEach((s) => { delete _perfResult[s]; delete _perfStart[s] })
  if (perfBadge) { perfBadge.textContent = '—'; perfBadge.className = 'badge' }
  if (perfDetail) perfDetail.textContent = ''
  updateRuntimeLog()
}
// ---------------------------------------------------------------------------
const countySummaryInFlight = new Set()
let countySummaryPrefetchToken = 0
let countyPickerRenderTimer = null
const mapLoadState = {
  location: false,
  activeCounty: false,
  stateMask: false,
  observations: false,
}

function setMapLoading(visible, text = 'Loading map…') {
  if (visible) {
    mapLoading.classList.add('visible')
    mapLoadingText.textContent = text
  } else {
    mapLoading.classList.remove('visible')
  }
}

function resetMapLoadState() {
  mapLoadState.location = false
  mapLoadState.activeCounty = false
  mapLoadState.stateMask = false
  mapLoadState.observations = false
  perfReset()
  setMapLoading(true, 'Loading map…')
}

function markMapPartReady(part) {
  mapLoadState[part] = true
  if (mapLoadState.location && mapLoadState.activeCounty && mapLoadState.stateMask && mapLoadState.observations) {
    setMapLoading(false)
  }
}

function nextAnimationFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
}

function isStaleLocationRequest(requestId) {
  return requestId !== latestLocationRequestId
}

function isStaleCountySwitchRequest(requestId) {
  return requestId !== latestCountySwitchRequestId
}

function isStaleNotablesLoad(loadId, requestId, countySwitchRequestId = null) {
  if (loadId !== latestNotablesLoadId) return true
  if (requestId !== null && isStaleLocationRequest(requestId)) return true
  if (countySwitchRequestId !== null && isStaleCountySwitchRequest(countySwitchRequestId)) return true
  return false
}

function cutoffDateForDaysBack(daysBack) {
  const days = Math.max(1, Number(daysBack) || 1)
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - (days - 1))
  return cutoff
}

function getAbaCodeNumber(item) {
  const rawCode = item?.abaCode ?? item?.abaRarityCode
  const code = Number(rawCode)
  return Number.isFinite(code) ? code : null
}

function applyActiveFiltersAndRender(options = {}) {
  const { renderMap = true, fitToObservations = false } = options
  const source = Array.isArray(currentRawObservations) ? currentRawObservations : []
  const cutoff = cutoffDateForDaysBack(filterDaysBack)
  const abaMin = Math.max(1, Number(filterAbaMin) || 1)
  const filteredByDays = source.filter((item) => {
    const obsDate = parseObsDate(item?.obsDt)
    if (!obsDate || obsDate < cutoff) return false
    return true
  })
  updateAbaCodePickerOptions(filteredByDays)
  const filteredByStatus = filteredByDays.filter((item) => {
    if (selectedReviewFilter === 'confirmed') return isConfirmedObservation(item)
    if (selectedReviewFilter === 'pending') return !isConfirmedObservation(item)
    return true
  })
  const filteredBySpecies = selectedSpecies
    ? filteredByStatus.filter((item) => String(item?.comName || '') === selectedSpecies)
    : filteredByStatus
  const abaPillSource = filteredBySpecies.filter((item) => {
    const code = getAbaCodeNumber(item)
    if (!Number.isFinite(code)) return false
    return code >= abaMin
  })
  const filtered = filteredBySpecies.filter((item) => {
    const code = getAbaCodeNumber(item)
    if (selectedAbaCode === 0) return !Number.isFinite(code)
    if (Number.isFinite(selectedAbaCode)) return Number.isFinite(code) && code === selectedAbaCode
    if (!Number.isFinite(code)) return false
    return code >= abaMin
  })
  refreshSearchSpeciesOptions(filteredByDays)
  renderNotableTable(filtered, currentCountyName, currentCountyRegion, abaPillSource)
  if (renderMap) {
    renderNotablesOnMap(filtered, (currentActiveCountyCode || currentCountyRegion || '').toUpperCase(), fitToObservations)
  }
  syncFilterPillUi()
  return filtered
}

function setPillExpandedLabel(pill, prefix) {
  if (!pill) return
  if (!pill.dataset.short || pill.textContent.includes(':')) {
    pill.dataset.short = pill.textContent.replace(/^.*?:\s*/, '').trim()
  }
  pill.textContent = `${prefix}: ${pill.dataset.short}`
  pill.classList.add('obs-stat-expanded')
}

function syncFilterPillUi() {
  setPillExpandedLabel(statConfirmed, 'Confirmed')
  setPillExpandedLabel(statPending, 'Pending')
  const abaPills = document.querySelectorAll('#statsRight .stat-aba-pill')
  abaPills.forEach((pill) => {
    const code = Number(pill.dataset.code)
    if (!pill.dataset.short || pill.textContent.includes('ABA')) pill.dataset.short = pill.textContent.replace(/^.*?:\s*/, '').trim()
    if (pill.dataset.short) pill.textContent = `ABA ${code}: ${pill.dataset.short}`
    pill.classList.add('obs-stat-expanded')
  })
}

function updateFilterUi() {
  if (filterDaysBackValue) filterDaysBackValue.textContent = String(filterDaysBack)
  if (filterAbaMinValue) filterAbaMinValue.textContent = String(filterAbaMin)
  if (headerDaysBackSelect && headerDaysBackSelect.value !== String(filterDaysBack)) headerDaysBackSelect.value = String(filterDaysBack)
  if (searchDaysBackSelect && searchDaysBackSelect.value !== String(filterDaysBack)) searchDaysBackSelect.value = String(filterDaysBack)
}

function closeCountyPicker() {
  if (!countyPicker) return
  countyPicker.setAttribute('hidden', 'hidden')
}

function closeAbaCodePicker() {
  if (!abaCodePicker) return
  abaCodePicker.setAttribute('hidden', 'hidden')
}

function toggleCountyPicker() {
  if (!countyPicker || !countyPickerList) return
  closeAbaCodePicker()
  if (countyPicker.hasAttribute('hidden')) countyPicker.removeAttribute('hidden')
  else countyPicker.setAttribute('hidden', 'hidden')
}

function toggleAbaCodePicker() {
  if (!abaCodePicker || !abaCodePickerList) return
  closeCountyPicker()
  if (abaCodePicker.hasAttribute('hidden')) abaCodePicker.removeAttribute('hidden')
  else abaCodePicker.setAttribute('hidden', 'hidden')
}

function updateAbaCodePickerOptions(source) {
  if (!abaCodePickerList) return
  const counts = new Map([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]])
  ;(Array.isArray(source) ? source : []).forEach((item) => {
    const code = getAbaCodeNumber(item)
    if (Number.isFinite(code) && code >= 1 && code <= 6) counts.set(code, (counts.get(code) || 0) + 1)
    else counts.set(0, (counts.get(0) || 0) + 1)
  })
  const allCount = Array.from(counts.values()).reduce((sum, val) => sum + val, 0)
  abaCodePickerOptions = [{ value: 'all', label: `Show all codes · ${allCount}` }]
  for (let code = 1; code <= 6; code += 1) {
    abaCodePickerOptions.push({ value: String(code), label: `ABA ${code} · ${counts.get(code) || 0}` })
  }
  abaCodePickerOptions.push({ value: '0', label: `ABA 0 (none) · ${counts.get(0) || 0}` })
  abaCodePickerList.innerHTML = abaCodePickerOptions
    .map((opt, index) => {
      const isActive = (opt.value === 'all' && selectedAbaCode === null) || Number(opt.value) === selectedAbaCode
      return `<button type="button" class="county-option${isActive ? ' is-active' : ''}" data-index="${index}" role="option" aria-selected="${isActive ? 'true' : 'false'}">${escapeHtml(opt.label)}</button>`
    })
    .join('')
}

function buildCountyGeojsonWithActiveRegion(sourceGeojson, countyRegion) {
  if (!sourceGeojson || !Array.isArray(sourceGeojson.features) || !countyRegion) return null
  const targetRegion = String(countyRegion).toUpperCase()
  let found = false
  const features = sourceGeojson.features.map((feature) => {
    const regionRaw = feature?.properties?.countyRegion || null
    const region = regionRaw ? String(regionRaw).toUpperCase() : null
    const isActive = region === targetRegion
    if (isActive) found = true
    return {
      ...feature,
      properties: {
        ...(feature?.properties || {}),
        countyRegion: regionRaw || null,
        isActiveCounty: isActive,
      },
    }
  })
  if (!found) return null
  return {
    ...sourceGeojson,
    activeCountyRegion: targetRegion,
    features,
  }
}

function getFeatureCenter(feature) {
  try {
    const layer = L.geoJSON(feature)
    const bounds = layer.getBounds()
    if (!bounds.isValid()) return null
    return bounds.getCenter()
  } catch {
    return null
  }
}

function zoomToActiveCounty(geojson, countyRegion = null) {
  if (!map || !geojson || !Array.isArray(geojson.features)) return
  const targetRegion = String(countyRegion || '').toUpperCase()
  const activeFeatures = geojson.features.filter((feature) => {
    if (feature?.properties?.isActiveCounty) return true
    if (!targetRegion) return false
    return String(feature?.properties?.countyRegion || '').toUpperCase() === targetRegion
  })
  if (!activeFeatures.length) return
  try {
    const bounds = L.geoJSON({ type: 'FeatureCollection', features: activeFeatures }).getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [22, 22], maxZoom: 10, animate: true })
    }
  } catch {
    // ignore zoom errors
  }
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function filterObservationsToCountyRegion(observations, countyRegion) {
  const target = String(countyRegion || '').toUpperCase()
  const source = Array.isArray(observations) ? observations : []
  if (!target) return source
  return source.filter((item) => String(item?.subnational2Code || '').toUpperCase() === target)
}

function summarizeCountyObservations(observations) {
  const grouped = new Map()
  ;(Array.isArray(observations) ? observations : []).forEach((item) => {
    const species = item?.comName || ''
    const state = String(item?.subnational1Code || '')
    const county = String(item?.subnational2Code || item?.subnational2Name || '')
    const key = `${species}::${state}::${county}`
    const rawCode = item?.abaCode ?? item?.abaRarityCode
    const code = Number(rawCode)
    const abaCode = Number.isFinite(code) ? Math.round(code) : 0
    if (!grouped.has(key)) {
      grouped.set(key, { abaCode })
      return
    }
    const existing = grouped.get(key)
    if (abaCode > existing.abaCode) existing.abaCode = abaCode
  })

  const abaCounts = new Map([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]])
  grouped.forEach((entry) => {
    const code = Number.isFinite(entry.abaCode) && entry.abaCode >= 1 && entry.abaCode <= 6 ? entry.abaCode : 0
    abaCounts.set(code, (abaCounts.get(code) || 0) + 1)
  })

  return {
    rarityCount: grouped.size,
    abaCounts,
  }
}

function formatCountySummary(summary) {
  if (!summary) return 'Rarities: — · ABA: —'
  const parts = []
  for (let code = 1; code <= 6; code += 1) {
    const count = summary.abaCounts.get(code) || 0
    if (count > 0) parts.push(`${code}:${count}`)
  }
  const none = summary.abaCounts.get(0) || 0
  if (none > 0) parts.push(`0:${none}`)
  const abaText = parts.length ? parts.join(' ') : 'none'
  return `Rarities: ${summary.rarityCount} · ABA ${abaText}`
}

function formatCountySummaryPills(summary) {
  if (!summary) return ''
  const pills = []
  for (let code = 1; code <= 6; code += 1) {
    const count = summary.abaCounts.get(code) || 0
    if (count > 0) {
      pills.push(`<span class="stat-aba-pill aba-code-${code}" title="ABA ${code}: ${count}">${count}</span>`)
    }
  }
  return pills.join('')
}

function scheduleCountyPickerRender() {
  if (countyPickerRenderTimer) return
  countyPickerRenderTimer = window.setTimeout(() => {
    countyPickerRenderTimer = null
    renderCountyPickerOptions()
    updateCountyDots()
  }, 50)
}

function getCountySummary(region, isActive) {
  if (isActive) {
    const activeSummary = summarizeCountyObservations(currentRawObservations)
    if (region) countySummaryByRegion.set(region, activeSummary)
    return activeSummary
  }
  if (region && countySummaryByRegion.has(region)) {
    return countySummaryByRegion.get(region) || null
  }
  const cached = loadNotablesCache(region)
  if (!cached || !Array.isArray(cached.observations) || cached.observations.length === 0) return null
  const summary = summarizeCountyObservations(filterObservationsToCountyRegion(cached.observations, region))
  if (region) countySummaryByRegion.set(region, summary)
  return summary
}

function renderCountyPickerOptions() {
  if (!countyPickerList) return
  countyPickerList.innerHTML = countyPickerOptions
    .map((opt, index) => {
      const activeClass = opt.isActive ? ' is-active' : ''
      const summary = getCountySummary(opt.countyRegion, opt.isActive)
      const pillsHtml = formatCountySummaryPills(summary)
      return `<button type="button" class="county-option${activeClass}" data-index="${index}" role="option" aria-selected="${opt.isActive ? 'true' : 'false'}"><span class="county-option-name">${escapeHtml(opt.countyName)}</span><span class="county-option-meta county-option-meta-pills">${pillsHtml}</span></button>`
    })
    .join('')
}

// ABA dot colors matching canvas overlay palette
const DOT_ABA_COLORS = {
  1: '#067bc2', 2: '#84bcda', 3: '#ecc30b', 4: '#f37748', 5: '#ED1313', 6: '#ed13d4',
}

function updateCountyDots() {
  if (!map || !countyPickerOptions.length) return

  if (!countyDotLayerRef) {
    countyDotLayerRef = L.layerGroup({ pane: 'countyDotPane' }).addTo(map)
  }
  countyDotLayerRef.clearLayers()

  for (const opt of countyPickerOptions) {
    if (opt.isActive) continue
    if (!opt.countyRegion || !Number.isFinite(opt.lat) || !Number.isFinite(opt.lng)) continue

    const summary = getCountySummary(opt.countyRegion, false)
    const rarityCount = summary?.rarityCount || 0

    // Pick color from highest ABA code present
    let dotColor = '#64748b'
    if (summary) {
      for (let code = 6; code >= 1; code--) {
        if ((summary.abaCounts.get(code) || 0) > 0) { dotColor = DOT_ABA_COLORS[code]; break }
      }
    }

    const countText = rarityCount > 0 ? String(rarityCount) : ''
    const markerHtml = `
      <div class="county-dot-marker">
        <span class="cdot-name">${escapeHtml(opt.countyName)}</span>
        <span class="cdot-circle" style="background:${dotColor}">${countText}</span>
      </div>
    `

    const dot = L.marker([opt.lat, opt.lng], {
      pane: 'countyDotPane',
      icon: L.divIcon({
        className: 'county-dot-icon',
        html: markerHtml,
        iconSize: [88, 38],
        iconAnchor: [44, 22],
      }),
      interactive: true,
    })

    dot.on('click', (e) => {
      L.DomEvent.stopPropagation(e)
      loadNeighborCounty(opt.lat, opt.lng, opt.countyRegion, opt.countyName)
    })

    countyDotLayerRef.addLayer(dot)
  }
}

async function prefetchCountySummariesForPicker(options) {
  if (!Array.isArray(options) || options.length === 0) return
  if (!Number.isFinite(lastUserLat) || !Number.isFinite(lastUserLng)) return

  const token = ++countySummaryPrefetchToken
  const targets = options.filter((opt) => opt?.countyRegion && !opt.isActive)
  let pointer = 0
  const workers = Math.min(3, targets.length)

  const runWorker = async () => {
    while (pointer < targets.length) {
      if (token !== countySummaryPrefetchToken) return
      const currentIndex = pointer
      pointer += 1
      const region = targets[currentIndex]?.countyRegion
      if (!region || countySummaryByRegion.has(region) || countySummaryInFlight.has(region)) continue

      countySummaryInFlight.add(region)
      try {
        const cached = loadNotablesCache(region)
        if (Array.isArray(cached?.observations) && cached.observations.length > 0) {
          const scoped = filterObservationsToCountyRegion(cached.observations, region)
          countySummaryByRegion.set(region, summarizeCountyObservations(scoped))
          scheduleCountyPickerRender()
          // Also pre-warm hi-res boundary for this neighbor
          void fetchCountyHiRes(region).catch(() => {})
          continue
        }

        const result = await fetchCountyNotablesWithRetry(lastUserLat, lastUserLng, 14, region, 1)
        if (!Array.isArray(result?.observations) || result.observations.length === 0) continue
        saveNotablesCache(region, result)
        const scoped = filterObservationsToCountyRegion(result.observations, region)
        countySummaryByRegion.set(region, summarizeCountyObservations(scoped))
        scheduleCountyPickerRender()
        // Pre-warm hi-res boundary for this neighbor
        void fetchCountyHiRes(region).catch(() => {})
      } catch {
        // ignore county summary prefetch failures
      } finally {
        countySummaryInFlight.delete(region)
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => runWorker()))
}

function refreshCountyPickerSummaries() {
  if (!latestCountyContextGeojson) return
  updateCountyPickerFromGeojson(latestCountyContextGeojson)
}

function updateRuntimeLog() {
  try {
    localStorage.setItem('mrm_runtime_log', JSON.stringify({
      timestamp: new Date().toISOString(),
      buildTag: BUILD_TAG,
      apiStatus: apiStatus?.textContent || '',
      apiDetail: apiDetail?.textContent || '',
      locationStatus: locationStatus?.textContent || '',
      locationDetail: locationDetail?.textContent || '',
      county: currentCountyName || '',
      countyRegion: currentCountyRegion || '',
      filters: {
        daysBack: filterDaysBack,
        abaMin: filterAbaMin,
        species: selectedSpecies,
      },
      perf: perfDetail?.textContent || '',
    }))
  } catch {
    // ignore storage failures
  }
}

function refreshHeaderCountyOptions() {
  if (!headerCountySelect) return
  const options = countyPickerOptions
  if (!Array.isArray(options) || options.length === 0) {
    headerCountySelect.innerHTML = ''
    const loadingOption = document.createElement('option')
    loadingOption.value = ''
    loadingOption.textContent = 'Loading…'
    headerCountySelect.appendChild(loadingOption)
    return
  }
  const activeRegion = String(currentCountyRegion || '').toUpperCase()
  headerCountySelect.innerHTML = ''
  options.forEach((opt, index) => {
    const optionEl = document.createElement('option')
    optionEl.value = String(opt.countyRegion || '')
    optionEl.textContent = String(opt.countyName || 'Unknown county')
    optionEl.dataset.index = String(index)
    headerCountySelect.appendChild(optionEl)
  })
  const selectedIndex = options.findIndex((opt) => String(opt.countyRegion || '').toUpperCase() === activeRegion)
  headerCountySelect.selectedIndex = selectedIndex >= 0 ? selectedIndex : 0
}

function refreshSearchRegionOptions() {
  if (!searchRegionSelect) return
  const options = countyPickerOptions
  if (!Array.isArray(options) || options.length === 0) {
    searchRegionSelect.innerHTML = '<option value="">Current</option>'
    return
  }
  const currentRegion = (currentCountyRegion || '').toUpperCase()
  searchRegionSelect.innerHTML = [
    '<option value="">Current</option>',
    ...options.map((opt) => {
      const region = String(opt.countyRegion || '').toUpperCase()
      const selected = region && region === currentRegion
      return `<option value="${escapeHtml(region)}" ${selected ? 'selected' : ''}>${escapeHtml(opt.countyName)}</option>`
    }),
  ].join('')
}

function refreshSearchSpeciesOptions(source) {
  if (!searchSpeciesSelect) return
  const speciesSet = new Set()
  ;(Array.isArray(source) ? source : []).forEach((item) => {
    const name = String(item?.comName || '').trim()
    if (name) speciesSet.add(name)
  })
  const species = Array.from(speciesSet).sort((a, b) => a.localeCompare(b))
  const optionsHtml = ['<option value="">All species</option>']
  species.forEach((name) => {
    const isSelected = selectedSpecies === name
    optionsHtml.push(`<option value="${escapeHtml(name)}" ${isSelected ? 'selected' : ''}>${escapeHtml(name)}</option>`)
  })
  searchSpeciesSelect.innerHTML = optionsHtml.join('')
}

function updateCountyPickerFromGeojson(geojson) {
  if (!countyPickerList) return
  const features = Array.isArray(geojson?.features) ? geojson.features : []
  const options = features
    .map((feature) => {
      const center = getFeatureCenter(feature)
      if (!center) return null
      return {
        countyName: feature?.properties?.countyName || feature?.properties?.NAME || feature?.properties?.name || 'Unknown county',
        countyRegion: String(feature?.properties?.countyRegion || '').toUpperCase() || null,
        isActive: Boolean(feature?.properties?.isActiveCounty),
        lat: center.lat,
        lng: center.lng,
        summary: getCountySummary(feature?.properties?.countyRegion || null, Boolean(feature?.properties?.isActiveCounty)),
      }
    })
    .filter(Boolean)

  const active = options.find((opt) => opt.isActive)
  countyPickerOptions = options
    .map((opt) => ({
      ...opt,
      distanceKm: active ? distanceKm(active.lat, active.lng, opt.lat, opt.lng) : Infinity,
    }))
    .sort((a, b) => {
      if (a.isActive && !b.isActive) return -1
      if (!a.isActive && b.isActive) return 1
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm
      return a.countyName.localeCompare(b.countyName)
    })

  renderCountyPickerOptions()
  refreshHeaderCountyOptions()
  refreshSearchRegionOptions()
  prefetchCountySummariesForPicker(countyPickerOptions)
}

function setTableRenderStatus(message) {
  if (!tableRenderStatus) return
  tableRenderStatus.textContent = `render: ${message}`
}

function updateStatPills(total, confirmed, pending) {
  if (statTotal) {
    statTotal.textContent = `Total: ${total}`
    statTotal.dataset.short = String(total)
    statTotal.dataset.full = `Total species: ${total}`
    statTotal.classList.add('obs-stat-expanded')
  }
  if (statConfirmed) {
    statConfirmed.textContent = `Confirmed: ${confirmed}`
    statConfirmed.dataset.short = String(confirmed)
    statConfirmed.dataset.full = `Confirmed: ${confirmed}`
    statConfirmed.classList.add('obs-stat-expanded')
  }
  if (statPending) {
    statPending.textContent = `Pending: ${pending}`
    statPending.dataset.short = String(pending)
    statPending.dataset.full = `Pending: ${pending}`
    statPending.classList.add('obs-stat-expanded')
  }
  if (statsRight)    statsRight.innerHTML = ''
}

function renderAbaStatPills(sorted) {
  if (!statsRight) return
  const counts = new Map()
  sorted.forEach((item) => {
    const code = Number.isFinite(item.abaCode) ? item.abaCode : null
    if (code !== null) counts.set(code, (counts.get(code) || 0) + 1)
  })
  if (counts.size === 0) return
  const orderedCodes = [1, 2, 3, 4, 5, 6]
  if (Number.isFinite(selectedAbaCode) && selectedAbaCode >= 1 && selectedAbaCode <= 6) {
    const selected = Number(selectedAbaCode)
    const selectedIndex = orderedCodes.indexOf(selected)
    if (selectedIndex > 0) {
      orderedCodes.splice(selectedIndex, 1)
      orderedCodes.unshift(selected)
    }
  }
  const html = orderedCodes
    .filter((c) => counts.has(c))
    .map((c) => `<span class="stat-aba-pill aba-code-${c}" data-code="${c}" title="ABA code ${c}: ${counts.get(c)} species">${counts.get(c)}</span>`)
    .join('')
  statsRight.innerHTML = html
}

function setNotablesUnavailableState(metaMessage, rowMessage, statusMessage = 'notables-unavailable') {
  notableCount.className = 'badge warn'
  notableCount.textContent = '0'
  notableMeta.textContent = metaMessage
  updateStatPills('—', '—', '—')
  notableRows.innerHTML = `<tr><td colspan="7">${rowMessage}</td></tr>`
  setTableRenderStatus(statusMessage)
}

function supportsPermissionsApi() {
  return typeof navigator !== 'undefined' && 'permissions' in navigator && typeof navigator.permissions.query === 'function'
}

async function getGeolocationPermissionState() {
  if (!supportsPermissionsApi()) {
    return 'unknown'
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' })
    return result.state
  } catch {
    return 'unknown'
  }
}

function getCurrentPositionAsync(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

function initializeMap() {
  if (map) {
    return
  }

  map = L.map('map', {
    preferCanvas: true,
    zoomControl: false,
    attributionControl: true,
    zoomSnap: 1,
    zoomDelta: 1,
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false,
    wheelDebounceTime: 45,
    wheelPxPerZoomLevel: 190,
  }).setView([39.5, -98.35], 5)
  mapPointRenderer = L.canvas({ padding: 0.5 })

  map.createPane('countyMaskPane')
  map.getPane('countyMaskPane').style.zIndex = '380'
  map.getPane('countyMaskPane').style.pointerEvents = 'none'
  map.createPane('countyNeighborPane')
  map.getPane('countyNeighborPane').style.zIndex = '390'
  map.getPane('countyNeighborPane').style.pointerEvents = 'auto'
  map.createPane('countyDotPane')
  map.getPane('countyDotPane').style.zIndex = '405'
  map.getPane('countyDotPane').style.pointerEvents = 'auto'
  map.createPane('activeCountyPane')
  map.getPane('activeCountyPane').style.zIndex = '410'
  map.createPane('countyNamePane')
  map.getPane('countyNamePane').style.zIndex = '416'
  map.getPane('countyNamePane').style.pointerEvents = 'none'
  map.createPane('labelsPane')
  map.getPane('labelsPane').style.zIndex = '415'
  map.getPane('labelsPane').style.pointerEvents = 'none'
  map.createPane('notablePane')
  map.getPane('notablePane').style.zIndex = '420'
  map.getPane('notablePane').style.pointerEvents = 'auto'
  map.createPane('userDotPane')
  map.getPane('userDotPane').style.zIndex = '430'

  osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    ...BASE_TILE_OPTIONS,
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  })

  placeNameLayer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
    {
      ...BASE_TILE_OPTIONS,
      maxZoom: 19,
      subdomains: 'abcd',
      pane: 'labelsPane',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }
  )

  satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      ...BASE_TILE_OPTIONS,
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DigitalGlobe, USDA FSA'
    }
  )

  satelliteLayer.addTo(map)
  placeNameLayer.addTo(map)
  // Warm street tiles once to reduce perceived loading on first toggle
  osmLayer.addTo(map)
  map.removeLayer(osmLayer)
  if (mapBasemapToggleBtn) {
    mapBasemapToggleBtn.title = 'Switch to Street map'
  }
  updateBasemapAuxLayers()

  // High-res county outline when zoomed in close; revert to lo-res when zoomed back out
  map.on('zoomend', () => {
    const z = map.getZoom()
    if (!currentCountyRegion) return
    if (z > 9) {
      applyHiResCountyOutline(currentCountyRegion)
    } else if (latestCountyContextGeojson) {
      // Restore lo-res GeoJSON outline
      const activeFeatures = latestCountyContextGeojson.features.filter(
        (f) => f?.properties?.isActiveCounty
      )
      if (countyOverlay && activeFeatures.length) {
        countyOverlay.clearLayers()
        countyOverlay.addData({ type: 'FeatureCollection', features: activeFeatures })
      }
      if (activeOutlineLayerRef && activeFeatures.length) {
        activeOutlineLayerRef.clearLayers()
        activeOutlineLayerRef.addData({ type: 'FeatureCollection', features: activeFeatures })
        updateCountyLineColors()
      }
    }
  })
}

function updateBasemapAuxLayers() {
  if (!map) return
  const mapEl = document.querySelector('#map')
  if (mapEl) {
    mapEl.classList.toggle('is-satellite', currentBasemap === 'satellite')
    mapEl.classList.toggle('is-osm', currentBasemap === 'osm')
  }
  if (!placeNameLayer) return
  if (currentBasemap === 'satellite') {
    if (!map.hasLayer(placeNameLayer)) placeNameLayer.addTo(map)
  } else if (map.hasLayer(placeNameLayer)) {
    map.removeLayer(placeNameLayer)
  }
}

function updateCountyLineColors() {
  const isSat = currentBasemap === 'satellite'
  const neighborStroke = isSat ? '#94a3b8' : '#64748b'
  const neighborFill  = isSat ? '#94a3b8' : '#94a3b8'
  const activeStroke  = isSat ? '#ffffff' : '#dc2626'
  const activeMaskFill = isSat ? '#94a3b8' : '#cbd5e1'
  if (neighborLayerRef) {
    neighborLayerRef.setStyle({ color: neighborStroke, weight: 0.75, fillColor: neighborFill, fillOpacity: 0.46 })
  }
  if (countyOverlay) {
    countyOverlay.setStyle({ color: 'transparent', weight: 0, fillColor: activeMaskFill, fillOpacity: 0.28 })
  }
  if (activeOutlineLayerRef) {
    activeOutlineLayerRef.setStyle({ color: activeStroke, weight: 1, fillOpacity: 0 })
  }
}

function setMode(mode) {
  const showingMap = mode === 'map'
  panelMap.classList.toggle('active', showingMap)
  panelTable.classList.toggle('active', !showingMap)

  if (showingMap) {
    initializeMap()
    window.setTimeout(() => map.invalidateSize(), 150)
  }
}

async function triggerHardRefresh() {
  setMapLoading(true, 'Refreshing…')

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }

  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }

  const url = new URL(window.location.href)
  url.searchParams.set('refresh', String(Date.now()))
  window.location.replace(url.toString())
}

function setMapFullscreen(open) {
  isMapFullscreen = open
  appShell.classList.toggle('map-fullscreen', open)
  mapFullscreenToggleBtn.setAttribute('aria-pressed', String(open))
  // Swap to compress icon when fullscreen
  const svg = mapFullscreenToggleBtn.querySelector('svg')
  if (svg) {
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    svg.innerHTML = open
      ? '<polyline points="20 9 20 4 15 4"/><polyline points="4 15 4 20 9 20"/><line x1="20" y1="4" x2="13" y2="11"/><line x1="4" y1="20" x2="11" y2="13"/>'
      : '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'  
  }
  window.setTimeout(() => {
    if (map) map.invalidateSize()
  }, 180)
}

function setStatusPopoverOpen(open) {
  if (!statusPopover) return
  statusPopover.classList.toggle('open', open)
  statusPopover.setAttribute('aria-hidden', String(!open))
}

async function checkApi() {
  apiStatus.className = 'badge warn'
  apiStatus.textContent = 'Checking...'
  apiDetail.textContent = `Endpoint: ${API_BASE_URL} · Build ${BUILD_TAG}`
  if (buildInfo) {
    buildInfo.textContent = `Build: ${BUILD_TAG}`
  }
  try {
    const data = await fetchWorkerHealth()
    apiStatus.className = 'badge ok'
    apiStatus.textContent = 'Connected'
    apiDetail.textContent = `Endpoint: ${API_BASE_URL} · Regions loaded: ${Array.isArray(data) ? data.length : 0} · Build ${BUILD_TAG}`
  } catch (error) {
    apiStatus.className = 'badge warn'
    apiStatus.textContent = 'Unavailable'
    apiDetail.textContent = `Endpoint: ${API_BASE_URL} · ${error.message} · Build ${BUILD_TAG}`
    console.error(error)
  } finally {
    updateRuntimeLog()
  }
}

async function fetchWithTimeout(url, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`)
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

async function fetchCountyOutline(latitude, longitude) {
  const endpoint = `${API_BASE_URL}/api/county_outline?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
  const response = await fetchWithTimeout(endpoint, 20000)

  if (!response.ok) {
    throw new Error(`County outline request failed: ${response.status}`)
  }

  return response.json()
}

async function fetchCountyHiRes(countyRegion) {
  if (hiResCache.has(countyRegion)) return hiResCache.get(countyRegion)
  const endpoint = `${API_BASE_URL}/api/county_hires?countyRegion=${encodeURIComponent(countyRegion)}`
  const response = await fetchWithTimeout(endpoint, 15000)
  if (!response.ok) throw new Error(`County hi-res request failed: ${response.status}`)
  const data = await response.json()
  hiResCache.set(countyRegion, data)
  return data
}

// Apply hi-res outline if already zoomed in after county load
function maybeApplyHiResOnCountyLoad() {
  if (map && currentCountyRegion && map.getZoom() > 9) {
    void applyHiResCountyOutline(currentCountyRegion)
  }
}

async function applyHiResCountyOutline(countyRegion) {
  if (!countyRegion || !activeOutlineLayerRef) return
  if (hiResSwapInProgress) return
  hiResSwapInProgress = true
  try {
    const hiGeo = await fetchCountyHiRes(countyRegion)
    if (!hiGeo?.features?.length) return
    // Only apply if the county is still the active one
    if (currentCountyRegion !== countyRegion) return
    if (countyOverlay) {
      countyOverlay.clearLayers()
      countyOverlay.addData({ type: 'FeatureCollection', features: hiGeo.features })
    }
    activeOutlineLayerRef.clearLayers()
    activeOutlineLayerRef.addData({ type: 'FeatureCollection', features: hiGeo.features })
    updateCountyLineColors()
  } catch (e) {
    console.warn('[hi-res] County hi-res fetch failed:', e)
  } finally {
    hiResSwapInProgress = false
  }
}

async function fetchCountyNotables(latitude, longitude, back = 3, countyRegion = null) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    back: String(back),
  })
  if (countyRegion) {
    params.set('countyRegion', countyRegion)
  }
  const endpoint = `${API_BASE_URL}/api/county_notables?${params.toString()}`
  const response = await fetchWithTimeout(endpoint, COUNTY_NOTABLES_TIMEOUT_MS)
  if (!response.ok) {
    throw new Error(`County notable request failed: ${response.status}`)
  }
  return response.json()
}

async function fetchCountyNotablesWithRetry(latitude, longitude, back = 14, countyRegion = null, attempts = 1) {
  let lastError = null

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await fetchCountyNotables(latitude, longitude, back, countyRegion)
    } catch (error) {
      lastError = error
      const isLastAttempt = index === attempts - 1
      if (isLastAttempt) break
      await new Promise((resolve) => setTimeout(resolve, 300 * (index + 1)))
    }
  }

  throw lastError || new Error('County notable request failed')
}

function buildNotablesCacheKey(countyRegion) {
  return countyRegion ? `notables:${countyRegion}` : null
}

function saveNotablesCache(countyRegion, result) {
  const cacheKey = buildNotablesCacheKey(countyRegion)
  if (!cacheKey) return
  if (!Array.isArray(result?.observations) || result.observations.length === 0) return

  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      result,
    }))
  } catch {
    // ignore storage errors
  }
}

function loadNotablesCache(countyRegion, maxAgeMs = 6 * 60 * 60 * 1000) {
  const cacheKey = buildNotablesCacheKey(countyRegion)
  if (!cacheKey) return null

  try {
    const raw = localStorage.getItem(cacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const age = Date.now() - Number(parsed.timestamp || 0)
    if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) return null
    return parsed.result || null
  } catch {
    return null
  }
}

function countyContextCacheKey(lat, lng) {
  return `county_context:${Number(lat).toFixed(2)},${Number(lng).toFixed(2)}`
}

function saveCountyContextCache(lat, lng, geojson) {
  try {
    localStorage.setItem(countyContextCacheKey(lat, lng), JSON.stringify({ timestamp: Date.now(), geojson }))
  } catch {
    // ignore storage errors
  }
}

function loadCountyContextCache(lat, lng, maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const raw = localStorage.getItem(countyContextCacheKey(lat, lng))
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

async function fetchCountyContextWithCache(lat, lng) {
  const cached = loadCountyContextCache(lat, lng)
  if (cached) return cached
  const geojson = await fetchCountyOutline(lat, lng)
  saveCountyContextCache(lat, lng, geojson)
  return geojson
}

async function fetchRegionRarities(region, back = 7, timeoutMs = API_TIMEOUT_MS) {
  const endpoint = `${API_BASE_URL}/api/rarities?region=${encodeURIComponent(region)}&back=${encodeURIComponent(back)}`
  const response = await fetchWithTimeout(endpoint, timeoutMs)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Region rarities ${response.status}: ${body.slice(0, 120)}`)
  }
  const data = await response.json()
  // API may return plain array or { observations: [] }
  return Array.isArray(data) ? data : (Array.isArray(data?.observations) ? data.observations : [])
}

function stateRegionFromCountyRegion(countyRegion) {
  if (!countyRegion || !/^US-[A-Z]{2}-\d{3}$/.test(countyRegion)) return null
  return countyRegion.slice(0, 5)
}

function setLocationUiChecking() {
  locationStatus.className = 'badge warn'
  locationStatus.textContent = 'Checking...'
  locationDetail.textContent = 'Requesting device location permission.'
}

function setLocationUiUnavailable(message) {
  locationStatus.className = 'badge warn'
  locationStatus.textContent = 'Unavailable'
  locationDetail.textContent = message
}

function setLocationUiBlocked() {
  locationStatus.className = 'badge warn'
  locationStatus.textContent = 'Blocked'
  locationDetail.textContent = 'Location permission is blocked. On iOS: Settings → Privacy & Security → Location Services → Safari Websites (or your Home Screen app) → While Using + Precise ON.'
}

function updateUserLocationOnMap(latitude, longitude, accuracyMeters) {
  initializeMap()
  const safeAccuracy = Number.isFinite(accuracyMeters) && accuracyMeters > 0 ? accuracyMeters : 750

  if (!userDot) {
    userDot = L.circleMarker([latitude, longitude], {
      radius: 8,
      color: '#ffffff',
      weight: 2.5,
      fillColor: '#7c3aed',
      fillOpacity: 1,
      pane: 'userDotPane',
    }).addTo(map)
  } else {
    userDot.setLatLng([latitude, longitude])
  }

  if (!accuracyCircle) {
    accuracyCircle = L.circle([latitude, longitude], {
      radius: safeAccuracy,
      color: '#009688',
      fillColor: '#009688',
      fillOpacity: 0.2,
      weight: 1.5
    }).addTo(map)
  } else {
    accuracyCircle.setLatLng([latitude, longitude])
    accuracyCircle.setRadius(safeAccuracy)
  }

  // Don't zoom here — fitBounds in renderNotablesOnMap controls the viewport
  markMapPartReady('location')
}

function drawCountyOverlay(geojson) {
  initializeMap()
  latestCountyContextGeojson = geojson
  updateCountyPickerFromGeojson(geojson)

  const allFeatures = Array.isArray(geojson?.features) ? geojson.features : []
  const neighborFeatures = allFeatures.filter((f) => !f?.properties?.isActiveCounty)
  const activeFeatures = allFeatures.filter((f) => f?.properties?.isActiveCounty)

  const isSat = currentBasemap === 'satellite'
  const neighborStroke = isSat ? '#94a3b8' : '#64748b'
  const activeStroke = isSat ? '#ffffff' : '#dc2626'

  if (!neighborLayerRef) {
    neighborLayerRef = L.geoJSON(null, {
      pane: 'countyNeighborPane',
      style: { color: neighborStroke, weight: 0.75, fillColor: '#94a3b8', fillOpacity: 0.46 },
      onEachFeature: (feature, layer) => {
        const region = feature?.properties?.countyRegion || null
        const name = feature?.properties?.countyName || feature?.properties?.NAME || feature?.properties?.name || ''
        layer.on({
          click: (e) => {
            L.DomEvent.stopPropagation(e)
            loadNeighborCounty(e.latlng.lat, e.latlng.lng, region, name)
          },
          mouseover: () => layer.setStyle({ fillOpacity: 0.56, fillColor: '#94a3b8', color: '#475569', weight: 1 }),
          mouseout: () => {
            const nowSat = currentBasemap === 'satellite'
            layer.setStyle({ fillOpacity: 0.46, fillColor: '#94a3b8', color: nowSat ? '#94a3b8' : '#64748b', weight: 0.75 })
          },
        })
      },
    }).addTo(map)
  }

  if (!activeOutlineLayerRef) {
    activeOutlineLayerRef = L.geoJSON(null, {
      pane: 'activeCountyPane',
      style: { color: activeStroke, weight: 1, fillOpacity: 0, fillColor: 'transparent' },
    }).addTo(map)
  }

  if (!countyOverlay) {
    countyOverlay = L.geoJSON(null, {
      pane: 'countyMaskPane',
      style: { color: 'transparent', weight: 0, fillColor: '#94a3b8', fillOpacity: 0.28 },
      interactive: false,
    }).addTo(map)
  }

  if (!countyNameLayerRef) {
    countyNameLayerRef = L.layerGroup().addTo(map)
  }

  neighborLayerRef.clearLayers()
  countyOverlay.clearLayers()
  activeOutlineLayerRef.clearLayers()
  countyNameLayerRef.clearLayers()
  neighborLayerRef.addData({ type: 'FeatureCollection', features: neighborFeatures })
  countyOverlay.addData({ type: 'FeatureCollection', features: activeFeatures })
  activeOutlineLayerRef.addData({ type: 'FeatureCollection', features: activeFeatures })

  updateCountyLineColors()

  updateCountyDots()

  // Set county label pill immediately when GeoJSON resolves — don't wait for caller chain
  const activeFeature = activeFeatures[0] || null
  const activeCountyName = activeFeature?.properties?.countyName || activeFeature?.properties?.NAME || activeFeature?.properties?.name || null
  if (mapCountyLabel && activeCountyName) {
    mapCountyLabel.textContent = activeCountyName
    mapCountyLabel.removeAttribute('hidden')
  }

  markMapPartReady('activeCounty')
  markMapPartReady('stateMask')
}

function formatObservationDate(rawValue) {
  if (!rawValue) return '—'
  const parsed = new Date(rawValue)
  if (Number.isNaN(parsed.getTime())) return String(rawValue)
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseObsDate(obsDt) {
  if (!obsDt) return null
  const parsed = new Date(obsDt)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatShortDate(date) {
  if (!date) return ''
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatObsDateTime(obsDt) {
  const d = parseObsDate(obsDt)
  if (!d) return obsDt || 'Unknown date'
  const mo = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${mo}/${day} ${h12}:${m}${ampm}`
}

function dayOffsetFromToday(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - target.getTime()) / 86400000)
}

function getDateBubbleClass(kind, firstDate, lastDate) {
  const targetDate = kind === 'first' ? firstDate : lastDate
  const offset = dayOffsetFromToday(targetDate)
  if (offset === 0) return 'date-bubble-green-dark'
  if (offset === 1) return 'date-bubble-green-light'
  if (offset === 2) return 'date-bubble-yellow'
  return 'date-bubble-neutral'
}

function renderDateBubble(label, bubbleClass) {
  const text = String(label || '').trim()
  if (!text) return ''
  const cls = bubbleClass || 'date-bubble-neutral'
  return `<span class="date-bubble ${cls}">${escapeHtml(text)}</span>`
}

function renderAbaCodeBadge(code) {
  const n = Number(code)
  if (!Number.isFinite(n) || n < 1 || n > 6) {
    return '<span class="aba-code-badge aba-code-unknown" title="ABA code unavailable">N</span>'
  }
  const safe = Math.round(n)
  return `<span class="aba-code-badge aba-code-${safe}" title="ABA code ${safe}">${safe}</span>`
}

function renderYoloCodeBadge(species, abaCode) {
  const yoloInfo = getYoloSpeciesInfo(species)
  const yCode = Number(yoloInfo?.yoloCode)
  if (!Number.isFinite(yCode)) {
    return '<span class="yolo-code-badge yolo-code-none" title="No Yolo County code"></span>'
  }
  const diverges = Number.isFinite(abaCode) && yCode > abaCode
  const noteSuffix = yoloInfo?.notes ? ` · ${escapeHtml(String(yoloInfo.notes))}` : ''
  const marker = diverges ? ' yolo-diverges' : ''
  return `<span class="yolo-code-badge yolo-code-${yCode}${marker}" title="Yolo County code ${yCode}${diverges ? ' (rarer locally)' : ''}${noteSuffix}">${yCode}</span>`
}

function statusCodeClassSuffix(code) {
  return String(code || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function renderSpeciesStatusBullets(species) {
  const info = getYoloSpeciesInfo(species)
  if (!info) return ''
  const uniqueCodes = Array.from(new Set([info.statusCode, info.avibaseStatusCode].filter(Boolean)))
  if (!uniqueCodes.length) return ''
  return uniqueCodes
    .map((code) => {
      const safeCode = escapeHtml(code)
      const cls = statusCodeClassSuffix(code)
      return `<span class="species-status-bullet status-code-${cls}" title="Reference status ${safeCode}">${safeCode}</span>`
    })
    .join('')
}

function isConfirmedObservation(item) {
  if (item && typeof item.confirmedAny === 'boolean') return item.confirmedAny
  return Number(item?.obsReviewed) === 1 && Number(item?.obsValid) === 1
}

function renderStatusDot(isConfirmed) {
  const cls = isConfirmed ? 'status-dot-confirmed' : 'status-dot-pending'
  const title = isConfirmed ? 'Confirmed' : 'Pending'
  return `<span class="status-dot ${cls}" title="${title}"></span>`
}

function getItemStateAbbrev(item) {
  const code = String(item?.subnational1Code || '')
  if (!code) return ''
  return code.includes('-') ? (code.split('-').pop() || '') : code
}

function getItemCountyName(item) {
  return String(item?.subnational2Name || item?.subnational2Code || '')
}

function buildGroupedRowsFromObservations(observations) {
  const grouped = new Map()
  ;(Array.isArray(observations) ? observations : []).forEach((item) => {
    const species = item.comName || ''
    const state = getItemStateAbbrev(item)
    const county = getItemCountyName(item)
    const key = `${species}::${state}::${county}`
    const date = parseObsDate(item.obsDt)
    const rawCode = item.abaCode ?? item.abaRarityCode
    const code = Number(rawCode)
    const abaCode = Number.isFinite(code) ? code : null
    const lat = Number(item.lat)
    const lng = Number(item.lng)

    if (!grouped.has(key)) {
      grouped.set(key, {
        species,
        state,
        county,
        count: 0,
        first: date,
        last: date,
        abaCode,
        confirmedAny: isConfirmedObservation(item),
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
      })
    }

    const entry = grouped.get(key)
    entry.count += 1
    entry.confirmedAny = entry.confirmedAny || isConfirmedObservation(item)
    if (abaCode !== null) {
      if (entry.abaCode === null || entry.abaCode === undefined || abaCode > entry.abaCode) {
        entry.abaCode = abaCode
      }
    }
    if (date) {
      if (!entry.first || date < entry.first) entry.first = date
      if (!entry.last || date > entry.last) entry.last = date
    }
  })

  return grouped
}

function renderNotableTable(observations, countyName, regionCode, abaPillObservations = observations) {
  setTableRenderStatus('table-start')
  notableRows.innerHTML = ''
  notableMeta.textContent = `${countyName || 'County'} · ${regionCode || ''}`.trim()
  notableMeta.dataset.regionCode = regionCode || ''

  const abaPillGrouped = buildGroupedRowsFromObservations(abaPillObservations)
  renderAbaStatPills(Array.from(abaPillGrouped.values()))

  if (!Array.isArray(observations) || observations.length === 0) {
    notableCount.className = 'badge ok'
    notableCount.textContent = '0'
    updateStatPills('0', '0', '0')
    renderAbaStatPills(Array.from(abaPillGrouped.values()))
    notableRows.innerHTML = '<tr><td colspan="7">No notable observations found for this county.</td></tr>'
    setTableRenderStatus('table-empty')
    return
  }

  // Group by species+county (matching desktop renderSightingsTable)
  const grouped = buildGroupedRowsFromObservations(observations)

  // Sort by ABA descending, then state/county/date (matches desktop)
  const sorted = Array.from(grouped.values()).sort((a, b) => {
    const aCode = Number.isFinite(a.abaCode) ? a.abaCode : -1
    const bCode = Number.isFinite(b.abaCode) ? b.abaCode : -1
    if (aCode !== bCode) return bCode - aCode
    const aState = String(a.state || '').toLowerCase()
    const bState = String(b.state || '').toLowerCase()
    if (aState !== bState) return aState.localeCompare(bState)
    const aCounty = String(a.county || '').toLowerCase()
    const bCounty = String(b.county || '').toLowerCase()
    if (aCounty !== bCounty) return aCounty.localeCompare(bCounty)
    return (b.last ? b.last.getTime() : 0) - (a.last ? a.last.getTime() : 0)
  })

  notableCount.className = 'badge ok'
  notableCount.textContent = String(sorted.length)
  const confirmedCount = sorted.filter((r) => r.confirmedAny).length
  updateStatPills(sorted.length, confirmedCount, sorted.length - confirmedCount)
  renderAbaStatPills(Array.from(abaPillGrouped.values()))
  currentTableData = sorted
  applySortAndRender()
}

function applySortAndRender() {
  if (!currentTableData.length) return
  const { col, dir } = sortState
  const data = [...currentTableData].sort((a, b) => {
    let av, bv
    if (col === 'aba') {
      av = Number.isFinite(a.abaCode) ? a.abaCode : -1
      bv = Number.isFinite(b.abaCode) ? b.abaCode : -1
    } else {
      av = (col === 'last' ? a.last : a.first)?.getTime() ?? 0
      bv = (col === 'last' ? b.last : b.first)?.getTime() ?? 0
    }
    return dir === 'desc' ? bv - av : av - bv
  })
  // Determine if this is Yolo (reuse regionCode stored on table)
  const regionCode = document.querySelector('#notableMeta')?.dataset?.regionCode || ''
  const isYolo = regionCode === 'US-CA-113'
  const fragment = document.createDocumentFragment()
  data.forEach((item) => {
    const lastBubble = renderDateBubble(formatShortDate(item.last), getDateBubbleClass('last', item.first, item.last))
    const firstBubble = renderDateBubble(formatShortDate(item.first), getDateBubbleClass('first', item.first, item.last))
    const abaBadge = renderAbaCodeBadge(item.abaCode)
    const yoloBadge = isYolo ? renderYoloCodeBadge(item.species, item.abaCode) : ''
    const statusBullets = isYolo ? renderSpeciesStatusBullets(item.species) : ''
    const statusDot = renderStatusDot(Boolean(item.confirmedAny))
    const isChecked = !hiddenSpecies.has(item.species)
    const pinHtml = (item.lat != null && item.lng != null)
      ? `<button type="button" class="row-pin-btn" data-lat="${item.lat}" data-lng="${item.lng}" title="Open in Google Maps">📍</button>`
      : ''
    const row = document.createElement('tr')
    const safeSpecies = escapeHtml(item.species)
    row.dataset.species = item.species
    row.innerHTML = `
      <td><div class="species-cell">${abaBadge}${yoloBadge}${statusBullets}<button type="button" class="species-btn" data-species="${safeSpecies}">${safeSpecies}</button></div></td>
      <td class="col-status">${statusDot}</td>
      <td>${lastBubble}</td>
      <td>${firstBubble}</td>
      <td>${item.count}</td>
      <td class="col-vis"><input type="checkbox" class="obs-vis-cb" data-species="${safeSpecies}" ${isChecked ? 'checked' : ''}></td>
      <td class="col-pin">${pinHtml}</td>
    `
    fragment.appendChild(row)
  })
  notableRows.innerHTML = ''
  notableRows.appendChild(fragment)
  // Re-sync toggle-all
  const toggleAll = document.querySelector('#toggleAllVis')
  if (toggleAll) {
    if (hiddenSpecies.size === 0) { toggleAll.checked = true; toggleAll.indeterminate = false }
    else if (hiddenSpecies.size >= currentTableData.length) { toggleAll.checked = false; toggleAll.indeterminate = false }
    else { toggleAll.indeterminate = true }
  }
  // Update sort icons
  ;['thSpecies', 'thLast', 'thFirst'].forEach((id) => {
    const th = document.querySelector(`#${id}`)
    if (!th) return
    const colMap = { thSpecies: 'aba', thLast: 'last', thFirst: 'first' }
    const icon = th.querySelector('.sort-icon')
    if (!icon) return
    if (colMap[id] === col) {
      icon.textContent = dir === 'desc' ? ' ↓' : ' ↑'
      th.classList.add('sort-active')
    } else {
      icon.textContent = ''
      th.classList.remove('sort-active')
    }
  })
  setTableRenderStatus(`sorted:${col}:${dir} rows=${data.length}`)
}

// ---------------------------------------------------------------------------
// Fast canvas overlay — replaces per-marker Leaflet objects with a single
// Canvas2D draw pass + one click-handler for hit-testing.
// ---------------------------------------------------------------------------
const ABA_COLORS = {
  1: { fill: '#067bc2', border: '#ffffff' },
  2: { fill: '#84bcda', border: '#ffffff' },
  3: { fill: '#ecc30b', border: '#ffffff' },
  4: { fill: '#f37748', border: '#ffffff' },
  5: { fill: '#ED1313', border: '#ffffff' },
  6: { fill: '#ed13d4', border: '#ffffff' },
}
const ABA_DEFAULT_COLOR = { fill: '#4b5563', border: '#ffffff' }
const MARKER_RADIUS = 9        // px, logical
const HIT_RADIUS = 12          // px, slightly larger for touch

let fastCanvasOverlay = null   // L.Layer instance
let fastCanvasData = []        // [{lat,lng,fill,border,species,safeSpecies,subId,item}]
let fastCanvasPopup = null     // single reused L.popup

function buildFastCanvasOverlay() {
  const CanvasOverlay = L.Layer.extend({
    onAdd(m) {
      this._map = m
      this._canvas = document.createElement('canvas')
      this._canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none'
      m.getPanes().notablePane.appendChild(this._canvas)
      m.on('move zoomend resize', this._redraw, this)
      this._redraw()
    },
    onRemove(m) {
      m.off('move zoomend resize', this._redraw, this)
      this._canvas.remove()
    },
    redraw() { this._redraw() },
    _redraw() {
      const m = this._map
      const size = m.getSize()
      const dpr = window.devicePixelRatio || 1
      const cvs = this._canvas
      cvs.width  = size.x * dpr
      cvs.height = size.y * dpr
      cvs.style.width  = size.x + 'px'
      cvs.style.height = size.y + 'px'

      // Align canvas top-left with the map's current tile origin
      const topLeft = m.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(cvs, topLeft)

      const ctx = cvs.getContext('2d')
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, size.x, size.y)

      const r = MARKER_RADIUS
      for (const pt of fastCanvasData) {
        if (pt.hidden) continue
        // Use layer-space coordinates so canvas positioning and point math
        // stay in the same reference frame during pan/zoom transforms.
        const lp = m.latLngToLayerPoint([pt.lat, pt.lng])
        const x = lp.x - topLeft.x
        const y = lp.y - topLeft.y
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = pt.fill
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = pt.border
        ctx.stroke()
        if (pt.label) {
          ctx.font = '600 11px sans-serif'
          const tx = x + r + 4
          const ty = y + 4
          const tw = ctx.measureText(pt.label).width
          const pad = 2
          ctx.fillStyle = 'rgba(255,255,255,0.82)'
          ctx.beginPath()
          ctx.roundRect(tx - pad, ty - 10, tw + pad * 2, 13, 3)
          ctx.fill()
          ctx.fillStyle = '#0f172a'
          ctx.fillText(pt.label, tx, ty)
        }
      }
    },
  })
  return new CanvasOverlay()
}

function hitTestCanvas(containerPoint) {
  const m = map
  const r2 = HIT_RADIUS * HIT_RADIUS
  let best = null
  let bestDist = Infinity
  for (const pt of fastCanvasData) {
    if (pt.hidden) continue
    const cp = m.latLngToContainerPoint([pt.lat, pt.lng])
    const dx = cp.x - containerPoint.x
    const dy = cp.y - containerPoint.y
    const d2 = dx * dx + dy * dy
    if (d2 <= r2 && d2 < bestDist) {
      best = pt
      bestDist = d2
    }
  }
  return best
}

// Install a single map click handler once
let _canvasClickInstalled = false
function ensureCanvasClickHandler() {
  if (_canvasClickInstalled) return
  _canvasClickInstalled = true
  // We listen on the map container directly so we get clicks through the canvas
  document.querySelector('#map')?.addEventListener('click', (e) => {
    if (!map || fastCanvasData.length === 0) return
    const rect = map.getContainer().getBoundingClientRect()
    const cp = L.point(e.clientX - rect.left, e.clientY - rect.top)
    const pt = hitTestCanvas(cp)
    if (!pt) {
      if (fastCanvasPopup) { fastCanvasPopup.remove(); fastCanvasPopup = null }
      return
    }
    e.stopPropagation()

    const item = pt.item
    const locId = item?.locId ? String(item.locId) : null
    const locName = item?.locName ? escapeHtml(String(item.locName)) : null

    // ABA badge + species header (species links to hotspot if available) + map-it pin
    const abaBadge = renderAbaCodeBadge(pt.abaCode)
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pt.lat},${pt.lng}`)}`
    const speciesEl = locId
      ? `<a class="obs-popup-species" href="https://ebird.org/hotspot/${encodeURIComponent(locId)}" target="_blank" rel="noopener">${pt.safeSpecies}</a>`
      : `<span class="obs-popup-species">${pt.safeSpecies}</span>`
    const header = `<div class="obs-popup-header">${abaBadge}${speciesEl}<a class="obs-popup-mapit" href="${mapsUrl}" target="_blank" rel="noopener" title="Map it">&#x1F4CD;</a></div>`

    // Checklists — bulleted list, link text = date+time
    const checklistItems = (pt.subIds || []).map((sid, i) => {
      const label = formatObsDateTime(pt.subDates?.[i])
      return `<li><a href="https://ebird.org/checklist/${encodeURIComponent(sid)}" target="_blank" rel="noopener">${escapeHtml(label)}</a></li>`
    })
    const checklistSection = checklistItems.length
      ? `<ul class="obs-popup-checklist">${checklistItems.join('')}</ul>`
      : ''

    const html = `<div class="obs-popup-inner">${header}${checklistSection}</div>`
    if (!fastCanvasPopup) fastCanvasPopup = L.popup({ maxWidth: 220, className: 'obs-popup' })
    fastCanvasPopup.setLatLng([pt.lat, pt.lng]).setContent(html).openOn(map)
  })
}
// ---------------------------------------------------------------------------

function renderNotablesOnMap(observations, activeCountyCode = '', fitToObservations = false) {
  initializeMap()
  perfStart('map')

  const renderId = ++latestMapRenderId

  const totalPoints = Array.isArray(observations) ? observations.length : 0
  const showPermanentLabels = labelsVisible && totalPoints <= MAP_LABEL_MAX_POINTS

  // Deduplicate: one canvas point per species×location, but collect ALL subIds
  const seenMap = new Map()  // key → deduped entry index
  const deduped = []
  if (Array.isArray(observations)) {
    for (const item of observations) {
      const lat = Number(item?.lat)
      const lng = Number(item?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const species = String(item?.comName || 'Unknown species')
      const key = `${species}|${lat.toFixed(4)}|${lng.toFixed(4)}`
      const subId = item?.subId ? String(item.subId) : null
      const obsDt = item?.obsDt ? String(item.obsDt) : null
      if (!seenMap.has(key)) {
        const entry = { item, lat, lng, species, subIds: subId ? [subId] : [], subDates: obsDt ? [obsDt] : [] }
        seenMap.set(key, deduped.length)
        deduped.push(entry)
      } else if (subId) {
        const existing = deduped[seenMap.get(key)]
        if (!existing.subIds.includes(subId)) {
          existing.subIds.push(subId)
          existing.subDates.push(obsDt)
        }
      }
    }
  }

  // Signature dedup — skip if nothing changed and we're not force-fitting
  let signatureHash = 0
  for (const { lat, lng, item } of deduped) {
    const code = getAbaCodeNumber(item) || 0
    signatureHash = ((signatureHash * 33) ^ (Math.round(lat * 10000) + Math.round(lng * 10000) + code)) >>> 0
  }
  const renderSignature = `${activeCountyCode}|${deduped.length}|${signatureHash}|${labelsVisible ? 1 : 0}`
  if (!fitToObservations && renderSignature === lastMapRenderSignature) {
    perfEnd('map')
    return
  }
  lastMapRenderSignature = renderSignature

  // Build lightweight data objects — no Leaflet marker construction
  const nextData = []
  const nextSpeciesMap = new Map()  // species → [{lat,lng}] for table row highlight
  for (const { item, lat, lng, species, subIds, subDates } of deduped) {
    const rawCode = item?.abaCode ?? item?.abaRarityCode
    const abaCode = Number.isFinite(Number(rawCode)) ? Math.round(Number(rawCode)) : null
    const colors = ABA_COLORS[abaCode] || ABA_DEFAULT_COLOR
    const safeSpecies = escapeHtml(species)
    const itemCounty = String(item?.subnational2Code || '').toUpperCase()
    const isInActiveCounty = !activeCountyCode || itemCounty === activeCountyCode
    const label = (isInActiveCounty && showPermanentLabels) ? getSpeciesMapLabel(species) : null
    const pt = { lat, lng, fill: colors.fill, border: colors.border, species, safeSpecies, abaCode, subIds, subDates, item, label, hidden: false }
    nextData.push(pt)
    if (!nextSpeciesMap.has(species)) nextSpeciesMap.set(species, [])
    nextSpeciesMap.get(species).push(pt)
  }

  if (renderId !== latestMapRenderId) { perfEnd('map'); return }

  // Swap in new data and redraw the single canvas layer
  fastCanvasData = nextData
  speciesMarkers = nextSpeciesMap   // reuse same variable — callers key on species name
  hiddenSpecies = new Set()
  const toggleAllEl = document.querySelector('#toggleAllVis')
  if (toggleAllEl) { toggleAllEl.checked = true; toggleAllEl.indeterminate = false }

  if (!fastCanvasOverlay) {
    fastCanvasOverlay = buildFastCanvasOverlay()
    fastCanvasOverlay.addTo(map)
    ensureCanvasClickHandler()
  } else {
    fastCanvasOverlay.redraw()
  }

  // Remove old Leaflet featureGroup layer if present from a previous render
  if (notableLayer) { map.removeLayer(notableLayer); notableLayer = null }

  perfEnd('map')

  if (fitToObservations && nextData.length > 0) {
    const lats = nextData.map((p) => p.lat)
    const lngs = nextData.map((p) => p.lng)
    const bounds = L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    )
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: MAP_POINTS_FIT_MAX_ZOOM, animate: false })
    }
  }
}

async function loadCountyNotables(latitude, longitude, countyRegion = null, requestId = null, countySwitchRequestId = null, allowStateFallback = false) {
  perfStart('fetch')
  const notablesLoadId = ++latestNotablesLoadId
  const previousCountText = notableCount.textContent
  const previousMetaText = notableMeta.textContent
  const previousRowsHtml = notableRows.innerHTML
  const previousRenderStatus = tableRenderStatus?.textContent || ''
  const hadPreviousRows = /<tr[\s>]/i.test(previousRowsHtml) && !/(Loading county notables|request timed out|did not complete|not available right now|No notable observations found)/i.test(previousRowsHtml)
  const cachedWarm = !hadPreviousRows ? loadNotablesCache(countyRegion) : null
  const hasCachedWarm = Array.isArray(cachedWarm?.observations) && cachedWarm.observations.length > 0

  setMapLoading(true, 'Loading notable observations…')
  setTableRenderStatus('load-start')
  if (hasCachedWarm) {
    currentRawObservations = cachedWarm.observations
    currentCountyName = cachedWarm?.countyName || null
    currentCountyRegion = cachedWarm?.countyRegion || countyRegion || null
    currentActiveCountyCode = (cachedWarm?.countyRegion || countyRegion || '').toUpperCase()
    // Show county name immediately from cache — don't wait for GeoJSON fetch
    if (mapCountyLabel && currentCountyName) {
      mapCountyLabel.textContent = currentCountyName
      mapCountyLabel.removeAttribute('hidden')
    }
    refreshCountyPickerSummaries()
    const warmFiltered = applyActiveFiltersAndRender({ renderMap: false })
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    if (!isStaleNotablesLoad(notablesLoadId, requestId, countySwitchRequestId)) {
      setMapLoading(true, 'Rendering map points…')
      renderNotablesOnMap(warmFiltered, currentActiveCountyCode, true)
      maybeApplyHiResOnCountyLoad()
    }
    notableMeta.textContent = `${notableMeta.textContent} · cached`
    setTableRenderStatus(`cache-warm rows=${cachedWarm.observations.length}`)
    markMapPartReady('observations')
  } else {
    notableCount.className = 'badge warn'
    notableCount.textContent = hadPreviousRows ? 'Refreshing…' : 'Loading…'
    notableMeta.textContent = hadPreviousRows ? 'Refreshing county notables…' : 'Loading county notables…'
  }
  if (!hadPreviousRows && !hasCachedWarm) {
    updateStatPills('…', '…', '…')
    notableRows.innerHTML = '<tr><td colspan="7">Loading county notables…</td></tr>'
  }

  const loadingWatchdog = window.setTimeout(() => {
    if (isStaleNotablesLoad(notablesLoadId, requestId, countySwitchRequestId)) return
    if (notableCount.textContent !== 'Loading…' && notableCount.textContent !== 'Refreshing…') return
    if (hadPreviousRows) {
      notableCount.className = 'badge ok'
      notableCount.textContent = previousCountText
      notableMeta.textContent = `${previousMetaText} · refresh-timeout`
      notableRows.innerHTML = previousRowsHtml
      if (tableRenderStatus) {
        tableRenderStatus.textContent = previousRenderStatus || 'render: refresh-timeout-restored'
      }
      markMapPartReady('observations')
      return
    }
    notableCount.className = 'badge warn'
    notableCount.textContent = '0'
    notableMeta.textContent = 'County notables request timed out'
    updateStatPills('0', '0', '0')
    notableRows.innerHTML = '<tr><td colspan="7">County notables request timed out. Try refresh or Use My Location again.</td></tr>'
    setTableRenderStatus('watchdog-timeout')
    markMapPartReady('observations')
  }, 9000)

  try {
    let result = null
    let observations = []
    let strategy = null

    // Fire primary (with countyRegion) and generic fallback concurrently so we
    // don't stack two sequential 5 s timeouts when the primary is slow/failing.
    const needFallback = !countyRegion // if no region provided, only one fetch needed
    const primaryPromise = fetchCountyNotablesWithRetry(latitude, longitude, 14, countyRegion, 1).catch((e) => { console.warn('Primary county notables failed:', e); return null })
    const fallbackPromise = needFallback
      ? primaryPromise
      : fetchCountyNotablesWithRetry(latitude, longitude, 14, null, 1).catch((e) => { console.warn('Fallback county notables failed:', e); return null })

    const [primaryResult, fallbackResult] = await Promise.all([primaryPromise, fallbackPromise])

    const primaryObs = Array.isArray(primaryResult?.observations) ? primaryResult.observations : []
    const fallbackObs = Array.isArray(fallbackResult?.observations) ? fallbackResult.observations : []

    if (countyRegion) {
      if (primaryResult) {
        result = primaryResult
        observations = primaryObs
        strategy = primaryResult?.sourceStrategy || 'county-region'
      } else if (fallbackResult) {
        result = fallbackResult
        observations = fallbackObs
        strategy = fallbackResult?.sourceStrategy || 'county-fallback'
      }
    } else if (primaryObs.length >= fallbackObs.length && primaryObs.length > 0) {
      result = primaryResult
      observations = primaryObs
      strategy = primaryResult?.sourceStrategy || 'county-region'
    } else if (fallbackObs.length > 0) {
      result = fallbackResult
      observations = fallbackObs
      strategy = fallbackResult?.sourceStrategy || 'county-fallback'
    }

    if (allowStateFallback && observations.length === 0 && countyRegion) {
      const stateRegion = stateRegionFromCountyRegion(countyRegion)
      if (stateRegion) {
        try {
            const stateData = await fetchRegionRarities(stateRegion, 14)
          const filtered = Array.isArray(stateData)
            ? stateData.filter((item) => String(item?.subnational2Code || '').toUpperCase() === countyRegion)
            : []

          if (filtered.length > observations.length) {
            observations = filtered
            strategy = 'state-filter-client'
            result = {
              countyName: null,
              countyRegion,
              sourceStrategy: strategy,
            }
          }
        } catch (stateFallbackError) {
          console.warn('State filtered fallback failed:', stateFallbackError)
        }
      }
    }

    if (isStaleNotablesLoad(notablesLoadId, requestId, countySwitchRequestId)) {
      return
    }

    if (observations.length > 0) {
      saveNotablesCache(result?.countyRegion || countyRegion || null, result)
    }

    const activeCountyCode = (result?.countyRegion || countyRegion || '').toUpperCase()
    const filteredObs = activeCountyCode
      ? observations.filter((item) => !item.subnational2Code || String(item.subnational2Code).toUpperCase() === activeCountyCode)
      : observations
    const displayObs = activeCountyCode ? filteredObs : observations
    currentRawObservations = displayObs
    currentCountyName = result?.countyName || null
    currentCountyRegion = result?.countyRegion || countyRegion || null
    currentActiveCountyCode = activeCountyCode
    // Show county name immediately when notables API responds — don't wait for map render
    if (mapCountyLabel && currentCountyName) {
      mapCountyLabel.textContent = currentCountyName
      mapCountyLabel.removeAttribute('hidden')
    }
    refreshCountyPickerSummaries()
    const displayFiltered = applyActiveFiltersAndRender({ renderMap: false })
    perfEnd('fetch')
    perfStart('table')
    setTableRenderStatus(`table-ok rows=${observations.length}`)
    perfEnd('table')
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    if (isStaleNotablesLoad(notablesLoadId, requestId, countySwitchRequestId)) return
    setMapLoading(true, 'Rendering map points…')
    renderNotablesOnMap(displayFiltered, currentActiveCountyCode, true)
    setTableRenderStatus(`map-ok points=${displayFiltered.length}`)
    maybeApplyHiResOnCountyLoad()
    if (strategy) {
      notableMeta.textContent = `${notableMeta.textContent} · ${strategy}`
    }
    updateRuntimeLog()
  } catch (error) {
    console.error('County notables unavailable:', error)
    if (isStaleNotablesLoad(notablesLoadId, requestId, countySwitchRequestId)) {
      return
    }

    if (hadPreviousRows) {
      notableCount.className = 'badge ok'
      notableCount.textContent = previousCountText
      notableMeta.textContent = `${previousMetaText} · refresh-failed`
      notableRows.innerHTML = previousRowsHtml
      if (tableRenderStatus) {
        tableRenderStatus.textContent = previousRenderStatus || 'render: refresh-failed-restored'
      }
      return
    }

    const cached = loadNotablesCache(countyRegion)
    if (cached && Array.isArray(cached.observations) && cached.observations.length > 0) {
      currentRawObservations = cached.observations
      currentCountyName = cached?.countyName || null
      currentCountyRegion = cached?.countyRegion || countyRegion || null
      currentActiveCountyCode = (cached?.countyRegion || countyRegion || '').toUpperCase()
      refreshCountyPickerSummaries()
      const cachedFiltered = applyActiveFiltersAndRender({ renderMap: false })
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      if (isStaleNotablesLoad(notablesLoadId, requestId, countySwitchRequestId)) return
      setMapLoading(true, 'Rendering map points…')
      renderNotablesOnMap(cachedFiltered, currentActiveCountyCode, true)
      maybeApplyHiResOnCountyLoad()
      notableMeta.textContent = `${notableMeta.textContent} · cached-fallback`
      setTableRenderStatus(`cache-ok rows=${cached.observations.length}`)
      return
    }

    notableCount.className = 'badge warn'
    notableCount.textContent = '0'
    notableMeta.textContent = 'County notables currently unavailable'
    updateStatPills('0', '0', '0')
    notableRows.innerHTML = '<tr><td colspan="7">No notable observations available right now.</td></tr>'
    setTableRenderStatus(`load-error err=${error?.message || 'unknown'}`)
    updateRuntimeLog()
  } finally {
    window.clearTimeout(loadingWatchdog)
    if (isStaleNotablesLoad(notablesLoadId, requestId, countySwitchRequestId)) {
      return
    }
    if (notableCount.textContent === 'Loading…' || notableCount.textContent === 'Refreshing…') {
      if (hadPreviousRows) {
        notableCount.className = 'badge ok'
        notableCount.textContent = previousCountText
        notableMeta.textContent = `${previousMetaText} · refresh-incomplete`
        notableRows.innerHTML = previousRowsHtml
        if (tableRenderStatus) {
          tableRenderStatus.textContent = previousRenderStatus || 'render: refresh-incomplete-restored'
        }
        markMapPartReady('observations')
        return
      }
      notableCount.className = 'badge warn'
      notableCount.textContent = '0'
      updateStatPills('0', '0', '0')
      notableMeta.textContent = 'County notables request did not complete'
      notableRows.innerHTML = '<tr><td colspan="7">County notables request did not complete. Please try again.</td></tr>'
      setTableRenderStatus('load-finalized-no-data')
    }
    markMapPartReady('observations')
    updateRuntimeLog()
  }
}

async function updateCountyForLocation(latitude, longitude, requestId = null, countySwitchRequestId = null) {
  try {
    setMapLoading(true, 'Loading county…')
    const geojson = await fetchCountyContextWithCache(latitude, longitude)
    if ((requestId !== null && isStaleLocationRequest(requestId)) || (countySwitchRequestId !== null && isStaleCountySwitchRequest(countySwitchRequestId))) {
      return { countyLabel: null, countyRegion: null }
    }
    drawCountyOverlay(geojson)
    const countyFeature = Array.isArray(geojson?.features)
      ? geojson.features.find((f) => f?.properties?.isActiveCounty)
      : null
    const countyLabel = countyFeature?.properties?.countyName || countyFeature?.properties?.NAME || countyFeature?.properties?.name || null
    const countyRegion = countyFeature?.properties?.countyRegion || geojson?.activeCountyRegion || null
    return { countyLabel, countyRegion }
  } catch (error) {
    console.error('County context unavailable:', error)
    setMapLoading(false)
    return { countyLabel: null, countyRegion: null }
  }
}

async function loadStateNotables(stateRegion, requestId = null) {
  const notablesLoadId = ++latestNotablesLoadId
  setMapLoading(true, `Loading ${stateRegion} notables…`)
  setTableRenderStatus('load-start')
  notableCount.className = 'badge warn'
  notableCount.textContent = 'Loading…'
  notableMeta.textContent = `Loading rarities for ${stateRegion}…`
  updateStatPills('…', '…', '…')
  notableRows.innerHTML = '<tr><td colspan="7">Loading notables…</td></tr>'

  try {
    const observations = await fetchRegionRarities(stateRegion, 14, 30000)
    if (isStaleNotablesLoad(notablesLoadId, requestId)) return
    renderNotableTable(observations, stateRegion, stateRegion)
    renderNotablesOnMap(observations, '', true)
    setMapLoading(false)
    markMapPartReady('observations')
  } catch (error) {
    if (isStaleNotablesLoad(notablesLoadId, requestId)) return
    console.error('loadStateNotables error:', error)
    notableCount.className = 'badge warn'
    notableCount.textContent = '0'
    notableMeta.textContent = `Error: ${error?.message || error}`
    updateStatPills('0', '0', '0')
    const safeErrorMessage = escapeHtml(error?.message || 'unknown error')
    notableRows.innerHTML = `<tr><td colspan="7">Load failed: ${safeErrorMessage}. Tap Use My Location to retry.</td></tr>`
    setTableRenderStatus(`state-error: ${error?.message || ''}`)
    setMapLoading(false)
    markMapPartReady('observations')
  }
}

async function loadNeighborCounty(lat, lng, countyRegion, countyName) {
  const normalizedCountyRegion = countyRegion ? String(countyRegion).toUpperCase() : null
  let targetLat = Number(lat)
  let targetLng = Number(lng)
  const countySwitchRequestId = ++latestCountySwitchRequestId
  mapLoadState.activeCounty = false
  mapLoadState.stateMask = false
  mapLoadState.observations = false
  setMapLoading(true, 'Switching county…')
  if (mapCountyLabel && countyName) {
    mapCountyLabel.textContent = countyName
    mapCountyLabel.removeAttribute('hidden')
  }

  let countyContextPromise
  let zoomGeojson = null
  const localCountyGeojson = buildCountyGeojsonWithActiveRegion(latestCountyContextGeojson, normalizedCountyRegion || null)
  if (localCountyGeojson) {
    drawCountyOverlay(localCountyGeojson)
    zoomGeojson = localCountyGeojson
    const localCountyFeature = localCountyGeojson.features.find((f) => f?.properties?.isActiveCounty)
    const localCountyLabel = localCountyFeature?.properties?.countyName || localCountyFeature?.properties?.NAME || localCountyFeature?.properties?.name || countyName || null
    const localCountyRegion = String(localCountyFeature?.properties?.countyRegion || normalizedCountyRegion || '').toUpperCase() || null
    const center = getFeatureCenter(localCountyFeature)
    if ((!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) && center) {
      targetLat = center.lat
      targetLng = center.lng
    }
    countyContextPromise = Promise.resolve({ countyLabel: localCountyLabel, countyRegion: localCountyRegion })
  } else {
    if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) {
      if (Number.isFinite(lastUserLat) && Number.isFinite(lastUserLng)) {
        targetLat = lastUserLat
        targetLng = lastUserLng
      } else if (map) {
        const center = map.getCenter()
        targetLat = center.lat
        targetLng = center.lng
      }
    }
    countyContextPromise = updateCountyForLocation(targetLat, targetLng, null, countySwitchRequestId)
  }
  const countyContext = await countyContextPromise

  if (isStaleCountySwitchRequest(countySwitchRequestId)) return

  const resolvedCountyRegion = String(countyContext?.countyRegion || normalizedCountyRegion || '').toUpperCase() || null
  if (!zoomGeojson && latestCountyContextGeojson) zoomGeojson = latestCountyContextGeojson
  zoomToActiveCounty(zoomGeojson, resolvedCountyRegion)

  const label = countyContext?.countyLabel || countyName || ''
  if (mapCountyLabel && label) {
    mapCountyLabel.textContent = label
    mapCountyLabel.removeAttribute('hidden')
  }
  await loadCountyNotables(targetLat, targetLng, resolvedCountyRegion, null, countySwitchRequestId, false)
}

async function requestUserLocation(manualRetry = false) {
  perfStart('location')
  const requestId = ++latestLocationRequestId

  const isSecureOrigin = window.isSecureContext

  if (!('geolocation' in navigator)) {
    setLocationUiUnavailable('Location is not supported on this device/browser.')
    setNotablesUnavailableState(
      'County notables unavailable without location',
      'Location is not supported on this device/browser.',
      'location-unsupported'
    )
    return
  }

  const permissionState = await getGeolocationPermissionState()
  if (permissionState === 'denied') {
    setLocationUiBlocked()
    setNotablesUnavailableState(
      'County notables unavailable until location is allowed',
      'Location permission is blocked. Allow location and tap Use My Location again.',
      'location-denied'
    )
    return
  }

  setLocationUiChecking()
  if (!isSecureOrigin) {
    locationStatus.className = 'badge warn'
    locationStatus.textContent = 'Checking...'
    locationDetail.textContent = 'Non-secure origin detected. Attempting location; if blocked, open over HTTPS or localhost.'
  }
  resetMapLoadState()

  try {
    let position
    try {
      position = await getCurrentPositionAsync({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000
      })
    } catch (highAccuracyError) {
      const retryable = highAccuracyError && (highAccuracyError.code === 2 || highAccuracyError.code === 3)
      if (!retryable) {
        throw highAccuracyError
      }

      locationDetail.textContent = 'High-accuracy attempt failed; retrying with standard accuracy.'
      position = await getCurrentPositionAsync({
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 30000
      })
    }

    const { latitude, longitude, accuracy } = position.coords
    lastUserLat = latitude
    lastUserLng = longitude
    // Persist so next app open can skip the browser prompt
    try { localStorage.setItem('mrm_last_pos', JSON.stringify({ lat: latitude, lng: longitude, ts: Date.now() })) } catch (_) {}
    if (isStaleLocationRequest(requestId)) {
      return
    }

    locationStatus.className = 'badge ok'
    locationStatus.textContent = 'Located'
    const baseLocationDetail = `Lat ${latitude.toFixed(5)}, Lon ${longitude.toFixed(5)} · ±${Math.round(accuracy)} m`
    locationDetail.textContent = baseLocationDetail
    perfEnd('location')
    updateUserLocationOnMap(latitude, longitude, accuracy)

    // Extract cached county region so notables fetch can skip its own TIGER lookup
    const cachedGeoJson = loadCountyContextCache(latitude, longitude)
    const cachedActiveFeature = Array.isArray(cachedGeoJson?.features)
      ? cachedGeoJson.features.find((f) => f?.properties?.isActiveCounty)
      : null
    const cachedCountyRegion = cachedActiveFeature?.properties?.countyRegion || cachedGeoJson?.activeCountyRegion || null

    // Fire county outline and notables in parallel; pass cached region to notables so it skips its own TIGER call.
    perfStart('county')
    const countyContextPromise = updateCountyForLocation(latitude, longitude, requestId)
    const notablesPromise = loadCountyNotables(latitude, longitude, cachedCountyRegion, requestId, null, manualRetry)
    const countyContext = await countyContextPromise
    perfEnd('county')

    if (isStaleLocationRequest(requestId)) {
      return
    }

    if (countyContext?.countyLabel) {
      const regionHint = countyContext?.countyRegion ? ` (${countyContext.countyRegion})` : ''
      locationDetail.textContent = `${baseLocationDetail} · ${countyContext.countyLabel}${regionHint}`
      if (mapCountyLabel) {
        mapCountyLabel.textContent = countyContext.countyLabel
        mapCountyLabel.removeAttribute('hidden')
      }
    }
    await notablesPromise
    updateRuntimeLog()
  } catch (error) {
    let reason = error && error.message ? error.message : 'Location permission was denied or timed out.'

    if (error && typeof error.code === 'number') {
      if (error.code === 1) {
        reason = !isSecureOrigin
          ? 'Location blocked on non-secure origin. Open over HTTPS (or localhost) and try again.'
          : 'Permission denied. On iOS Safari, allow Location for Safari (or Home Screen app) and keep Precise Location enabled.'
      } else if (error.code === 2) {
        reason = 'Position unavailable. Move to an open area and verify Location Services are on.'
      } else if (error.code === 3) {
        reason = 'Location request timed out. Try again while outdoors or on stronger signal.'
      }
    }

    setLocationUiUnavailable(reason)
    setNotablesUnavailableState(
      'County notables unavailable due to location error',
      reason,
      'location-error'
    )
    setMapLoading(false)
    console.error(error)
    updateRuntimeLog()
  }
}

retryLocationBtn.addEventListener('click', () => { void requestUserLocation(true) })
menuInfoBtn.addEventListener('click', () => {
  if (!infoModal) return
  infoModal.removeAttribute('hidden')
})
infoCloseBtn?.addEventListener('click', () => {
  infoModal?.setAttribute('hidden', 'hidden')
})
headerDaysBackSelect?.addEventListener('change', (event) => {
  filterDaysBack = Number(event.target.value) || 7
  if (filterDaysBackInput) filterDaysBackInput.value = String(filterDaysBack)
  updateFilterUi()
  applyActiveFiltersAndRender({ fitToObservations: true })
})
headerCountySelect?.addEventListener('change', (event) => {
  const selectEl = event.target
  const selectedOptionEl = selectEl?.options?.[selectEl.selectedIndex] || null
  const selectedIndex = Number(selectedOptionEl?.dataset?.index)
  let option = Number.isInteger(selectedIndex) ? countyPickerOptions[selectedIndex] : null
  if (!option) {
    const countyRegion = String(selectEl?.value || '').toUpperCase()
    if (!countyRegion) return
    option = countyPickerOptions.find((opt) => String(opt.countyRegion || '').toUpperCase() === countyRegion)
  }
  if (!option || option.isActive) return
  void loadNeighborCounty(option.lat, option.lng, option.countyRegion, option.countyName)
})
filterDaysBackInput?.addEventListener('input', (event) => {
  filterDaysBack = Number(event.target.value) || 7
  updateFilterUi()
  applyActiveFiltersAndRender({ fitToObservations: true })
})
filterAbaMinInput?.addEventListener('input', (event) => {
  filterAbaMin = Number(event.target.value) || 1
  updateFilterUi()
  applyActiveFiltersAndRender()
})
updateFilterUi()
menuSearchBtn.addEventListener('click', () => {
  if (!searchPopover) return
  refreshSearchRegionOptions()
  refreshSearchSpeciesOptions(currentRawObservations)
  updateFilterUi()
  searchPopover.toggleAttribute('hidden')
})
searchCloseBtn?.addEventListener('click', () => {
  searchPopover?.setAttribute('hidden', 'hidden')
})
searchApplyBtn?.addEventListener('click', () => {
  const selectedRegion = String(searchRegionSelect?.value || '').toUpperCase()
  const selectedName = String(searchSpeciesSelect?.value || '').trim()
  const chosenDays = Number(searchDaysBackSelect?.value || filterDaysBack) || filterDaysBack
  selectedSpecies = selectedName || null
  filterDaysBack = chosenDays
  if (filterDaysBackInput) filterDaysBackInput.value = String(filterDaysBack)
  updateFilterUi()
  applyActiveFiltersAndRender({ fitToObservations: true })
  if (selectedRegion) {
    const option = countyPickerOptions.find((opt) => String(opt.countyRegion || '').toUpperCase() === selectedRegion)
    if (option && !option.isActive) {
      void loadNeighborCounty(option.lat, option.lng, option.countyRegion, option.countyName)
    }
  }
  searchPopover?.setAttribute('hidden', 'hidden')
})
menuPinBtn.addEventListener('click', () => {
  notableMeta.textContent = 'Pin mode is defunct for now.'
})
menuRefreshBtn.addEventListener('click', () => {
  void triggerHardRefresh()
})
mapFullscreenToggleBtn.addEventListener('click', () => {
  setMapFullscreen(!isMapFullscreen)
})

mapBasemapToggleBtn?.addEventListener('click', () => {
  if (!map || !osmLayer || !satelliteLayer) return
  if (currentBasemap === 'osm') {
    map.removeLayer(osmLayer)
    satelliteLayer.addTo(map)
    currentBasemap = 'satellite'
    mapBasemapToggleBtn.title = 'Switch to Street map'
  } else {
    map.removeLayer(satelliteLayer)
    osmLayer.addTo(map)
    currentBasemap = 'osm'
    mapBasemapToggleBtn.title = 'Switch to Satellite'
  }
  updateBasemapAuxLayers()
  updateCountyLineColors()
})

mapLocateBtn?.addEventListener('click', () => {
  if (!map) return
  if (lastUserLat !== null && lastUserLng !== null) {
    map.invalidateSize()
    map.setView([lastUserLat, lastUserLng], Math.max(map.getZoom(), 12), { animate: true })
  } else {
    void requestUserLocation()
  }
})

mapLabelToggleBtn?.addEventListener('click', () => {
  labelsVisible = !labelsVisible
  const mapEl = document.querySelector('#map')
  if (mapEl) mapEl.classList.toggle('labels-hidden', !labelsVisible)
  mapLabelToggleBtn.setAttribute('aria-pressed', String(labelsVisible))
  mapLabelToggleBtn.style.opacity = labelsVisible ? '' : '0.5'
  mapLabelToggleBtn.title = labelsVisible ? 'Hide labels' : 'Show labels'
  // Re-render canvas so label visibility takes effect immediately
  lastMapRenderSignature = ''
  applyActiveFiltersAndRender()
})

countyPickerList?.addEventListener('click', (event) => {
  const btn = event.target.closest('.county-option')
  if (!btn) return
  const index = Number(btn.dataset.index)
  const option = countyPickerOptions[index]
  if (!option) return
  closeCountyPicker()
  if (option.isActive) return
  void loadNeighborCounty(option.lat, option.lng, option.countyRegion, option.countyName)
})

document.querySelector('.stats-left')?.addEventListener('click', (e) => {
  const pill = e.target.closest('.obs-stat')
  if (!pill) return
  if (pill.id === 'statConfirmed') {
    selectedReviewFilter = selectedReviewFilter === 'confirmed' ? null : 'confirmed'
    applyActiveFiltersAndRender()
    return
  }
  if (pill.id === 'statPending') {
    selectedReviewFilter = selectedReviewFilter === 'pending' ? null : 'pending'
    applyActiveFiltersAndRender()
    return
  }
  if (pill.id === 'statTotal') {
    selectedReviewFilter = null
    selectedAbaCode = null
    applyActiveFiltersAndRender()
  }
})

document.querySelector('#statsRight')?.addEventListener('click', (e) => {
  const pill = e.target.closest('.stat-aba-pill')
  if (!pill) return
  const code = Number(pill.dataset.code)
  selectedAbaCode = selectedAbaCode === code ? null : (Number.isFinite(code) ? code : null)
  applyActiveFiltersAndRender()
})

abaCodePickerList?.addEventListener('click', (event) => {
  const btn = event.target.closest('.county-option')
  if (!btn) return
  const index = Number(btn.dataset.index)
  const option = abaCodePickerOptions[index]
  if (!option) return
  if (option.value === 'all') selectedAbaCode = null
  else selectedAbaCode = Number(option.value)
  applyActiveFiltersAndRender()
  closeAbaCodePicker()
})

document.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Node)) return
  if (searchPopover && !searchPopover.hasAttribute('hidden') && !searchPopover.contains(target) && !menuSearchBtn.contains(target)) {
    searchPopover.setAttribute('hidden', 'hidden')
  }
  if (countyPicker && !countyPicker.contains(target)) {
    closeCountyPicker()
  }
  if (abaCodePicker && !abaCodePicker.contains(target) && !statsRight.contains(target)) {
    closeAbaCodePicker()
  }
  if (infoModal && !infoModal.hasAttribute('hidden')) {
    const shouldClose = target instanceof Element && target.getAttribute('data-close') === 'info'
    if (shouldClose) infoModal.setAttribute('hidden', 'hidden')
  }
})

notableRows.addEventListener('click', (event) => {
  const pinBtn = event.target.closest('.row-pin-btn')
  if (pinBtn) {
    const lat = pinBtn.dataset.lat
    const lng = pinBtn.dataset.lng
    if (lat && lng) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`,
        '_blank', 'noopener'
      )
    }
    return
  }

  const btn = event.target.closest('.species-btn')
  if (!btn) return
  const species = btn.dataset.species
  if (!species) return

  // Highlight row
  notableRows.querySelectorAll('tr.row-highlighted').forEach((r) => r.classList.remove('row-highlighted'))
  const row = btn.closest('tr')
  if (row) row.classList.add('row-highlighted')

  // Zoom map to point(s)
  const pts = speciesMarkers.get(species)
  if (!pts || pts.length === 0 || !map) return
  if (map) map.invalidateSize()
  if (pts.length === 1) {
    map.setView([pts[0].lat, pts[0].lng], Math.max(map.getZoom(), 13), { animate: true })
    // Show same rich popup as canvas click
    const pt = pts[0]
    const locId = pt.item?.locId ? String(pt.item.locId) : null
    const locName = pt.item?.locName ? escapeHtml(String(pt.item.locName)) : null
    const abaBadge = renderAbaCodeBadge(pt.abaCode)
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pt.lat},${pt.lng}`)}`
    const speciesEl = locId
      ? `<a class="obs-popup-species" href="https://ebird.org/hotspot/${encodeURIComponent(locId)}" target="_blank" rel="noopener">${pt.safeSpecies}</a>`
      : `<span class="obs-popup-species">${pt.safeSpecies}</span>`
    const header = `<div class="obs-popup-header">${abaBadge}${speciesEl}<a class="obs-popup-mapit" href="${mapsUrl}" target="_blank" rel="noopener" title="Map it">&#x1F4CD;</a></div>`
    const checklistItems = (pt.subIds || []).map((sid, i) => {
      const label = formatObsDateTime(pt.subDates?.[i])
      return `<li><a href="https://ebird.org/checklist/${encodeURIComponent(sid)}" target="_blank" rel="noopener">${escapeHtml(label)}</a></li>`
    })
    const checklistSection = checklistItems.length
      ? `<ul class="obs-popup-checklist">${checklistItems.join('')}</ul>`
      : ''
    const html = `<div class="obs-popup-inner">${header}${checklistSection}</div>`
    if (!fastCanvasPopup) fastCanvasPopup = L.popup({ maxWidth: 220, className: 'obs-popup' })
    fastCanvasPopup.setLatLng([pt.lat, pt.lng]).setContent(html).openOn(map)
  } else {
    const lats = pts.map((p) => p.lat)
    const lngs = pts.map((p) => p.lng)
    map.fitBounds(L.latLngBounds([Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]), { padding: [40, 40], maxZoom: 13, animate: true })
  }
})

document.querySelector('.notable-table thead').addEventListener('click', (event) => {
  const th = event.target.closest('th[data-sort]')
  if (!th) return
  const col = th.dataset.sort
  if (sortState.col === col) {
    sortState.dir = sortState.dir === 'desc' ? 'asc' : 'desc'
  } else {
    sortState.col = col
    sortState.dir = 'desc'
  }
  applySortAndRender()
})

notableRows.addEventListener('change', (event) => {
  const cb = event.target.closest('.obs-vis-cb')
  if (!cb) return
  const species = cb.dataset.species
  if (!species) return
  const show = cb.checked
  if (show) hiddenSpecies.delete(species)
  else hiddenSpecies.add(species)
  const pts = speciesMarkers.get(species)
  if (pts) { pts.forEach((p) => { p.hidden = !show }); fastCanvasOverlay?.redraw() }
  // Sync toggle-all checkbox state
  const toggleAll = document.querySelector('#toggleAllVis')
  if (toggleAll) {
    const total = notableRows.querySelectorAll('.obs-vis-cb').length
    if (hiddenSpecies.size === 0) { toggleAll.checked = true; toggleAll.indeterminate = false }
    else if (hiddenSpecies.size >= total) { toggleAll.checked = false; toggleAll.indeterminate = false }
    else { toggleAll.indeterminate = true }
  }
})

document.querySelector('#toggleAllVis')?.addEventListener('change', (event) => {
  const show = event.target.checked
  event.target.indeterminate = false
  speciesMarkers.forEach((pts, species) => {
    if (show) { hiddenSpecies.delete(species); pts.forEach((p) => { p.hidden = false }) }
    else { hiddenSpecies.add(species); pts.forEach((p) => { p.hidden = true }) }
  })
  fastCanvasOverlay?.redraw()
  notableRows.querySelectorAll('.obs-vis-cb').forEach((cb) => { cb.checked = show })
})

setMode('map')
checkApi()

// On startup, use cached location first (if available), otherwise request current location.
;(async () => {
  try {
    const stored = localStorage.getItem('mrm_last_pos')
    if (stored) {
      const { lat, lng, ts } = JSON.parse(stored)
      const ageMs = Date.now() - ts
      // Keep cached location for up to 7 days
      if (Number.isFinite(lat) && Number.isFinite(lng) && ageMs < 7 * 24 * 60 * 60 * 1000) {
        lastUserLat = lat
        lastUserLng = lng
        const requestId = ++latestLocationRequestId
        locationStatus.className = 'badge ok'
        locationStatus.textContent = 'Located'
        locationDetail.textContent = `Lat ${lat.toFixed(5)}, Lon ${lng.toFixed(5)} · cached`
        resetMapLoadState()
        updateUserLocationOnMap(lat, lng, null)
        const countyContextPromise = updateCountyForLocation(lat, lng, requestId)
        const notablesPromise = loadCountyNotables(lat, lng, null, requestId, null, false)
        const countyContext = await countyContextPromise
        if (!isStaleLocationRequest(requestId)) {
          locationStatus.className = 'badge ok'
          locationStatus.textContent = 'Located'
          locationDetail.textContent = `Lat ${lat.toFixed(5)}, Lon ${lng.toFixed(5)} · cached`
          if (countyContext?.countyLabel) {
            locationDetail.textContent += ` · ${countyContext.countyLabel}`
            if (mapCountyLabel) { mapCountyLabel.textContent = countyContext.countyLabel; mapCountyLabel.removeAttribute('hidden') }
          }
        }
        await notablesPromise
        // Fresh location can be requested explicitly via "Use My Location".
        return
      }
    }
  } catch (_) {}

  // No cache available: request current location.
  void requestUserLocation(false)
})()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))

    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  })
}
