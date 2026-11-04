import { useId, useState, type ReactNode } from 'react'
import { Box, Collapse, Typography } from '@mui/material'
import { ExpandLess, ExpandMore } from '@mui/icons-material'
import { color, motion, radius } from '../../design/tokens'

export interface MobileSectionProps {
  title: string
  icon?: ReactNode
  /** Right-aligned summary, e.g. a count or a status chip. */
  meta?: ReactNode
  /** Default `true`. */
  defaultOpen?: boolean
  /** Default `true`. */
  collapsible?: boolean
  /** Controlled state. Omit to let the section manage itself. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

/**
 * Collapsible card section used by the mobile forms and detail screens.
 *
 * The body is never unmounted when collapsed: `Collapse` keeps it in the DOM so
 * inputs, refs and `scrollIntoView` targets stay alive. A section can be opened
 * from the outside (e.g. when a validation error points inside it) through the
 * controlled `open` prop.
 *
 * Mobile-only: render it inside an `isMobile` branch.
 */
export function MobileSection({
  title,
  icon,
  meta,
  defaultOpen = true,
  collapsible = true,
  open,
  onOpenChange,
  children,
}: MobileSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const controlled = open !== undefined
  const expanded = controlled ? Boolean(open) : internalOpen
  const bodyId = useId()

  const toggle = () => {
    if (!collapsible) return
    const next = !expanded
    if (!controlled) setInternalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <Box
      component="section"
      sx={{
        bgcolor: color.paper,
        border: `1px solid ${color.border}`,
        borderRadius: `${radius.md}px`,
        overflow: 'hidden',
      }}
    >
      <Box
        component={collapsible ? 'button' : 'div'}
        type={collapsible ? 'button' : undefined}
        onClick={collapsible ? toggle : undefined}
        aria-expanded={collapsible ? expanded : undefined}
        aria-controls={collapsible ? bodyId : undefined}
        sx={{
          appearance: 'none',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          minHeight: 48,
          px: 2,
          py: 1.25,
          border: 0,
          borderBottom: expanded ? `1px solid ${color.border}` : 'none',
          bgcolor: 'transparent',
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: collapsible ? 'pointer' : 'default',
          transition: `background-color ${motion.fast}`,
          '&:hover': { bgcolor: collapsible ? color.sand : 'transparent' },
          '&:focus-visible': { outline: `2px solid ${color.blue}`, outlineOffset: -2 },
        }}
      >
        {icon}
        <Typography
          component="h2"
          sx={{ flexGrow: 1, minWidth: 0, fontSize: 15, fontWeight: 800, color: color.navy }}
        >
          {title}
        </Typography>
        {meta && <Box sx={{ flexShrink: 0, fontSize: 12, color: color.muted }}>{meta}</Box>}
        {collapsible &&
          (expanded ? (
            <ExpandLess sx={{ fontSize: 20, color: color.muted, flexShrink: 0 }} />
          ) : (
            <ExpandMore sx={{ fontSize: 20, color: color.muted, flexShrink: 0 }} />
          ))}
      </Box>

      <Collapse in={expanded} unmountOnExit={false} timeout={180}>
        <Box id={bodyId} sx={{ px: 2, py: 1.75 }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  )
}
