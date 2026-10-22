// Cliente de Supabase Auth. La sesion se persiste en localStorage y el token
// viaja al backend en el header Authorization (no usamos cookies: es una MPA).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { R } from './routes'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient | null = null

/**
 * Cliente de Supabase. Se crea la primera vez que se usa para no romper la
 * carga de la pagina cuando faltan las variables de entorno: el error sale
 * con un mensaje claro en el lugar donde se necesita iniciar sesion.
 */
export function supabase(): SupabaseClient {
  if (!client) {
    if (!url || !anonKey) {
      throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el .env del frontend.')
    }
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}

/** Roles con acceso a la aplicacion. El rol sale de la API (tabla usuarios). */
export type Role = 'admin' | 'chofer'

export interface SessionUser {
  id: string
  name: string
  email: string
  initials?: string
  role: Role
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administración',
  chofer: 'Chofer',
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

export function roleLabel(role?: Role | null): string {
  return role ? ROLE_LABELS[role] : 'Sin rol'
}

export async function signOut(): Promise<void> {
  try {
    await supabase().auth.signOut()
  } finally {
    window.location.href = R.ingreso
  }
}
