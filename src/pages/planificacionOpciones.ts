import { color } from '../design/tokens'

export function estiloOpcionPlanificacion({
  operativa,
  bloqueada,
  tieneAdvertencias,
}: {
  operativa: boolean
  bloqueada: boolean
  tieneAdvertencias: boolean
}): { disabled: boolean; color: string } {
  const disabled = !operativa || bloqueada
  return {
    disabled,
    color: disabled ? color.muted : tieneAdvertencias ? color.amberInk : color.ink,
  }
}

export function etiquetaDisponibilidadParcial({
  bloqueada,
  verificada,
  tieneAdvertencias,
  verificando = false,
}: {
  bloqueada: boolean
  verificada: boolean
  tieneAdvertencias: boolean
  verificando?: boolean
}): string | undefined {
  if (!verificada) return verificando ? 'Verificando agenda…' : 'Agenda sin verificar'
  if (bloqueada) return 'No disponible'
  if (tieneAdvertencias) return 'Agenda verificada con advertencias'
  return 'Agenda verificada'
}

export type EstadoAgenda =
  | 'incompleta'
  | 'verificando'
  | 'verificada'
  | 'error'
  | 'no-aplica'

export type TonoEstadoAsignacion = 'ok' | 'advertencia' | 'neutral' | 'error'

export interface EstadoCampoAsignacion {
  texto: string
  tono: TonoEstadoAsignacion
}

/**
 * Estado visible arriba del selector de chofer/vehículo.
 *
 * `no-aplica` cubre los casos donde la agenda no se evalúa: viajes cancelados
 * o finalizados, y un recurso asignado que no aparece en las opciones (chofer
 * inactivo, vehículo fuera de servicio).
 */
export function estadoCampoAsignacion({
  asignado,
  estadoAgenda,
  bloqueada,
  tieneAdvertencias,
}: {
  asignado: boolean
  estadoAgenda: EstadoAgenda
  bloqueada: boolean
  tieneAdvertencias: boolean
}): EstadoCampoAsignacion {
  if (estadoAgenda === 'incompleta') {
    return { texto: 'Completá los datos para verificar la disponibilidad', tono: 'neutral' }
  }
  if (estadoAgenda === 'verificando') {
    return { texto: 'Verificando agenda…', tono: 'advertencia' }
  }
  if (estadoAgenda === 'error') {
    return { texto: 'No se pudo verificar', tono: 'error' }
  }
  if (estadoAgenda === 'no-aplica') {
    return { texto: asignado ? 'Sin verificar' : 'Sin asignar', tono: 'neutral' }
  }
  if (!asignado) {
    return { texto: 'Sin asignar', tono: 'neutral' }
  }
  return {
    texto:
      etiquetaDisponibilidadParcial({
        bloqueada,
        verificada: true,
        tieneAdvertencias,
      }) ?? 'Agenda verificada',
    tono: bloqueada ? 'error' : tieneAdvertencias ? 'advertencia' : 'ok',
  }
}

export function mensajeAgendaIncompleta({
  loadMinutes,
  downloadMinutes,
  startTime,
  arrivalTime,
}: {
  loadMinutes: number | null
  downloadMinutes: number | null
  startTime: string
  arrivalTime: string
}): string | undefined {
  const missingTimes = [
    loadMinutes == null ? 'carga' : null,
    downloadMinutes == null ? 'descarga' : null,
  ].filter((value): value is string => value !== null)
  if (missingTimes.length === 2) {
    return 'Completá los tiempos de carga y descarga para verificar la disponibilidad'
  }
  if (missingTimes.length === 1) {
    return `Completá el tiempo de ${missingTimes[0]} para verificar la disponibilidad`
  }
  if (!/^\d{2}:\d{2}$/.test(startTime)) {
    return 'Completá la hora de inicio para verificar la disponibilidad'
  }
  if (!/^\d{2}:\d{2}$/.test(arrivalTime) || arrivalTime <= startTime) {
    return 'Completá la llegada estimada para verificar la disponibilidad'
  }
  return undefined
}
