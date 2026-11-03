import type { ComponentType, ReactNode } from 'react'
import type { SvgIconProps } from '@mui/material/SvgIcon'
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  AccountBalanceWallet,
  CalendarMonth,
  Checklist,
  LocalShipping,
  LocationOn,
  LockOutlined,
  NotificationsNone,
  PersonOutline,
} from '@mui/icons-material'
import { R } from '../routes'
import { currentUser, roleLabel, signOut } from '../supabase'
import { AccountMenu, initialsFrom, type AccountMenuItem } from './AccountMenu'
import { Brand } from './Brand'
import { EncabezadoPagina } from './EncabezadoPagina'
import { MapPreview } from './MapPreview'
import { brand } from '../theme'
import { loadSettings } from '../settingsStore'
import type { TripForMapReason } from '../tripForMap'
import type { ShiftRequest } from '../types'
import { useMapTrips } from '../useMapTrips'
import { countPendingRequests } from '../requestMetrics'

const SEPARADOR_BREADCRUMB = '·'
export const SECCION_BREADCRUMB = 'Operación'

export type NavKey = 'agenda' | 'solicitudes' | 'flota' | 'pagos' | 'ajustes'

interface NavItem {
  key: NavKey
  label: string
  /** Etiqueta corta para la barra inferior del teléfono. */
  short?: string
  icon: ComponentType<SvgIconProps>
  href: string
  badge?: number
}

/**
 * Primary navigation only: things the admin does every day. Settings are not a
 * daily task, so they live in the account menu in the top bar instead.
 */
const NAV: NavItem[] = [
  { key: 'agenda', label: 'Agenda', icon: CalendarMonth, href: R.agenda },
  { key: 'solicitudes', label: 'Solicitudes', icon: Checklist, href: R.solicitudes },
  { key: 'flota', label: 'Choferes y vehículos', short: 'Choferes', icon: LocalShipping, href: R.flota },
  { key: 'pagos', label: 'Pagos', icon: AccountBalanceWallet, href: R.pagos },
]

/** Account shortcuts, reached from the avatar in the top bar. */
const ACCOUNT_ITEMS: AccountMenuItem[] = [
  { key: 'perfil', label: 'Perfil', icon: PersonOutline, href: R.ajustesSeccion('perfil') },
  { key: 'notificaciones', label: 'Notificaciones', icon: NotificationsNone, href: R.ajustesSeccion('notificaciones') },
  { key: 'seguridad', label: 'Seguridad', icon: LockOutlined, href: R.ajustesSeccion('seguridad') },
]

const SIDEBAR_W = 260

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <a
      href={item.href}
      style={{ textDecoration: 'none' }}
      aria-current={active ? 'page' : undefined}
    >
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.15,
          borderRadius: 2,
          mb: 0.4,
          color: active ? brand.navy : '#5C6B7A',
          bgcolor: active ? 'rgba(19,43,74,0.07)' : 'transparent',
          fontWeight: active ? 700 : 600,
          fontSize: 14,
          transition: 'background-color 120ms',
          '&:hover': { bgcolor: 'rgba(19,43,74,0.06)' },
        }}
      >
        {active && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 3,
              height: 22,
              borderRadius: 4,
              bgcolor: brand.orange,
            }}
          />
        )}
        <Icon fontSize="small" sx={{ flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1 }}>{item.label}</Box>
        {item.badge ? (
          <Box
            sx={{
              bgcolor: brand.orangeStrong,
              color: '#fff',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              px: 0.9,
              py: 0.1,
              lineHeight: 1.4,
            }}
          >
            {item.badge}
          </Box>
        ) : null}
      </Box>
    </a>
  )
}

