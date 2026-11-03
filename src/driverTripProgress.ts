import type { PaymentMethod } from './types'

export const DRIVER_PHASES = ['Ir al origen', 'Viaje al destino', 'Entrega y remito'] as const

export type DriverPhase = 1 | 2 | 3

export interface DriverTripProgress {
  phase: DriverPhase
  originArrived: boolean
  loadedItems: number[]
  paymentMethod?: PaymentMethod
}

const STORAGE_PREFIX = 'fletes:chofer:viaje:'

const defaults = (): DriverTripProgress => ({
  phase: 1,
  originArrived: false,
  loadedItems: [],
})

export function loadDriverProgress(tripId: string): DriverTripProgress {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${tripId}`)
    if (!raw) return defaults()
    const parsed = JSON.parse(raw) as Partial<DriverTripProgress>
    const phase = parsed.phase === 2 || parsed.phase === 3 ? parsed.phase : 1
    return {
      phase,
      originArrived: Boolean(parsed.originArrived) || phase > 1,
      loadedItems: Array.isArray(parsed.loadedItems)
        ? parsed.loadedItems.filter((value): value is number => Number.isInteger(value) && value >= 0)
        : [],
      paymentMethod:
        parsed.paymentMethod === 'Efectivo' || parsed.paymentMethod === 'Transferencia'
          ? parsed.paymentMethod
          : undefined,
    }
  } catch {
    return defaults()
  }
}

export function saveDriverProgress(tripId: string, progress: DriverTripProgress): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${tripId}`, JSON.stringify(progress))
  } catch {
    /* Sin almacenamiento disponible el flujo sigue en memoria. */
  }
}

export function clearDriverProgress(tripId: string): void {
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${tripId}`)
  } catch {
    /* nada que limpiar */
  }
}
