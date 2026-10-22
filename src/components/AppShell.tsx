import type { ComponentType, ReactNode } from 'react'
import type { SvgIconProps } from '@mui/material/SvgIcon'
import {
  AppBar,
  Avatar,
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
  Logout,
  LocationOn,
  NotificationsNone,
  ChevronRight,
} from '@mui/icons-material'
import { R } from '../routes'
import { Brand } from './Brand'
import { MapPreview } from './MapPreview'
import { brand } from '../theme'

export type NavKey = 'agenda' | 'solicitudes' | 'flota' | 'pagos'

interface NavItem {
  key: NavKey
  label: string
  icon: ComponentType<SvgIconProps>
  href: string
  badge?: number
}

const NAV: NavItem[] = [
  { key: 'agenda', label: 'Agenda', icon: CalendarMonth, href: R.agenda },
  { key: 'solicitudes', label: 'Solicitudes', icon: Checklist, href: R.solicitudes, badge: 5 },
  { key: 'flota', label: 'Choferes y vehículos', icon: LocalShipping, href: R.flota },
  { key: 'pagos', label: 'Pagos', icon: AccountBalanceWallet, href: R.pagos },
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
              bgcolor: brand.orange,
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
  title: string
  kicker?: string
  description?: string
  action?: ReactNode
  children: ReactNode
}

export function AppShell({ active, breadcrumb, title, kicker, description, action, children }: AppShellProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const current = NAV.find((n) => n.key === active)!

  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2.5, px: 2 }}>
      <Box sx={{ px: 1, mb: 3 }}>
        <Brand />
      </Box>
      <Typography sx={{ px: 2, mb: 1, fontSize: 11, fontWeight: 700, color: brand.muted, letterSpacing: '0.06em' }}>
        MENÚ PRINCIPAL
      </Typography>
      <Stack spacing={0.25}>
        {NAV.map((item) => (
          <NavLink key={item.key} item={item} active={item.key === active} />
        ))}
      </Stack>
      <Box sx={{ flexGrow: 1, minHeight: 180, my: 2, display: 'flex' }}>
        <MapPreview />
      </Box>
      <Box sx={{ px: 1.5, py: 1.5, borderRadius: 2, bgcolor: '#FBF9F6', border: '1px solid #EDEAE3' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#64707C' }}>
          <LocationOn sx={{ fontSize: 16 }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Buenos Aires, Argentina</Typography>
        </Stack>
      </Box>
      <Box sx={{ my: 2, height: '1px', bgcolor: '#EDEAE3' }} />
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: '#526B8A', fontSize: 13, fontWeight: 800 }}>MR</Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: brand.navy }}>María Rodríguez</Typography>
          <Typography sx={{ fontSize: 12, color: '#64707C' }}>Administradora</Typography>
        </Box>
        <a href={R.ingreso} title="Salir" aria-label="Cerrar sesión" style={{ textDecoration: 'none', color: '#64707C' }}>
          <IconButton size="small" sx={{ color: '#64707C' }}>
            <Logout fontSize="small" />
          </IconButton>
        </a>
      </Stack>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {!isMobile && (
        <Drawer
          variant="permanent"
          anchor="left"
          open
          sx={{
            width: SIDEBAR_W,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: SIDEBAR_W,
              boxSizing: 'border-box',
              borderRight: '1px solid #EDEAE3',
              bgcolor: '#FFFFFF',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
            }}
          >
            <Stack direction="row" alignItems="center" spacing={0.6} sx={{ flexGrow: 1 }}>
              {breadcrumb.map((part, i) => (
                <Stack key={part} direction="row" alignItems="center" spacing={0.6}>
                  {i > 0 && (
                    <ChevronRight sx={{ fontSize: 15, color: '#8A929B' }} />
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
              <Stack direction="row" alignItems="center" spacing={0.7}>
                <Box sx={{ width: 7, height: 7, borderRadius: 50, bgcolor: '#4E9A6C' }} />
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#5C6B7A' }}>Cuenta activa</Typography>
              </Stack>
              <Box sx={{ width: '1px', height: 20, bgcolor: '#EDEAE3' }} />
              <IconButton size="small" sx={{ color: '#7A8794' }} aria-label="Notificaciones">
                <NotificationsNone fontSize="small" />
              </IconButton>
              <Avatar sx={{ width: 32, height: 32, bgcolor: '#526B8A', fontSize: 12, fontWeight: 800 }}>MR</Avatar>
            </Stack>
          </Box>
        )}

        {isMobile && (
          <AppBar position="fixed" elevation={0} sx={{ bgcolor: brand.navy, top: 0, left: 0, right: 0 }}>
            <Toolbar sx={{ px: 2, minHeight: 64, gap: 1 }}>
              <Brand />
              <Box sx={{ flexGrow: 1 }} />
              <IconButton sx={{ color: '#fff' }} size="small" aria-label="Notificaciones">
                <NotificationsNone fontSize="small" />
              </IconButton>
              <Avatar sx={{ width: 30, height: 30, bgcolor: '#4E6B8E', fontSize: 11, fontWeight: 800 }}>MR</Avatar>
            </Toolbar>
          </AppBar>
        )}

        <Box sx={{ pt: { xs: 9.5, md: 3.5 }, px: { xs: 2, md: 4 }, pb: { xs: 12, md: 4 } }}>
          <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 2.5 }}>
              <Box sx={{ flexGrow: 1 }}>
                {kicker && (
                  <Typography
                    sx={{ fontSize: 11, fontWeight: 800, color: brand.orangeInk, letterSpacing: '0.14em', mb: 0.5 }}
                  >
                    {kicker.toUpperCase()}
                  </Typography>
                )}
                <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 22, md: 26 } }}>
                  {title}
                </Typography>
                {description && (
                  <Typography sx={{ color: 'text.secondary', fontSize: 14, mt: 0.5 }}>{description}</Typography>
                )}
              </Box>
              {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
            </Stack>
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
          <Box component="nav" sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', pb: 'env(safe-area-inset-bottom)' }}>
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
                    <Typography sx={{ fontSize: 11, fontWeight: isActive ? 700 : 600 }}>{item.label}</Typography>
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