import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const agendaSource = readFileSync('src/pages/AgendaPage.tsx', 'utf8')
const modalSource = readFileSync('src/components/TripDetailModal.tsx', 'utf8')

test('un click en una reserva de la Agenda abre TripDetailModal', () => {
  assert.match(agendaSource, /onOpenTrip=\{\s*\(trip\)\s*=>\s*openTripDetail\(trip\.id\)\s*\}/)
  assert.match(agendaSource, /const openTripDetail = \(tripId: string\) => \{[\s\S]*?setSelectedId\(tripId\)/)
  assert.match(agendaSource, /\{selected && \([\s\S]*?<TripDetailModal/)
})

test('el modal sólo renderiza WhatsApp cuando hay un href válido', () => {
  assert.match(modalSource, /const wa = tripWhatsAppHref\(trip\)/)
  assert.match(modalSource, /\{wa && \([\s\S]*?href=\{wa\}/)
})
