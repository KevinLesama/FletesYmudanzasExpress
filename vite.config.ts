import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const PAGES: Record<string, string> = {
  '/': '/ingreso.html',
  '/ingreso': '/ingreso.html',
  '/agenda': '/agenda.html',
  '/solicitudes': '/solicitudes.html',
  '/solicitudes/nueva': '/nueva-solicitud.html',
  '/planificacion': '/planificacion.html',
  '/flota': '/flota.html',
  '/pagos': '/pagos.html',
  '/chofer': '/chofer.html',
  '/chofer/config': '/chofer-config.html',
}

const PAGE_HTML = [
  'ingreso.html',
  'agenda.html',
  'solicitudes.html',
  'nueva-solicitud.html',
  'planificacion.html',
  'flota.html',
  'pagos.html',
  'chofer.html',
  'chofer-config.html',
]

function mpaRoutes(): Plugin {
  const rewrite = (req: { url?: string }): void => {
    const queryIndex = (req.url ?? '').indexOf('?')
    const path = (queryIndex >= 0 ? req.url!.slice(0, queryIndex) : req.url) as string
    const target = PAGES[path]
    if (target) {
      const query = queryIndex >= 0 ? req.url!.slice(queryIndex) : ''
      req.url = target + query
    }
  }
  return {
    name: 'mpa-extensionless-routes',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req)
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req)
        next()
      })
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), mpaRoutes()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: Object.fromEntries(
        PAGE_HTML.map((file) => [file.replace('.html', ''), resolve(__dirname, file)]),
      ),
    },
  },
})