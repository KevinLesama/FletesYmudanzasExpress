import type { ShiftRequest } from './types'

/** Estado de una solicitud que todavía espera revisión del administrador. */
export const PENDING_REVIEW_STATUS = 'Pendiente de revisión'

export function isPendingReview(request: ShiftRequest): boolean {
  return request.status === PENDING_REVIEW_STATUS
}

/**
 * Única fuente para el contador de solicitudes por revisar: lo usan el badge
 * del menú lateral y el resumen del encabezado de la agenda.
 */
export function countPendingReview(requests: ShiftRequest[]): number {
  return requests.filter(isPendingReview).length
}
