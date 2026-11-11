import { describe, expect, it } from 'vitest'
import { statusFilterOptions, vehicleFilterOptions } from './AgendaToolbar'
import { ESTADOS_AGENDA } from './AgendaGrid'
import type { Vehicle } from '../types'

const vehicle = (overrides: Partial<Vehicle>): Vehicle => ({
  vehicleId: 'pk-1',
  id: 'AB123CD',
  type: 'Furgón',
  capacityKg: 1500,
  status: 'Disponible' as Vehicle['status'],
  ...overrides,
})

describe('filtro de estados', () => {
  it('ofrece exactamente los estados de la leyenda, sin desincronizarse', () => {
    expect(statusFilterOptions().slice(1)).toEqual(
      ESTADOS_AGENDA.map((status) => ({ value: status.key, label: status.label })),
    )
  })

  it('incluye Finalizada', () => {
    expect(statusFilterOptions().map((option) => option.value)).toContain('Finalizada')
  })
})

describe('filtro de vehículos', () => {
  it('usa la PK que guarda la solicitud, no la patente', () => {
    const options = vehicleFilterOptions([vehicle({})])
    expect(options[1]).toEqual({ value: 'pk-1', label: 'AB123CD · Furgón' })
  })
})
