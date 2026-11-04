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
