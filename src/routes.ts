export const R = {
  ingreso: '/ingreso',
  agenda: '/agenda',
  solicitudes: '/solicitudes',
  nuevaSolicitud: '/solicitudes/nueva',
  planificacion: (id: string) => `/planificacion?id=${encodeURIComponent(id)}`,
  flota: '/flota',
  pagos: '/pagos',
  ajustes: '/ajustes',
  /** Deep link into one section of `AjustesPage`; the page keeps `?seccion=`. */
  ajustesSeccion: (seccion: string) => `/ajustes?seccion=${encodeURIComponent(seccion)}`,
  chofer: '/chofer',
  choferConfig: '/chofer/config',
}

export function useQuery(): URLSearchParams {
  return new URLSearchParams(window.location.search)
}