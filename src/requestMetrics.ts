import type { ShiftRequest } from './types'

/** Estado de una solicitud que todavía espera revisión del administrador. */
export const PENDING_REVIEW_STATUS = 'Pendiente de revisión'

/** Planificada pero todavía sin la seña: también espera acción del administrador. */
export const PENDING_DEPOSIT_STATUS = 'Pendiente de seña'

export function isPendingReview(request: ShiftRequest): boolean {
  return request.status === PENDING_REVIEW_STATUS
}

export function isPendingDeposit(request: ShiftRequest): boolean {
  return request.status === PENDING_DEPOSIT_STATUS
}

/**
 * Única fuente para el contador de solicitudes por revisar: lo usa el resumen
 * del encabezado de la agenda, que muestra la seña pendiente por separado.
 */
export function countPendingReview(requests: ShiftRequest[]): number {
  return requests.filter(isPendingReview).length
}

/**
 * Contador del badge del menú: todo viaje que todavía espera una acción del
 * administrador, esté sin planificar o esperando la seña.
 */
export function countPendingRequests(requests: ShiftRequest[]): number {
  return requests.filter((request) => isPendingReview(request) || isPendingDeposit(request)).length
}
