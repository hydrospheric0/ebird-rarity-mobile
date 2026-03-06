// SW_VERSION is stamped by pushit.sh on every deploy so the browser detects
// a byte change in this file and re-installs, triggering activate which clears
// all stale caches and reloads every open tab to the latest build.
const SW_VERSION = '0.6.5'
const LEGACY_CACHE_PREFIXES = ['rarity-mobile-', 'workbox-', 'vite-']

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
          .map((key) => caches.delete(key))
      )
    } catch (_) {}
    await self.clients.claim()
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    await Promise.all(clients.map((client) => client.navigate(client.url).catch(() => null)))
  })())
})

self.addEventListener('fetch', () => {
  // No caching — all requests go to the network.
  // The SW exists solely to detect new versions and reload tabs.
})
