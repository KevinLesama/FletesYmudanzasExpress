import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { tripWhatsAppHref } from '../src/tripWhatsApp.ts'

test('el botón de WhatsApp del modal abre el número argentino normalizado', () => {
  const href = tripWhatsAppHref({
    phone: '+541159037952',
    client: 'Dana',
    id: 'FEX-1035',
    date: '2026-11-02',
    serviceRange: ['09:00', '11:00'],
  })

  assert.equal(href.split('?')[0], 'https://wa.me/5491159037952')
  assert.equal(
    href,
    `https://wa.me/5491159037952?text=${encodeURIComponent(
      'Hola Dana, te escribimos por tu viaje FEX-1035 del 2 nov 2026 · servicio 09:00 a 11:00.',
    )}`,
  )
})

test('el link del modal colapsa un +54 duplicado', () => {
  const href = tripWhatsAppHref({
    phone: '+54 541159037952',
    client: 'Dana',
    id: 'FEX-1035',
    date: '2026-11-02',
    serviceRange: ['09:00', '11:00'],
  })

  assert.equal(href.split('?')[0], 'https://wa.me/5491159037952')
})

const agendaTrip = {
  phone: '+54 11 5903 7952',
  client: 'Dana Merched',
  id: 'FEX-9001',
  date: '2026-11-02',
  serviceRange: ['09:00', '11:00'],
}

test('un viaje real de la Agenda genera el link del modal', () => {
  const href = tripWhatsAppHref(agendaTrip)

  assert.equal(href.split('?')[0], 'https://wa.me/5491159037952')
  assert.match(decodeURIComponent(href), /servicio 09:00 a 11:00/)
})

test('sin teléfono no se genera link y el modal no muestra el botón', () => {
  assert.equal(tripWhatsAppHref({ ...agendaTrip, phone: '' }), '')
  assert.equal(tripWhatsAppHref({ ...agendaTrip, phone: '   ' }), '')
  assert.equal(tripWhatsAppHref({ ...agendaTrip, phone: undefined }), '')
})

test('sin serviceRange se omite el tramo del servicio, sin romper el link', () => {
  const href = tripWhatsAppHref({ ...agendaTrip, serviceRange: undefined })
  const text = decodeURIComponent(href)

  assert.equal(href.split('?')[0], 'https://wa.me/5491159037952')
  assert.doesNotMatch(text, /servicio/)
  assert.match(text, /FEX-9001 del 2 nov 2026\./)
})

test('un serviceRange vacío tampoco agrega el tramo del servicio', () => {
  const href = tripWhatsAppHref({ ...agendaTrip, serviceRange: ['', ''] })

  assert.doesNotMatch(decodeURIComponent(href), /servicio/)
})

test('sin fecha ni id el mensaje sigue siendo válido', () => {
  const href = tripWhatsAppHref({ ...agendaTrip, id: '', date: '', serviceRange: undefined })

  assert.equal(decodeURIComponent(href.split('?text=')[1]), 'Hola Dana Merched, te escribimos por tu viaje.')
})

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : []
  })
}

test('sólo format.ts construye URLs de WhatsApp', () => {
  const offenders = sourceFiles('src').filter((file) => {
    const content = readFileSync(file, 'utf8')
    return /wa\.me|api\.whatsapp\.com|whatsapp:\/\//.test(content) && relative('src', file) !== 'format.ts'
  })

  assert.deepEqual(offenders, [])
})

