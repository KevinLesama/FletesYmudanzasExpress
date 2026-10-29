import { useState } from 'react'

/**
 * Paginado en memoria para listados ya cargados.
 *
 * La página se recorta sola: si la lista se achica (por ejemplo después de
 * editar o filtrar) y la página actual deja de existir, vuelve a la última
 * válida sin quedar en blanco.
 */
export function usePagedList<T>(items: T[], pageSize: number) {
  const [requestedPage, setRequestedPage] = useState(0)
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages - 1)

  return {
    page,
    setPage: setRequestedPage,
    total,
    totalPages,
    pageItems: items.slice(page * pageSize, (page + 1) * pageSize),
  }
}
