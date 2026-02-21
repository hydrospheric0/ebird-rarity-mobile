# eBird Rarity Mobile — Current App Wireframe (Operational Baseline)

This document captures how the app behaves **today** so structural refactors can preserve/strengthen functionality.

## 1) UI Shell (Current)

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                     │
│  [Title] [County Select] [Days Back Select] [Status/Perf/Location badges] │
├────────────────────────────────────────────────────────────────────────────┤
│ MAP STRIP                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Leaflet map                                                         │   │
│  │  - Basemap toggle (street/satellite)                                │   │
│  │  - Fullscreen toggle                                                 │   │
│  │  - Locate                                                            │   │
│  │  - Label toggle                                                      │   │
│  │  - State/county overlay masking + active outline                     │   │
│  │  - County centroid dots for drill-in                                 │   │
│  │  - Canvas observation layer (county mode)                            │   │
│  │  - Map popup + county label pill                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  [Loading overlay / map-part readiness]                                     │
├────────────────────────────────────────────────────────────────────────────┤
│ MAIN PANEL (Map mode active)                                                │
│  [Stat pills: total / confirmed / pending + ABA breakdown]                  │
│  [County picker popover] [ABA picker popover]                               │
│  [Notable table]                                                             │
│   - County mode: species rows                                                │
│   - State mode: county summary rows                                          │
├────────────────────────────────────────────────────────────────────────────┤
│ BOTTOM MENU                                                                  │
│  [Info] [Search] [Pin] [Hard Refresh]                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

## 2) View Modes + Table Behavior

```text
County View (US-XX-### active)
- Table shows species-level grouped rows
- Canvas points are rendered on the map
- Row click highlights species and zooms to sightings

State View (US-XX active)
- Table shows one summary row per county (rarity + ABA mix)
- Canvas sighting points are suppressed (no species cloud at state level)
- County row click/Map county click drills into that county
- Drill-in loads full county notables + species table
```

## 3) Overlay / Mask Semantics

```text
County mode
- Active county clear/focused
- Neighbor counties visible and interactive

State mode
- Active state is clear
- Outside of selected state is masked/dimmed (inverse mask)
- State outline remains visible
```

## 4) Interaction Wireframe (Key Flows)

```text
A) Startup
  app init
   -> API check
   -> location resolve (cache first, then geolocation)
   -> county context fetch
   -> county notables fetch
   -> filter + render

B) State exploration
  Search popover -> select state -> Apply
   -> state notables fetch (region-level)
   -> state overlay render
   -> county summary table render
   -> wait for county selection

C) County expansion
  click county row OR county polygon/dot
   -> activate county
   -> county context + county notables fetch
   -> species table + map points render
```

## 5) Component Inventory (Current Responsibilities)

- `src/main.js`
  - App shell/template wiring
  - Global UI + filter state
  - API calls and caching
  - Overlay build/render logic
  - Table + map rendering logic
  - Interaction handlers (map/table/popovers)

## 6) Refactor Seams (for Robust Functionality)

Suggested module boundaries while preserving existing UX:

1. `ui/controls/`
  - Header/search/filter/popover controls
  - No network/map logic

2. `ui/table/`
  - County summary renderer (state)
  - Species renderer + sorting (county)
  - Row interaction event mapping

3. `map/overlay/`
  - County/state mask composition
  - Active/neighbor polygon layers
  - County dot layer

4. `map/points/`
  - Canvas point rendering + hit testing
  - Popup presentation

5. `data/`
  - API clients (`county_notables`, `rarities`, geometry)
  - Cache read/write policy and staleness

6. `state/`
  - App view mode (`state` vs `county`)
  - Active region/county + filter store
  - Derivations used by UI/map/table

## 7) Hardening Checklist for Refactor Validation

- State mask remains inverse (selected state clear, outside dimmed).
- State table remains county-summary only until county click.
- County drill-in always transitions to species table + points.
- Switching counties cannot leave stale rows or stale overlays.
- Filters produce consistent results in both state and county contexts.
- Cached data fallback does not break current active-region context.

