import { useState, type ComponentType, type ReactNode } from 'react'
import type { SvgIconProps } from '@mui/material/SvgIcon'
import {
  Box,
  Drawer,
  Stack,
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
import { MobileNavDrawer, type MobileNavItem } from './mobile/MobileNavDrawer'
import { MobileTopBar } from './mobile/MobileTopBar'
import { MOBILE_GUTTER, MOBILE_PAGE_BOTTOM_SPACE, MOBILE_PAGE_TOP_SPACE } from './mobile/mobileSx'
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
  { key: 'config', label: 'Mi configuración', icon: Settings, href: R.choferConfig },
]

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
  compactMobile = false,
  mobileTitle,
  mobileBack,
  children,
}: {
  active: ChoferNavKey
  breadcrumb: string[]
  title: string
  kicker?: string
  description?: string
  action?: ReactNode
  /**
   * Mobile only: hides the eyebrow/title/description block when a trip is open
   * and the trip detail owns the screen. Desktop is unaffected.
   */
  compactMobile?: boolean
  /**
   * Mobile only: replaces the top bar title (the trip id while a trip is open).
   * Desktop is unaffected.
   */
  mobileTitle?: string
  /**
   * Mobile only: swaps the hamburger for a back button that runs this handler
   * (the same close-trip handler the flow already uses). Desktop is unaffected.
   */
  mobileBack?: () => void
  children: ReactNode
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
  const mobileNavItems: MobileNavItem[] = NAV.map(({ key, label, icon, href }) => ({ key, label, icon, href }))
  // The bar carries the section title; pages can override it (trip id).
  const mobileBarTitle = mobileTitle ?? NAV.find((item) => item.key === active)?.label ?? title

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
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ color: '#64707C' }}>
          <LocalShipping sx={{ fontSize: 16, mt: '1px' }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>
            Ves los viajes confirmados que te asigna administración.
          </Typography>
        </Stack>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: isMobile ? '100dvh' : '100vh' }}>
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
          <MobileTopBar
            title={mobileBarTitle}
            onOpenMenu={mobileBack ? undefined : () => setMobileMenuOpen(true)}
            onBack={mobileBack}
          />
        )}

        {isMobile && (
          <MobileNavDrawer
            open={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            active={active}
            items={mobileNavItems}
            sectionLabel="Mi área"
            brand={<Brand subtitle="" />}
            account={account}
            onSignOut={() => void signOut()}
          />
        )}

        <Box
          sx={{
            pt: { xs: MOBILE_PAGE_TOP_SPACE, md: 3.5 },
            px: { xs: `${MOBILE_GUTTER}px`, md: 4 },
            // No bottom navigation bar on mobile: only the home indicator.
            pb: { xs: MOBILE_PAGE_BOTTOM_SPACE, md: 4 },
          }}
        >
          <Box sx={{ maxWidth: 980, mx: 'auto' }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              sx={{ mb: 2.5, ...(compactMobile && { display: { xs: 'none', md: 'flex' } }) }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography
                  sx={{ fontSize: 11, fontWeight: 800, color: brand.orangeInk, letterSpacing: '0.14em', mb: 0.5 }}
                >
                  MODO CHOFER
                </Typography>
                <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 22, md: 26 }, position: { xs: 'absolute', md: 'static' }, width: { xs: 1, md: 'auto' }, height: { xs: 1, md: 'auto' }, p: { xs: 0, md: undefined }, m: { xs: -1, md: 0 }, overflow: { xs: 'hidden', md: 'visible' }, clip: { xs: 'rect(0 0 0 0)', md: 'auto' }, whiteSpace: { xs: 'nowrap', md: 'normal' }, border: 0 }}>
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
    </Box>
  )
}
