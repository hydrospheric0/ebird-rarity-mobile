# eBird Rarity Mobile

## About the tool
This mobile-first version of eBird Rarity Mapper helps birders quickly explore notable eBird reports and county-level rarity patterns from phones.
It uses a static GitHub Pages frontend and a Cloudflare Worker API backend (same architecture as desktop).
The app is hosted at: https://hydrospheric0.github.io/ebird-rarity-mobile/

## Features
- Mobile-optimized map and controls for county rarity browsing
- County switching directly from map overlays and county picker
- Date-range and ABA rarity filtering
- Fast marker rendering for larger county result sets
- GitHub Pages deployment via pushit.sh

## How to use
1. Open the app in your mobile browser.
2. Tap **Use My Location** to load your county notables.
3. Adjust days-back and ABA filters.
4. Tap neighboring counties on the map (or use the county picker) to switch county context.
5. Tap map points for species/checklist details.

## Development

### Run locally
- `npm install`
- `VITE_API_BASE_URL="https://ebird-rarity-mapper.bartwickel.workers.dev" npm run dev`

Dev uses a `/worker` proxy to avoid CORS issues.

### Production build
- `VITE_API_BASE_URL="https://ebird-rarity-mapper.bartwickel.workers.dev" npm run build`

Production builds require `VITE_API_BASE_URL` (the build will fail without it) to prevent accidentally deploying against the wrong worker.

## Support this project
If you find this tool useful, please consider supporting its development:

<a href="https://buymeacoffee.com/bartg">
	<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" width="180" />
</a>
