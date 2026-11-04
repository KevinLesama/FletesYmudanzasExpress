import { describe, expect, it } from 'vitest'
import { color } from '../design/tokens'
import {
  estadoCampoAsignacion,
  etiquetaDisponibilidadParcial,
  estiloOpcionPlanificacion,
  mensajeAgendaIncompleta,
} from './planificacionOpciones'

describe('apariencia de recursos en planificación', () => {
  it('mantiene en negro los recursos operativos sin advertencias', () => {
    expect(estiloOpcionPlanificacion({
      operativa: true,
      bloqueada: false,
      tieneAdvertencias: false,
    })).toEqual({ disabled: false, color: color.ink })
  })

  describe('estado de verificación parcial de agenda', () => {
    it('no interpreta bloqueos parciales como conflictos reales', () => {
      expect(etiquetaDisponibilidadParcial({
        bloqueada: true,
        verificada: false,
        tieneAdvertencias: true,
      })).toBe('Agenda sin verificar')
    })

    it('mantiene el estado verificando mientras espera el resultado de la agenda', () => {
      expect(etiquetaDisponibilidadParcial({
        bloqueada: false,
        verificada: false,
        tieneAdvertencias: false,
        verificando: true,
      })).toBe('Verificando agenda…')
    })

    it('muestra advertencias cuando el horario completo ya fue verificado', () => {
      expect(etiquetaDisponibilidadParcial({
        bloqueada: false,
        verificada: true,
        tieneAdvertencias: true,
      })).toBe('Agenda verificada con advertencias')
    })

    it('distingue una agenda verificada sin conflictos', () => {
      expect(etiquetaDisponibilidadParcial({
        bloqueada: false,
        verificada: true,
        tieneAdvertencias: false,
      })).toBe('Agenda verificada')
    })

    it('marca como no disponible solo un conflicto real con agenda verificada', () => {
      expect(etiquetaDisponibilidadParcial({
        bloqueada: true,
        verificada: true,
        tieneAdvertencias: true,
      })).toBe('No disponible')
    })
  })

  describe('datos necesarios para verificar la agenda', () => {
    it('indica ambos tiempos faltantes', () => {
      expect(mensajeAgendaIncompleta({
        loadMinutes: null,
        downloadMinutes: null,
        startTime: '10:00',
        arrivalTime: '',
      })).toBe('Completá los tiempos de carga y descarga para verificar la disponibilidad')
    })

    it('indica solo el tiempo de carga faltante', () => {
      expect(mensajeAgendaIncompleta({
        loadMinutes: null,
        downloadMinutes: 45,
        startTime: '10:00',
        arrivalTime: '',
      })).toBe('Completá el tiempo de carga para verificar la disponibilidad')
    })

    it('indica solo el tiempo de descarga faltante', () => {
      expect(mensajeAgendaIncompleta({
        loadMinutes: 60,
        downloadMinutes: null,
        startTime: '10:00',
        arrivalTime: '12:00',
      })).toBe('Completá el tiempo de descarga para verificar la disponibilidad')
    })

    it('pide llegada si ambos tiempos están cargados pero falta el horario final', () => {
      expect(mensajeAgendaIncompleta({
        loadMinutes: 60,
        downloadMinutes: 45,
        startTime: '10:00',
        arrivalTime: '',
      })).toBe('Completá la llegada estimada para verificar la disponibilidad')
    })

    it('no verifica si la llegada es anterior al inicio', () => {
      expect(mensajeAgendaIncompleta({
        loadMinutes: 60,
        downloadMinutes: 45,
        startTime: '12:00',
        arrivalTime: '11:00',
      })).toBe('Completá la llegada estimada para verificar la disponibilidad')
    })
  })

  it('colorea en marrón y mantiene seleccionables las asignaciones provisionales', () => {
    expect(estiloOpcionPlanificacion({
      operativa: true,
      bloqueada: false,
      tieneAdvertencias: true,
    })).toEqual({ disabled: false, color: color.amberInk })
  })

  it('prioriza el gris y el bloqueo cuando hay un viaje confirmado incompatible', () => {
    expect(estiloOpcionPlanificacion({
      operativa: true,
      bloqueada: true,
      tieneAdvertencias: true,
    })).toEqual({ disabled: true, color: color.muted })
  })

  describe('estado visible del selector de asignación', () => {
    const base = { bloqueada: false, tieneAdvertencias: false }

    it('pide completar los datos con o sin asignación cuando la agenda no se puede verificar', () => {
      expect(estadoCampoAsignacion({ ...base, asignado: false, estadoAgenda: 'incompleta' })).toEqual({
        texto: 'Completá los datos para verificar la disponibilidad',
        tono: 'neutral',
      })
      expect(estadoCampoAsignacion({ ...base, asignado: true, estadoAgenda: 'incompleta' })).toEqual({
        texto: 'Completá los datos para verificar la disponibilidad',
        tono: 'neutral',
      })
    })

    it('muestra verificando mientras la agenda está en vuelo, asignado o no', () => {
      expect(estadoCampoAsignacion({ ...base, asignado: false, estadoAgenda: 'verificando' })).toEqual({
        texto: 'Verificando agenda…',
        tono: 'advertencia',
      })
      expect(estadoCampoAsignacion({ ...base, asignado: true, estadoAgenda: 'verificando' })).toEqual({
        texto: 'Verificando agenda…',
        tono: 'advertencia',
      })
    })

    it('reporta el fallo de verificación sin culpar a los datos faltantes', () => {
      expect(estadoCampoAsignacion({ ...base, asignado: false, estadoAgenda: 'error' })).toEqual({
        texto: 'No se pudo verificar',
        tono: 'error',
      })
    })

    it('vuelve a sin asignar cuando la agenda quedó verificada', () => {
      expect(estadoCampoAsignacion({ ...base, asignado: false, estadoAgenda: 'verificada' })).toEqual({
        texto: 'Sin asignar',
        tono: 'neutral',
      })
    })

    it('refleja disponibilidad, conflicto y advertencias con agenda verificada', () => {
      expect(estadoCampoAsignacion({ ...base, asignado: true, estadoAgenda: 'verificada' })).toEqual({
        texto: 'Agenda verificada',
        tono: 'ok',
      })
      expect(estadoCampoAsignacion({
        ...base,
        asignado: true,
        estadoAgenda: 'verificada',
        tieneAdvertencias: true,
      })).toEqual({ texto: 'Agenda verificada con advertencias', tono: 'advertencia' })
      expect(estadoCampoAsignacion({
        ...base,
        asignado: true,
        estadoAgenda: 'verificada',
        bloqueada: true,
      })).toEqual({ texto: 'No disponible', tono: 'error' })
    })

    it('no inventa verificación cuando el recurso asignado no está en las opciones', () => {
      expect(estadoCampoAsignacion({ ...base, asignado: true, estadoAgenda: 'no-aplica' })).toEqual({
        texto: 'Sin verificar',
        tono: 'neutral',
      })
      expect(estadoCampoAsignacion({ ...base, asignado: false, estadoAgenda: 'no-aplica' })).toEqual({
        texto: 'Sin asignar',
        tono: 'neutral',
      })
    })
  })
})
