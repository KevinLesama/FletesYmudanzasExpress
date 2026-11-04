import { Box, Button, IconButton, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { color, motion, radius } from '../../design/tokens'

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function parseISO(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year || 1970, (month || 1) - 1, day || 1)
}

function toISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Monday-to-Sunday week that contains `iso`. */
export function weekOf(iso: string): string[] {
  const base = parseISO(iso)
  const offset = (base.getDay() + 6) % 7
  const monday = new Date(base)
  monday.setDate(base.getDate() - offset)

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + index)
    return toISO(day)
  })
}

export interface MobileDayStripProps {
  /** Selected day, ISO `yyyy-mm-dd`. Drives the displayed week. */
  value: string
  /** Days that have at least one non-cancelled trip. */
  marked: Set<string>
  /** Today, ISO `yyyy-mm-dd`. */
  todayISO: string
  onSelect: (iso: string) => void
  /** Previous/next week. */
  onShift: (direction: -1 | 1) => void
  onToday: () => void
  /** Opens the month picker (MiniCalendar inside a bottom sheet). */
  onOpenMonth: () => void
  /** Optional control aligned to the right of the legend row (e.g. filters). */
  trailing?: ReactNode
}

/**
 * Week strip + month picker trigger for the mobile agenda.
 *
 * Shows Monday to Sunday of the week that contains `value`. Seven cells fit a
 * 360px viewport without horizontal scrolling.
 *
 * Mobile-only: render it inside an `isMobile` branch.
 */
export function MobileDayStrip({
  value,
  marked,
  todayISO,
  onSelect,
  onShift,
  onToday,
  onOpenMonth,
  trailing,
}: MobileDayStripProps) {
  const days = weekOf(value)
  const active = parseISO(value)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <IconButton
          aria-label="Semana anterior"
          onClick={() => onShift(-1)}
          sx={{ width: 44, height: 44, flexShrink: 0 }}
        >
          <ChevronLeft fontSize="small" />
        </IconButton>

        <Button
          onClick={onOpenMonth}
          aria-label={`Elegir mes y año. ${MONTHS_LONG[active.getMonth()]} de ${active.getFullYear()}`}
          sx={{
            flexGrow: 1,
            minWidth: 0,
            minHeight: 44,
            px: 1,
            fontSize: 14,
            fontWeight: 800,
            color: color.navy,
            textTransform: 'capitalize',
          }}
        >
          {MONTHS_SHORT[active.getMonth()]} {active.getFullYear()}
        </Button>

        <IconButton
          aria-label="Semana siguiente"
          onClick={() => onShift(1)}
          sx={{ width: 44, height: 44, flexShrink: 0 }}
        >
          <ChevronRight fontSize="small" />
        </IconButton>

        <Button
          onClick={onToday}
          sx={{
            minHeight: 44,
            minWidth: 44,
            px: 1,
            flexShrink: 0,
            fontSize: 12.5,
            fontWeight: 700,
            color: color.ink,
          }}
        >
          Hoy
        </Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5 }}>
        {days.map((iso, index) => {
          const date = parseISO(iso)
          const selected = iso === value
          const isToday = iso === todayISO
          const hasTrips = marked.has(iso)

          return (
            <Box
              key={iso}
              component="button"
              type="button"
              onClick={() => onSelect(iso)}
              aria-pressed={selected}
              aria-label={`${date.getDate()} de ${MONTHS_LONG[date.getMonth()]}`}
              sx={{
                appearance: 'none',
                minWidth: 0,
                minHeight: 64,
                px: 0.25,
                py: 0.75,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.25,
                border: `1px solid ${selected || isToday ? color.navy : 'transparent'}`,
                borderRadius: `${radius.md}px`,
                bgcolor: selected ? color.navy : color.paper,
                color: selected ? color.paper : isToday ? color.navy : color.inkStrong,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: `background-color ${motion.fast}, color ${motion.fast}`,
                '&:hover': { bgcolor: selected ? color.navyDeep : color.sand },
                '&:focus-visible': { outline: `2px solid ${color.blue}`, outlineOffset: 2 },
              }}
            >
              <Box
                component="span"
                sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1, opacity: selected ? 0.9 : 0.75 }}
              >
                {WEEKDAY_LABELS[index]}
              </Box>
              <Box component="span" sx={{ fontSize: 17, fontWeight: 800, lineHeight: 1.1 }}>
                {date.getDate()}
              </Box>
              <Box
                aria-hidden
                sx={{
                  width: 4,
                  height: 4,
                  borderRadius: '999px',
                  bgcolor: hasTrips ? (selected ? color.orange : color.orangeStrong) : 'transparent',
                }}
              />
            </Box>
          )
        })}
      </Box>

      <Stack direction="row" alignItems="center" spacing={0.8}>
        <Box aria-hidden sx={{ width: 4, height: 4, borderRadius: '999px', bgcolor: color.orange }} />
        <Typography sx={{ fontSize: 12, color: color.muted }}>Día con viajes</Typography>
        {trailing && <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>{trailing}</Box>}
      </Stack>
    </Box>
  )
}