## 8) Robust Selection Flows (Target Behavior)

```text
Selection Hierarchy
US -> State -> County -> Species

Core Rule
- Every selection action must produce exactly one next-level context,
  and all UI surfaces (map, table, selectors, pills) must agree on it.
```

### 8.1 Region/County Flow Contract

```text
Region = US
- County selector disabled
- ABA floor forced to >= 3
- Table = national summary context
- Map = no county drill unless state selected next

Region = US-XX (state)
- County selector enabled
- Table = county summary rows
- Map = county polygons and dots are interactive drill-ins
- Click county (map OR table) -> County context

Region = US-XX-### (county)
- Table = species rows
- Map = points + popups
- Species row click -> map focus/highlight
```

### 8.2 Deterministic Selection Priority

When multiple controls could imply context, resolve in this order:

1. Explicit map/table county click (strongest)
2. Search apply with county value
3. Search apply with state/US value
4. Existing active context (fallback)

This prevents stale selector values from silently overriding direct user actions.

### 8.3 Selection State Wireframe (Logical)

```text
[Input Action]
   -> [Resolve Target Context]
   -> [Apply Guardrails]
       - US => abaMin >= 3
       - state => county interactions ON
       - county => species interactions ON
   -> [Fetch Data]
   -> [Render Sync]
       map overlay
       table mode
       selectors/pills
   -> [Ready]
```

## 9) Responsivity Wireframe (Behavior by Viewport)

```text
Mobile Narrow (primary)
- Bottom menu always reachable
- Search popover stack order above menu
- Table vertical scroll independent from map strip
- Header controls never overlap status badges

Mobile Wide / Small Tablet
- Map controls remain top-right, non-overlapping county label
- County summary rows keep CTA tap-target size
- Sliders (days/ABA) remain thumb-usable at 44px+ touch comfort

Failure handling (all sizes)
- Loading state visible within 150ms
- Timeout/failure keeps last known-good table when possible
- No hidden disabled control without visible reason text
```

### 9.1 Interaction Responsivity Checklist

- Tap county polygon while map is panning slowly: still resolves correct county.
- Open search, rotate device, apply filters: no selector reset unless intentional.
- Rapid state -> county -> state switching: no stale table/map mismatch.
- Slider adjustments + apply: immediate visual confirmation of active value.

## 10) How to Identify Issues Effectively in a Wireframe Setting

Use a scenario-first method instead of static screenshot review.

### 10.1 Build a Minimal Flow Test Grid

For each flow, define: Start Context -> Action -> Expected End Context.

Example grid:

```text
Start: State (US-AZ)
Action: Tap county polygon
Expect: County context + species table + points visible

Start: US
Action: Open search
Expect: County disabled + ABA slider min=3 + clear helper text

Start: County
Action: Change region to state
Expect: County summaries + map county drill-in still active
```

### 10.2 Instrument the Wireframe with Observable States

Even in wireframe review, require each panel to visibly show:

- Active context label (US/state/county)
- Active filters (days, ABA min, species)
- Render mode label (summary vs species rows)
- Disabled-control reason labels

If reviewers cannot tell these at a glance, the wireframe hides defects.

### 10.3 Use Mismatch Hunting (Most Effective)

At every step ask:

1. Does map context match table context?
2. Do selectors show current true state, not stale previous state?
3. Does interaction affordance match behavior (clickable looks clickable)?
4. Is there exactly one obvious next action?

Most production bugs in this app class are context mismatches, not rendering errors.

### 10.4 Add Explicit Wireframe Error States

Include dedicated frames for:

- API timeout with recoverable cached data
- Geolocation denied
- Empty result set after strict filter
- Invalid selection combination (for example county chosen while region=US)

Designing these frames up front dramatically reduces regressions later.

### 10.5 Review Cadence for Robustness

- Pass 1: happy-path continuity (single user)
- Pass 2: rapid switching stress (fast taps and mode changes)
- Pass 3: resilience states (timeouts/denials/empty)
- Pass 4: accessibility + touch target audit

If a flow fails any pass, update wireframe before code changes.
