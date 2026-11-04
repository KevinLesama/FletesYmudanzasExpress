import { describe, expect, it } from 'vitest'
import { color } from '../design/tokens'
import {
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
})
