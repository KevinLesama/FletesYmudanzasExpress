/**
 * Preferencias de la cuenta de administración.
 *
 * No hay endpoints de ajustes todavía: se guardan en `localStorage` con el mismo
 * criterio que `choferConfig.ts`. Cada panel lee y escribe una parte, así que el
 * merge es por sección y no pisa lo que tocó otro panel.
 */

export type NotificationKey =
  | 'emailRequests'
  | 'emailWeekly'
  | 'emailProduct'
  | 'deviceMessages'
  | 'deviceReminders'
  | 'quietOvernight'

export type IdleTimeout = 'never' | '1h' | '8h' | '24h'

export interface SettingsProfile {
  name: string
  role: string
  email: string
  timezone: string
  photo?: string
}

export interface SettingsState {
  profile: SettingsProfile
  notifications: Record<NotificationKey, boolean>
  security: {
    twoFactor: boolean
    signInAlerts: boolean
    idleTimeout: IdleTimeout
  }
}

const KEY = 'fex_settings'

export const DEFAULT_SETTINGS: SettingsState = {
  profile: {
    name: 'María Rodríguez',
    role: 'Administradora',
    email: 'maria@fletesexpress.com',
    timezone: 'America/Argentina/Buenos_Aires',
  },
  notifications: {
    emailRequests: true,
    emailWeekly: true,
    emailProduct: false,
    deviceMessages: true,
    deviceReminders: false,
    quietOvernight: false,
  },
  security: {
    twoFactor: false,
    signInAlerts: true,
    idleTimeout: '8h',
  },
}

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const text = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value : fallback

function read(): SettingsState {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<SettingsState>
    const notifications = (parsed.notifications ?? {}) as Partial<Record<NotificationKey, boolean>>
    const security = (parsed.security ?? {}) as Partial<SettingsState['security']>
    const profile = (parsed.profile ?? {}) as Partial<SettingsProfile>
    const timeouts: IdleTimeout[] = ['never', '1h', '8h', '24h']
    return {
      profile: {
        name: text(profile.name, DEFAULT_SETTINGS.profile.name),
        role: text(profile.role, DEFAULT_SETTINGS.profile.role),
        email: text(profile.email, DEFAULT_SETTINGS.profile.email),
        timezone: text(profile.timezone, DEFAULT_SETTINGS.profile.timezone),
        photo: typeof profile.photo === 'string' ? profile.photo : undefined,
      },
      notifications: Object.fromEntries(
        Object.entries(DEFAULT_SETTINGS.notifications).map(([key, fallback]) => [
          key,
          bool(notifications[key as NotificationKey], fallback),
        ]),
      ) as Record<NotificationKey, boolean>,
      security: {
        twoFactor: bool(security.twoFactor, DEFAULT_SETTINGS.security.twoFactor),
        signInAlerts: bool(security.signInAlerts, DEFAULT_SETTINGS.security.signInAlerts),
        idleTimeout: timeouts.includes(security.idleTimeout as IdleTimeout)
          ? (security.idleTimeout as IdleTimeout)
          : DEFAULT_SETTINGS.security.idleTimeout,
      },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** Guarda una sección y devuelve el estado completo resultante. */
export function saveSettings(patch: Partial<SettingsState>): SettingsState {
  const next: SettingsState = {
    ...read(),
    ...patch,
    profile: { ...read().profile, ...patch.profile },
    notifications: { ...read().notifications, ...patch.notifications },
    security: { ...read().security, ...patch.security },
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Cuota llena (por ejemplo una foto enorme): la sesión sigue con el valor
    // en memoria y quien llama avisa del problema.
  }
  return next
}

export function loadSettings(): SettingsState {
  return read()
}
