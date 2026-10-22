import type { ReactElement } from 'react'
import { R } from './routes'
import { renderPage } from './render'
import { setCurrentUser, supabase, type Role } from './supabase'

/** Roles con acceso a la operacion diaria (agenda, viajes, flota, pagos). */
export const STAFF_ROLES: Role[] = ['admin', 'coordinator']

/**
 * Guard de rutas para la MPA: no hay router, cada entry decide antes de montar.
 * Devuelve false (y redirige) si no hay sesion o si el rol no corresponde.
 */
export async function requireAuth(roles?: Role[]): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    window.location.href = R.ingreso
    return false
  }

  const role = (session.user.app_metadata?.role ?? 'driver') as Role
  setCurrentUser({ email: session.user.email ?? '', role })

  if (roles && !roles.includes(role)) {
    // Redirigir al home que si le corresponde evita el loop de 403.
    window.location.href = role === 'driver' ? R.chofer : R.agenda
    return false
  }
  return true
}

/** Monta la pagina solo si la sesion y el rol pasan el guard. */
export function mountWithAuth(roles: Role[], element: ReactElement): void {
  void requireAuth(roles).then((ok) => {
    if (ok) renderPage(element)
  })
}
