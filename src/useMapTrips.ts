import { useMemo } from 'react'
import { api } from './api'
import { addDays } from './agendaDates'
import { useAsync } from './useAsync'
import type { ShiftRequest } from './types'

export const WINDOW_DAYS = 7

export interface MapTripFilters {
  driver?: string
  vehicle?: string
  status?: string
}

export function isTripInProgress(trip: ShiftRequest): boolean {
  return String(trip.status) === 'En viaje' || (
    trip.status === 'Confirmada' &&
    Boolean(trip.arrivedAt) &&
    !trip.finishedAt
  )
}

export function selectMapTrips(
  requests: ShiftRequest[],
  filters: MapTripFilters = {},
  today = new Date().toISOString().slice(0, 10),
): ShiftRequest[] {
  const maxDate = addDays(today, WINDOW_DAYS)
  return requests
    .filter((request) =>
      (filters.driver === undefined || filters.driver === 'all' || request.driverId === filters.driver) &&
      (filters.vehicle === undefined || filters.vehicle === 'all' || request.vehicleId === filters.vehicle) &&
      (filters.status === undefined || filters.status === 'all' || request.status === filters.status) &&
      (request.status === 'Confirmada' || isTripInProgress(request)),
    )
    .filter((request) => isTripInProgress(request) || (request.date >= today && request.date <= maxDate))
    .sort(
      (a, b) =>
        Number(isTripInProgress(b)) - Number(isTripInProgress(a)) ||
        a.date.localeCompare(b.date) ||
        a.serviceRange[0].localeCompare(b.serviceRange[0]),
    )
}

export function useMapTrips(
  sourceRequests?: ShiftRequest[],
  filters: MapTripFilters = {},
  today?: string,
) {
  const state = useAsync(
    () => sourceRequests === undefined ? api.listRequests() : Promise.resolve([] as ShiftRequest[]),
    [sourceRequests === undefined],
  )
  const requests = sourceRequests ?? state.data ?? []
  const trips = useMemo(
    () => selectMapTrips(requests, filters, today),
    [requests, filters.driver, filters.vehicle, filters.status, today],
  )

  return {
    trips,
    loading: sourceRequests === undefined ? state.loading : false,
    error: sourceRequests === undefined ? state.error : null,
    reload: state.reload,
  }
}
