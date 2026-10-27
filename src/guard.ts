import type { ReactElement } from 'react'
import { api } from './api'
import { R } from './routes'
import { renderPage } from './render'
import { setCurrentUser, supabase, type Role } from './supabase'

/** Roles con acceso a la operacion diaria (agenda, viajes, flota, pagos). */
export const STAFF_ROLES: Role[] = ['administrador']

/**
 * Guard de rutas para la MPA: no hay router, cada entry decide antes de montar.
 * Devuelve false (y redirige) si no hay sesion o si el rol no corresponde.
 *
 * El rol NO sale del JWT: el backend lo resuelve desde `usuarios` y lo expone
 * en `/api/me`. Asi un cambio de permisos aplica al instante.
 */
export async function requireAuth(roles?: Role[]): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    window.location.href = R.ingreso
    return false
  }

  let user
  try {
    user = await api.me()
  } catch {
    // 401 ya cierra la sesion desde http(). Un 403 significa que la cuenta
    // existe en Auth pero no esta habilitada como personal.
    await supabase.auth.signOut()
    window.location.href = R.ingreso
    return false
  }

  setCurrentUser(user)

  if (roles && !roles.includes(user.role)) {
    // Redirigir al home que si le corresponde evita el loop de 403.
    window.location.href = user.role === 'chofer' ? R.chofer : R.agenda
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
