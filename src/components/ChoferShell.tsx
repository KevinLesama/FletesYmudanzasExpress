import type { ComponentType, ReactNode } from 'react'
import type { SvgIconProps } from '@mui/material/SvgIcon'
import {
  AppBar,
  Box,
  Drawer,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  Route,
  Settings,
  LocalShipping,
  ChevronRight,
} from '@mui/icons-material'
import { R } from '../routes'
import { currentUser, roleLabel, signOut } from '../supabase'
import { AccountMenu, initialsFrom, type AccountMenuItem } from './AccountMenu'
import { Brand } from './Brand'
import { brand } from '../theme'

export type ChoferNavKey = 'viajes' | 'config'

interface NavItem {
  key: ChoferNavKey
  label: string
  icon: ComponentType<SvgIconProps>
  href: string
}

const NAV: NavItem[] = [
  { key: 'viajes', label: 'Mis viajes', icon: Route, href: R.chofer },
]

/**
 * The driver view is mobile-only and has exactly two screens, so the account
 * menu doubles as navigation: the bottom bar no longer needs to carry them.
 */
const ACCOUNT_ITEMS: AccountMenuItem[] = [
  { key: 'viajes', label: 'Mis viajes', icon: Route, href: R.chofer },
  { key: 'config', label: 'Mi configuración', icon: Settings, href: R.choferConfig },
]

/** Identidad del chofer logueado: el backend la resuelve al validar la sesión. */

const SIDEBAR_W = 260

export function ChoferShell({
  active,
  breadcrumb,
  title,
  description,
  action,
  children,
}: {
  active: ChoferNavKey
  breadcrumb: string[]
  title: string
  kicker?: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  // La identidad del chofer sale de la sesión validada por el backend.
  const user = currentUser()
  const name = user?.nombre ?? 'Chofer'
  const account = {
    name,
    role: user ? roleLabel(user.role) : 'Sin rol',
    email: user?.email,
    initials: initialsFrom(name),
    accent: brand.orangeStrong,
  }

  const sidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2.5, px: 2 }}>
      <Box sx={{ px: 1, mb: 3 }}>
        <Brand />
      </Box>
      <Typography sx={{ px: 2, mb: 1, fontSize: 11, fontWeight: 700, color: brand.muted, letterSpacing: '0.06em' }}>
        MI ÁREA
      </Typography>
      <Stack spacing={0.25}>
        {NAV.map((item) => {
          const Icon = item.icon
          const isActive = item.key === active
          return (
            <a key={item.key} href={item.href} style={{ textDecoration: 'none' }} aria-current={isActive ? 'page' : undefined}>
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
                  color: isActive ? brand.navy : '#5C6B7A',
                  bgcolor: isActive ? 'rgba(19,43,74,0.07)' : 'transparent',
                  fontWeight: isActive ? 700 : 600,
                  fontSize: 14,
                  transition: 'background-color 120ms',
                  '&:hover': { bgcolor: 'rgba(19,43,74,0.06)' },
                }}
              >
                {isActive && (
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
              </Box>
            </a>
          )
        })}
      </Stack>

      <Box sx={{ flexGrow: 1 }} />
      <Box sx={{ px: 1.5, py: 1.5, borderRadius: 2, bgcolor: '#FBF9F6', border: '1px solid #EDEAE3' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#64707C' }}>
          <LocalShipping sx={{ fontSize: 16 }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Vehículo asignado · MOV-05</Typography>
        </Stack>
      </Box>
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
                  {i > 0 && <ChevronRight sx={{ fontSize: 15, color: '#8A929B' }} />}
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
              <AccountMenu user={account} items={ACCOUNT_ITEMS} onSignOut={() => void signOut()} />
            </Stack>
          </Box>
        )}

        {isMobile && (
          <AppBar position="fixed" elevation={0} sx={{ bgcolor: brand.navy, top: 0, left: 0, right: 0 }}>
            <Toolbar sx={{ px: 2, minHeight: 64, gap: 1 }}>
              <Brand surface="dark" />
              <Box sx={{ flexGrow: 1 }} />
              <AccountMenu user={account} items={ACCOUNT_ITEMS} surface="dark" onSignOut={() => void signOut()} />
            </Toolbar>
          </AppBar>
        )}

        {/* No mobile bottom bar on the driver view, so it does not reserve space for one. */}
        <Box sx={{ pt: { xs: 9.5, md: 3.5 }, px: { xs: 2, md: 4 }, pb: 4 }}>
          <Box sx={{ maxWidth: 980, mx: 'auto' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 2.5 }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography
                  sx={{ fontSize: 11, fontWeight: 800, color: brand.orangeInk, letterSpacing: '0.14em', mb: 0.5 }}
                >
                  MODO CHOFER
                </Typography>
                <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 22, md: 26 } }}>
                  {title}
                </Typography>
                {description && <Typography sx={{ color: 'text.secondary', fontSize: 14, mt: 0.5 }}>{description}</Typography>}
              </Box>
              {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
            </Stack>
            {children}
          </Box>
        </Box>
      </Box>

      {isMobile && NAV.length > 1 && (
        <AppBar position="fixed" elevation={8} sx={{ top: 'auto', bottom: 0, bgcolor: brand.navy, color: '#fff' }}>
          <Box component="nav" sx={{ display: 'grid', gridTemplateColumns: `repeat(${NAV.length}, 1fr)`, pb: 'env(safe-area-inset-bottom)' }}>
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
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4, py: 0.9, position: 'relative' }}>
                    {isActive && <Box sx={{ position: 'absolute', top: 0, height: 3, width: 40, borderRadius: 4, bgcolor: brand.orange }} />}
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