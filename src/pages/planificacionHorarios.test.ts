import { describe, expect, it } from 'vitest'
import {
  agendaBlockRange,
  agendaRange,
  estimatedArrival,
  estimatedFinish,
  occupiedUntil,
  planningTimesComplete,
  shiftTime,
} from './planificacionHorarios'

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

describe('desplazamiento de una hora', () => {
  it('suma minutos dentro del mismo día', () => {
    expect(shiftTime('12:30', 45)).toBe('13:15')
  })

  it('no altera la hora cuando la suma es cero', () => {
    expect(shiftTime('09:05', 0)).toBe('09:05')
  })

  it('cruza la hora correctamente', () => {
    expect(shiftTime('13:50', 25)).toBe('14:15')
  })

  it('devuelve vacío si el resultado pasa de medianoche', () => {
    expect(shiftTime('23:50', 20)).toBe('')
  })

  it('devuelve vacío con entradas inválidas', () => {
    expect(shiftTime('', 30)).toBe('')
    expect(shiftTime('24:00', 10)).toBe('')
    expect(shiftTime('12:60', 10)).toBe('')
    expect(shiftTime('12:30', -10)).toBe('')
    expect(shiftTime('12:30', 1.5)).toBe('')
  })
})

describe('fin estimado del trabajo', () => {
  it('suma la descarga a la llegada', () => {
    expect(estimatedFinish('14:00', 30)).toBe('14:30')
  })

  it('queda pendiente sin minutos de descarga', () => {
    expect(estimatedFinish('14:00', null)).toBe('')
  })

  it('no inventa una hora si cruza la medianoche', () => {
    expect(estimatedFinish('23:45', 30)).toBe('')
  })
})

describe('ocupación en agenda', () => {
  it('suma el margen operativo al fin del trabajo', () => {
    expect(occupiedUntil('14:30', 30)).toBe('15:00')
  })

  it('queda pendiente sin margen cargado', () => {
    expect(occupiedUntil('14:30', null)).toBe('')
  })
})

describe('franja que ocupa el viaje en la agenda', () => {
  it('llega hasta la llegada más descarga más margen, no hasta la llegada', () => {
    expect(agendaRange(['11:00', '13:00'], 60, 30)).toEqual(['11:00', '14:30'])
  })

  it('sin descarga confirmada se queda en la llegada', () => {
    expect(agendaRange(['11:00', '13:00'], null, 30)).toEqual(['11:00', '13:00'])
  })

  it('sin margen configurado se queda en la llegada', () => {
    expect(agendaRange(['11:00', '13:00'], 60, null)).toEqual(['11:00', '13:00'])
  })

  it('mantiene el viaje pendiente igual que hoy, sin inventar fin', () => {
    expect(agendaRange(['11:00', ''], 60, 30)).toEqual(['11:00', ''])
  })

  it('no genera un fin inválido si la suma cruza la medianoche', () => {
    expect(agendaRange(['22:30', '23:30'], 90, 30)).toEqual(['22:30', '23:30'])
  })
})

describe('bloque de la agenda según la planificación', () => {
  const planificado = { serviceRange: ['11:00', '13:00'] as const, loadMinutes: 60, downloadMinutes: 60 }

  it('con llegada, carga y descarga definidas muestra inicio y fin del trabajo', () => {
    expect(planningTimesComplete(planificado)).toBe(true)
    expect(agendaBlockRange(planificado, 30)).toEqual({
      start: '11:00',
      end: '14:30',
      complete: true,
    })
  })

  it('sin descarga confirmada no muestra ningún fin', () => {
    const sinDescarga = { ...planificado, downloadMinutes: null }
    expect(planningTimesComplete(sinDescarga)).toBe(false)
    expect(agendaBlockRange(sinDescarga, 30).complete).toBe(false)
  })

  it('sin carga confirmada no muestra ningún fin', () => {
    const sinCarga = { ...planificado, loadMinutes: undefined }
    expect(planningTimesComplete(sinCarga)).toBe(false)
    expect(agendaBlockRange(sinCarga, 30).complete).toBe(false)
  })

  it('sin llegada confirmada no muestra ningún fin', () => {
    const sinLlegada = { ...planificado, serviceRange: ['11:00', ''] as const }
    expect(planningTimesComplete(sinLlegada)).toBe(false)
    expect(agendaBlockRange(sinLlegada, 30).complete).toBe(false)
  })
})