interface AppShellProps {
  active: NavKey
  breadcrumb: string[]
  title?: string
  kicker?: string
  description?: string
  /**
   * Reemplaza el bloque de título/descripción/acción. La página es dueña del
   * encabezado completo (por ejemplo, un saludo con resumen), pero mantiene el
   * ancho, los márgenes y el alto que administra el shell.
   */
  header?: ReactNode
  action?: ReactNode
  /** Ocupa el alto del viewport y delega el scroll al contenido (p. ej. la agenda). */
  fill?: boolean
  /** Reduce paddings y alto del encabezado en páginas de tabla compactas. */
  compacto?: boolean
  mapTrip?: ShiftRequest | null
  mapTrips?: ShiftRequest[]
  mapRequests?: ShiftRequest[]
  mapRequestsLoading?: boolean
  mapReason?: TripForMapReason | null
  onClearMapTrip?: () => void
  onOpenMapTripDetail?: (trip: ShiftRequest) => void
  children: ReactNode
}

export function AppShell({
  active,
  breadcrumb,
  title,
  kicker,
  description,
  header,
  action,
  fill,
  compacto,
  mapTrip,
  mapTrips,
  mapRequests,
  mapRequestsLoading,
  mapReason,
  onClearMapTrip,
  onOpenMapTripDetail,
  children,
}: AppShellProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const fillLayout = Boolean(fill) && !isMobile
  const profile = loadSettings().profile
  // La identidad sale de la sesión de Supabase; `loadSettings` sólo aporta la
  // foto, que es una preferencia local de la cuenta.
  const user = currentUser()
  const name = user?.nombre ?? profile.name
  const account = {
    name,
    role: user ? roleLabel(user.role) : profile.role,
    email: user?.email ?? profile.email,
    initials: initialsFrom(name),
    photo: profile.photo,
  }
  const fallbackMap = useMapTrips(mapRequests)
  const effectiveMapTrips = mapTrips ?? fallbackMap.trips
  const effectiveMapTrip = mapTrip ?? effectiveMapTrips[0] ?? null
  const effectiveMapLoading = mapRequestsLoading ?? fallbackMap.loading
  // Badge del menú: todo viaje que espera una acción del administrador (sin
  // planificar o esperando la seña) sobre la lista completa, no sólo la
  // ventana del mapa. El resumen de la agenda usa el desglose por estado.
  const pendingRequestCount = countPendingRequests(mapRequests ?? fallbackMap.requests)
  const navItems = NAV.map((item) =>
    item.key === 'solicitudes' ? { ...item, badge: pendingRequestCount } : item,
  )

  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2.5, px: 2 }}>
      <Box sx={{ px: 1, mb: 3 }}>
        <Brand />
      </Box>
      <Typography sx={{ px: 2, mb: 1, fontSize: 11, fontWeight: 700, color: brand.muted, letterSpacing: '0.06em' }}>
        MENÚ PRINCIPAL
      </Typography>
      <Stack spacing={0.25}>
        {navItems.map((item) => (
          <NavLink key={item.key} item={item} active={item.key === active} />
        ))}
      </Stack>
      <Box sx={{ flexGrow: 1, minHeight: 180, my: 2, display: 'flex' }}>
        <MapPreview
          trip={effectiveMapTrip}
          trips={effectiveMapTrips}
          tripsLoading={effectiveMapLoading}
          reason={mapReason}
          onClear={onClearMapTrip}
          onOpenDetail={onOpenMapTripDetail}
        />
      </Box>
      <Box sx={{ px: 1.5, py: 1.5, borderRadius: 2, bgcolor: '#FBF9F6', border: '1px solid #EDEAE3' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#64707C' }}>
          <LocationOn sx={{ fontSize: 16 }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Buenos Aires, Argentina</Typography>
        </Stack>
      </Box>
    </Box>
  )

  return (
    <Box
      sx={{
        display: 'flex',
        height: isMobile ? undefined : '100dvh',
        minHeight: isMobile ? '100vh' : 0,
        overflow: isMobile ? undefined : 'hidden',
      }}
    >
      {!isMobile && (
        <Drawer
          variant="permanent"
          anchor="left"
          open
          sx={{
            width: SIDEBAR_W,
            height: '100%',
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: SIDEBAR_W,
              height: '100%',
              boxSizing: 'border-box',
              borderRight: '1px solid #EDEAE3',
              bgcolor: '#FFFFFF',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {!isMobile && (
          <Box
            sx={{
              px: 4,
              py: 1.5,
              borderBottom: '1px solid #EDEAE3',
              bgcolor: '#FCFBF8',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={0.6} sx={{ flexGrow: 1 }}>
              {breadcrumb.map((part, i) => (
                <Stack key={part} direction="row" alignItems="center" spacing={0.6}>
                  {i > 0 && (
                    <Typography
                      aria-hidden="true"
                      sx={{ mx: 1, fontSize: 12.5, lineHeight: 1, color: 'text.disabled' }}
                    >
                      {SEPARADOR_BREADCRUMB}
                    </Typography>
                  )}
                  <Typography
                    sx={{
                      fontSize: 12.5,
                      fontWeight: i === breadcrumb.length - 1 ? 700 : 500,
                      color: i === breadcrumb.length - 1 ? brand.navy : '#64707C',
                    }}
                  >
                    {part}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <IconButton size="small" sx={{ color: '#7A8794' }} aria-label="Notificaciones">
                <NotificationsNone fontSize="small" />
              </IconButton>
              <AccountMenu user={account} items={ACCOUNT_ITEMS} onSignOut={() => void signOut()} />
            </Stack>
          </Box>
        )}

        {isMobile && (
          <AppBar position="fixed" elevation={0} sx={{ bgcolor: brand.navy, top: 0, left: 0, right: 0 }}>
            <Toolbar sx={{ px: 2, minHeight: 64, gap: 1 }}>
              <Brand surface="dark" />
              <Box sx={{ flexGrow: 1 }} />
              <IconButton sx={{ color: '#fff' }} size="small" aria-label="Notificaciones">
                <NotificationsNone fontSize="small" />
              </IconButton>
              <AccountMenu user={account} items={ACCOUNT_ITEMS} surface="dark" onSignOut={() => void signOut()} />
            </Toolbar>
          </AppBar>
        )}

        <Box
          sx={{
            pt: { xs: 9.5, md: compacto ? 2.5 : 3.5 },
            px: { xs: 2, md: 4 },
            pb: { xs: 12, md: compacto ? 2.5 : 4 },
            ...(!isMobile && {
              boxSizing: 'border-box',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflowX: 'hidden',
              overflowY: fillLayout ? 'hidden' : 'auto',
            }),
          }}
        >
          <Box
            sx={{
              maxWidth: 1180,
              mx: 'auto',
              width: '100%',
              minWidth: 0,
              ...(fillLayout && { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }),
            }}
          >
            {header ? (
              <Box>{header}</Box>
            ) : (
              <EncabezadoPagina kicker={kicker} titulo={title} bajada={description} accion={action} compacto={compacto} />
            )}
            {children}
          </Box>
        </Box>
      </Box>

      {isMobile && (
        <AppBar
          position="fixed"
          elevation={8}
          sx={{ top: 'auto', bottom: 0, bgcolor: brand.navy, color: '#fff' }}
        >
          <Box
            component="nav"
            sx={{ display: 'grid', gridTemplateColumns: `repeat(${NAV.length}, 1fr)`, pb: 'env(safe-area-inset-bottom)' }}
          >
            {NAV.map((item) => {
              const Icon = item.icon
              const isActive = item.key === active
              return (
                <a
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  style={{ textDecoration: 'none', color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)' }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.4,
                      py: 0.9,
                      position: 'relative',
                    }}
                  >
                    {isActive && (
                      <Box sx={{ position: 'absolute', top: 0, height: 3, width: 40, borderRadius: 4, bgcolor: brand.orange }} />
                    )}
                    <Icon fontSize="small" sx={{ position: 'relative' }} />
                    <Typography
                      sx={{ fontSize: 11, fontWeight: isActive ? 700 : 600, lineHeight: 1.2, textAlign: 'center' }}
                    >
                      {item.short ?? item.label}
                    </Typography>
                  </Box>
                </a>
              )
            })}
          </Box>
        </AppBar>
      )}
    </Box>
  )
}