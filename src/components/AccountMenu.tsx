import { useState, type ComponentType } from 'react'
import type { SvgIconProps } from '@mui/material/SvgIcon'
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { Logout } from '@mui/icons-material'
import { R } from '../routes'
import { color, motion, radius, shadow } from '../design/tokens'

export interface AccountMenuItem {
  key: string
  label: string
  icon: ComponentType<SvgIconProps>
  href: string
}

export interface AccountUser {
  name: string
  role: string
  email?: string
  initials: string
  /** Data URL or path; the initials show when it is missing. */
  photo?: string
  /** Avatar fill when there is no photo. */
  accent?: string
}

interface AccountMenuProps {
  user: AccountUser
  items: AccountMenuItem[]
  /** `dark` reads on the navy AppBar used by the mobile shell. */
  surface?: 'light' | 'dark'
  /** Cierra la sesión real; sin esto el ítem sólo navega a /ingreso. */
  onSignOut?: () => void
}

/** `María Rodríguez` -> `MR`; falls back to `?` on an empty name. */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
  return initials || '?'
}

/**
 * Single entry point for everything that belongs to the signed-in user:
 * identity, account sections and sign out. It replaces the avatar that used to
 * sit silently in the top bar and the duplicate identity block in the sidebar.
 */
export function AccountMenu({ user, items, surface = 'light', onSignOut }: AccountMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const open = Boolean(anchorEl)
  const onDark = surface === 'dark'

  const close = () => setAnchorEl(null)

  return (
    <>
      <Tooltip title={`Cuenta de ${user.name}`}>
        <IconButton
          aria-label={`Abrir el menú de la cuenta de ${user.name}`}
          aria-haspopup="menu"
          aria-expanded={open ? 'true' : undefined}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          size="small"
          sx={{
            p: 0.25,
            color: onDark ? '#fff' : color.inkStrong,
            transition: `background-color ${motion.fast}`,
            '&:hover': { bgcolor: onDark ? 'rgba(255,255,255,0.12)' : 'rgba(19,43,74,0.06)' },
          }}
        >
          <Avatar
            src={user.photo}
            alt={user.name}
            sx={{
              width: onDark ? 30 : 32,
              height: onDark ? 30 : 32,
              bgcolor: user.accent ?? color.blue,
              fontSize: onDark ? 11 : 12,
              fontWeight: 800,
              border: onDark ? '2px solid rgba(255,255,255,0.35)' : 'none',
            }}
          >
            {user.initials}
          </Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        MenuListProps={{ sx: { py: 1 } }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 264,
            border: `1px solid ${color.border}`,
            borderRadius: `${radius.md}px`,
            boxShadow: shadow.raised,
          },
        }}
      >
        <Box role="presentation" sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              src={user.photo}
              alt={user.name}
              sx={{ width: 40, height: 40, bgcolor: user.accent ?? color.blue, fontSize: 14, fontWeight: 800 }}
            >
              {user.initials}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: color.navy }} noWrap>
                {user.name}
              </Typography>
              <Typography sx={{ fontSize: 12, color: color.muted }} noWrap>
                {user.role}
              </Typography>
              {user.email && (
                <Typography sx={{ fontSize: 12, color: color.mutedSoft }} noWrap>
                  {user.email}
                </Typography>
              )}
            </Box>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: color.borderSoft }} />

        {items.map((item) => {
          const Icon = item.icon
          return (
            <MenuItem
              key={item.key}
              component="a"
              href={item.href}
              onClick={close}
              sx={{
                mx: 1,
                my: 0.25,
                px: 1.25,
                py: 1,
                borderRadius: 1.5,
                fontSize: 13.5,
                fontWeight: 600,
                color: color.inkStrong,
                '&:hover': { bgcolor: color.sandDeep },
              }}
            >
              <ListItemIcon sx={{ minWidth: 30, color: color.muted }}>
                <Icon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              {item.label}
            </MenuItem>
          )
        })}

        <Divider sx={{ my: 1, borderColor: color.borderSoft }} />

        <MenuItem
          component="a"
          href={R.ingreso}
          onClick={() => {
            close()
            onSignOut?.()
          }}
          sx={{
            mx: 1,
            px: 1.25,
            py: 1,
            borderRadius: 1.5,
            fontSize: 13.5,
            fontWeight: 600,
            color: color.red,
            '&:hover': { bgcolor: color.redSoft },
          }}
        >
          <ListItemIcon sx={{ minWidth: 30, color: color.red }}>
            <Logout sx={{ fontSize: 18 }} />
          </ListItemIcon>
          Cerrar sesión
        </MenuItem>
      </Menu>
    </>
  )
}
