# eBird Rarity Mapper Mobile (Standalone)

This is a separate mobile-focused tool intended to evolve toward an installable app experience while remaining independent from the desktop/browser version.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Notes

- Uses the existing backend Worker endpoint configured in `src/config/api.js`.
- Includes a minimal app shell, web manifest, and service worker.
- Designed as a standalone project so mobile iteration does not impact the main web app.
