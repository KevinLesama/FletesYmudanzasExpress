import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { test } from 'node:test'
import { build } from 'esbuild'

const root = process.cwd()

const agendaTrip = {
  id: 'FEX-9001',
  client: 'Dana Merched',
  phone: '+54 11 5903 7952',
  status: 'Confirmada',
  date: '2026-11-02',
  arrivalRange: ['08:30', '09:00'],
  serviceRange: ['09:00', '11:00'],
  origin: { label: 'Origen', address: 'Av. Corrientes 1234', barrio: 'CABA', floor: '', elevator: false },
  destination: { label: 'Destino', address: 'Av. Santa Fe 4321', barrio: 'Palermo', floor: '', elevator: false },
  cargo: { items: [], approxUnits: 0, fragile: false, notes: '' },
  price: 0,
  depositRequired: 0,
  depositReceived: 0,
  confirmed: true,
}

test('TripDetailModal se abre con un viaje completo y con teléfono faltante', async () => {
  const outdir = mkdtempSync(join(root, '.tmp-modal-smoke-'))
  const entry = join(outdir, 'entry.tsx')
  const outfile = join(outdir, 'entry.cjs')

  writeFileSync(
    entry,
    `import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { TripDetailModal } from '../src/components/TripDetailModal'
export function renderModal(trip) {
  return renderToString(createElement(TripDetailModal, { trip, role: 'admin', onClose() {} }))
}
`,
  )

  try {
    await build({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile,
      logLevel: 'silent',
    })

    const require = createRequire(import.meta.url)
    const { renderModal } = require(outfile) as { renderModal: (trip: unknown) => string }

    assert.equal(typeof renderModal(agendaTrip), 'string')
    assert.doesNotThrow(() => renderModal({ ...agendaTrip, phone: '' }))
  } finally {
    rmSync(outdir, { recursive: true, force: true })
  }
})
