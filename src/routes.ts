export const R = {
  ingreso: '/ingreso',
  agenda: '/agenda',
  solicitudes: '/solicitudes',
  nuevaSolicitud: '/solicitudes/nueva',
  planificacion: (id: string) => `/planificacion?id=${encodeURIComponent(id)}`,
  flota: '/flota',
  pagos: '/pagos',
  ajustes: '/ajustes',
  chofer: '/chofer',
  choferConfig: '/chofer/config',
}

export function useQuery(): URLSearchParams {
  return new URLSearchParams(window.location.search)
}