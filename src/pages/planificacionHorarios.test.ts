import { describe, expect, it } from 'vitest'
import { estimatedArrival } from './planificacionHorarios'

describe('hora de llegada estimada', () => {
  it('se calcula con la hora de inicio, carga y duración de ruta', () => {
    expect(estimatedArrival('11:00', 60, 42)).toBe('12:42')
  })

  it('permanece pendiente si todavía falta la ruta o el tiempo de carga', () => {
    expect(estimatedArrival('11:00', 60, null)).toBe('')
    expect(estimatedArrival('11:00', null, 42)).toBe('')
  })

  it('no genera una hora inválida después de medianoche', () => {
    expect(estimatedArrival('23:30', 15, 20)).toBe('')
  })
})
