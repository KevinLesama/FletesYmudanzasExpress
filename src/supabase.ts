// Cliente de Supabase Auth. La sesion se persiste en localStorage y el token
// viaja al backend en el header Authorization (no usamos cookies: es una MPA).
import { createClient } from '@supabase/supabase-js'
import { R } from './routes'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el .env del frontend.')
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export type Role = 'admin' | 'coordinator' | 'driver'

export interface SessionUser {
  email: string
  role: Role
}

// Cache del usuario ya validado por requireAuth, para que los shells lo
// muestren sin volver a consultar la sesion.
let current: SessionUser | null = null

export function setCurrentUser(user: SessionUser | null): void {
  current = user
}

export function currentUser(): SessionUser | null {
  return current
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administración',
  coordinator: 'Coordinación',
  driver: 'Chofer',
}

export function roleLabel(role?: Role | null): string {
  return role ? ROLE_LABELS[role] : 'Sin rol'
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
  window.location.href = R.ingreso
}
