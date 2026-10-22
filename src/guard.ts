import type { ReactElement } from 'react'
import { R } from './routes'
import { renderPage } from './render'
import { setCurrentUser, supabase, type Role } from './supabase'
import { api } from './api'

/** Roles con acceso a la operacion diaria (agenda, viajes, flota, pagos). */
export const STAFF_ROLES: Role[] = ['admin']

/**
 * Guard de rutas para la MPA: no hay router, cada entry decide antes de montar.
 * Devuelve false (y redirige) si no hay sesion o si el rol no corresponde.
 *
 * El rol no se lee del token: sale de la API (`usuarios.rol`), que es la fuente
 * de verdad. Si el backend responde 403 (cuenta sin vincular) se cierra la
 * sesion y se vuelve al ingreso.
 */
export async function requireAuth(roles?: Role[]): Promise<boolean> {
  let session = null
  try {
    const result = await supabase().auth.getSession()
    session = result.data.session
  } catch {
    session = null
  }

  if (!session) {
    window.location.href = R.ingreso
    return false
  }

  try {
    const me = await api.me()
    const role = me.role as Role
    setCurrentUser({
      id: me.id,
      name: me.name,
      email: me.email ?? '',
      initials: me.initials ?? undefined,
      role,
    })

    if (roles && !roles.includes(role)) {
      // Redirigir al home que si le corresponde evita el loop de 403.
      window.location.href = role === 'chofer' ? R.chofer : R.agenda
      return false
    }
    return true
  } catch {
    await supabase().auth.signOut()
    window.location.href = R.ingreso
    return false
  }
}

/** Monta la pagina solo si la sesion y el rol pasan el guard. */
export function mountWithAuth(roles: Role[], element: ReactElement): void {
  void requireAuth(roles).then((ok) => {
    if (ok) renderPage(element)
  })
}
