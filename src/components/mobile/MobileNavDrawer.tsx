import type { ComponentType, ReactNode } from 'react'
import type { SvgIconProps } from '@mui/material/SvgIcon'
import { Avatar, Box, Drawer, IconButton, Stack, Typography } from '@mui/material'
import { Close, Logout } from '@mui/icons-material'
import { R } from '../../routes'
import { color, motion, radius, space } from '../../design/tokens'
import { MOBILE_SAFE_BOTTOM } from './mobileSx'

export interface MobileNavItem {
  key: string
  label: string
  icon: ComponentType<SvgIconProps>
  href: string
  /** Counter shown as an orange pill (e.g. pending requests). */
  badge?: number
}

export interface MobileNavDrawerProps {
  open: boolean
  onClose: () => void
  /** `key` of the active item. */
  active: string
  /** Primary navigation rows. */
  items: MobileNavItem[]
  /** Small label above the primary rows, e.g. "MENÚ PRINCIPAL". */
  sectionLabel?: string
  /** Secondary rows such as the account sections (deep links). */
  extraItems?: MobileNavItem[]
  /** Small label above the secondary rows, e.g. "CUENTA". */
  extraLabel?: string
  /** Brand slot rendered at the top of the drawer. */
  brand?: ReactNode
  account: {
    name: string
    role: string
    email?: string
    initials: string
    photo?: string
  }
  onSignOut: () => void
  /** Optional content pinned under the account block. */
  footer?: ReactNode
}

const DRAWER_WIDTH = 300

function NavRow({ item, active }: { item: MobileNavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Box
      component="a"
      href={item.href}
      aria-current={active ? 'page' : undefined}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 48,
        px: 1.5,
        borderRadius: `${radius.sm}px`,
        textDecoration: 'none',
        color: active ? color.navy : color.inkStrong,
        bgcolor: active ? 'rgba(19,43,74,0.07)' : 'transparent',
        fontWeight: active ? 700 : 600,
        fontSize: 14,
        transition: `background-color ${motion.fast}`,
        '&:hover': { bgcolor: 'rgba(19,43,74,0.06)' },
        '&:focus-visible': { outline: `2px solid ${color.blue}`, outlineOffset: -2 },
      }}
    >
      {active && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: 22,
            borderRadius: 4,
            bgcolor: color.orange,
          }}
        />
      )}
      <Icon sx={{ fontSize: 20, flexShrink: 0, color: active ? color.navy : color.muted }} />
      <Box sx={{ flexGrow: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{item.label}</Box>
      {item.badge ? (
        <Box
          component="span"
          sx={{
            minWidth: 20,
            height: 20,
            px: 0.6,
            borderRadius: '999px',
            bgcolor: color.orangeStrong,
            color: color.paper,
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {item.badge}
        </Box>
      ) : null}
    </Box>
  )
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="p"
      sx={{
        px: 1.5,
        mb: 0.5,
        mt: 1.5,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: color.muted,
      }}
    >
      {children}
    </Typography>
  )
}

/**
 * Lateral navigation for mobile. Replaces the bottom navigation bar.
 *
 * Mobile-only: render it inside an `isMobile` branch.
 */
export function MobileNavDrawer({
  open,
  onClose,
  active,
  items,
  sectionLabel,
  extraItems,
  extraLabel,
  brand,
  account,
  onSignOut,
  footer,
}: MobileNavDrawerProps) {
  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: DRAWER_WIDTH,
          maxWidth: '84vw',
          border: 'none',
          borderRight: `1px solid ${color.border}`,
          bgcolor: color.paper,
          backgroundImage: 'none',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          pb: `calc(${space.lg}px + ${MOBILE_SAFE_BOTTOM})`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, pt: 2, pb: 1 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>{brand}</Box>
          <IconButton aria-label="Cerrar menú" onClick={onClose} sx={{ width: 44, height: 44 }}>
            <Close fontSize="small" />
          </IconButton>
        </Stack>

        <Box component="nav" aria-label="Navegación principal" sx={{ px: 1, overflowY: 'auto', minHeight: 0 }}>
          {sectionLabel && <GroupLabel>{sectionLabel}</GroupLabel>}
          <Stack spacing={0.25}>
            {items.map((item) => (
              <NavRow key={item.key} item={item} active={item.key === active} />
            ))}
          </Stack>

          {extraItems && extraItems.length > 0 && (
            <>
              {extraLabel && <GroupLabel>{extraLabel}</GroupLabel>}
              <Stack spacing={0.25}>
                {extraItems.map((item) => (
                  <NavRow key={item.key} item={item} active={false} />
                ))}
              </Stack>
            </>
          )}
        </Box>

        <Box sx={{ flexGrow: 1, minHeight: space.lg }} />

        <Box sx={{ px: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              px: 1.5,
              py: 1.25,
              borderRadius: `${radius.sm}px`,
              bgcolor: color.sand,
              border: `1px solid ${color.borderSoft}`,
            }}
          >
            <Avatar
              src={account.photo}
              alt={account.name}
              sx={{ width: 40, height: 40, bgcolor: color.blue, fontSize: 14, fontWeight: 800, flexShrink: 0 }}
            >
              {account.initials}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 14, fontWeight: 700, color: color.navy }}>
                {account.name}
              </Typography>
              <Typography noWrap sx={{ fontSize: 12, color: color.muted }}>
                {account.role}
              </Typography>
              {account.email && (
                <Typography noWrap sx={{ fontSize: 12, color: color.mutedSoft }}>
                  {account.email}
                </Typography>
              )}
            </Box>
          </Box>

          <Box
            component="a"
            href={R.ingreso}
            onClick={onSignOut}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              minHeight: 48,
              mt: 0.5,
              px: 1.5,
              borderRadius: `${radius.sm}px`,
              textDecoration: 'none',
              color: color.red,
              fontSize: 14,
              fontWeight: 600,
              '&:hover': { bgcolor: color.redSoft },
              '&:focus-visible': { outline: `2px solid ${color.red}`, outlineOffset: -2 },
            }}
          >
            <Logout sx={{ fontSize: 20, flexShrink: 0 }} />
            Cerrar sesión
          </Box>

          {footer}
        </Box>
      </Box>
    </Drawer>
  )
}
