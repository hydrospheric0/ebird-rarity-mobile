# Selection Flow Test Matrix (Release Template)

Use this checklist before each release to catch state/selection regressions.

## Run Info

- Release/Tag:
- Date:
- Tester:
- Device(s):
- Browser(s):
- Build/Env:

## Severity Legend

- `P0` Blocking / data-context wrong
- `P1` Major UX break
- `P2` Minor mismatch / polish

## Core Context Checks (apply to every row)

- Map context matches table context
- Region/county selectors reflect true active context
- Filter pills match applied filters
- Disabled controls show visible reason

## Test Matrix

| ID | Priority | Start Context | Action | Expected End Context | Map Expectation | Table Expectation | Selector/Filter Expectation | Result (Pass/Fail) | Notes/Bug ID |
|---|---|---|---|---|---|---|---|---|---|
| SF-01 | P0 | County (`US-XX-###`) | Open Search, select State, Apply | State (`US-XX`) | County polygons/dots clickable for drill-in | County summary rows | County selector enabled |  |  |
| SF-02 | P0 | State (`US-XX`) | Tap county polygon on map | County (`US-XX-###`) | Points visible after county load | Species rows | Active county updated in selectors |  |  |
| SF-03 | P0 | State (`US-XX`) | Tap county row in table | County (`US-XX-###`) | Points visible after county load | Species rows | Active county updated in selectors |  |  |
| SF-04 | P0 | Any | Select `US` region, Apply | US | No state/county stale overlay context | National summary context | County selector disabled with reason; ABA min forced `>=3` |  |  |
| SF-05 | P0 | US | Open Search | US (unchanged) | No map/table mismatch | Stable summary context | ABA slider min remains `3`; days slider stable |  |  |
| SF-06 | P1 | US | Select State, Apply | State (`US-XX`) | State overlay interactive | County summary rows | County selector re-enabled |  |  |
| SF-07 | P1 | County | Change Days + ABA, Apply | County (same) | Points update to filters | Species rows filtered correctly | Pills/sliders reflect applied values |  |  |
| SF-08 | P1 | State | Change Days + ABA, Apply | State (same) | County drill-in still available | Summary rows reflect filters | Filters preserved in UI |  |  |
| SF-09 | P1 | County | Rapid switch County -> State -> County | Final selected county | No stale overlays/ghost layers | Final county species rows only | No stale selector value overrides |  |  |
| SF-10 | P2 | Any | Rotate viewport / resize | Same context | Controls remain tappable/non-overlapping | Table still usable | Popover controls still reachable |  |  |

## Failure-State Matrix

| ID | Priority | Trigger | Expected Behavior | Result (Pass/Fail) | Notes/Bug ID |
|---|---|---|---|---|---|
| FS-01 | P0 | API timeout | Clear error + no context corruption |  |  |
| FS-02 | P0 | Geolocation denied | Clear blocked message + recovery path |  |  |
| FS-03 | P1 | Empty results after strict filters | Empty-state message, no stale rows |  |  |
| FS-04 | P1 | Cache fallback path | Last-known-good context remains coherent |  |  |

## Quick Gate (Release Decision)

- `P0` failures: `0` required
- `P1` failures: `0` preferred (`<=1` with approved mitigation)
- `P2` failures: tracked for follow-up

**Ship decision:** Pass / Hold

**Approved by:**
