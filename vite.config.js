import { defineConfig, loadEnv } from 'vite'

const buildTag = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const explicitApiBase = (env.VITE_API_BASE_URL || '').trim()

  if (command === 'build' && mode === 'production' && !explicitApiBase) {
    throw new Error('Missing VITE_API_BASE_URL. Refusing production build to avoid accidental wrong-worker deployment.')
  }

  return {
    define: {
      __BUILD_TAG__: JSON.stringify(buildTag),
    },
    base: './',
    server: {
      proxy: {
        '/worker': {
          target: explicitApiBase || 'https://ebird-rarity-mapper.bartwickel.workers.dev',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/worker/, '')
        }
      }
    }
  }
})
