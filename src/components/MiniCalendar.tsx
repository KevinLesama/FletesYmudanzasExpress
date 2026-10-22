import { Box, IconButton, Stack, Typography } from '@mui/material'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { brand } from '../theme'
import { DEMO_DATE } from '../format'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

export function MiniCalendar({
  year,
  month,
  selected,
  marked,
  onSelect,
  onPrevMonth,
  onNextMonth,
}: {
  year: number
  month: number
  selected: string
  marked: Set<string>
  onSelect: (date: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontFamily: "'Manrope', sans-serif", fontSize: 14 }}>
          {MESES[month]} {year}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={onPrevMonth} aria-label="Mes anterior">
            <ChevronLeft sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton size="small" onClick={onNextMonth} aria-label="Mes siguiente">
            <ChevronRight sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.4 }}>
        {LABELS.map((l) => (
          <Typography key={l} sx={{ textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: brand.muted }}>
            {l}
          </Typography>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <Box key={i} />
          const dateStr = iso(year, month, d)
          const isSelected = dateStr === selected
          const isToday = dateStr === DEMO_DATE
          const hasTrips = marked.has(dateStr)
          return (
            <Box
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(dateStr)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(dateStr)
                }
              }}
              aria-label={dateStr}
              aria-pressed={isSelected}
              sx={{
                textAlign: 'center',
                py: 0.65,
                borderRadius: 2,
                fontSize: 11.5,
                fontWeight: isSelected ? 800 : 600,
                color: isSelected ? '#FFFFFF' : isToday || hasTrips ? brand.navy : '#5C6B7A',
                bgcolor: isSelected ? brand.navy : 'transparent',
                boxShadow: isToday && !isSelected ? 'inset 0 0 0 1.5px #132B4A' : 'none',
                cursor: 'pointer',
                position: 'relative',
                '&:hover': { bgcolor: isSelected ? brand.navy : 'rgba(19,43,74,0.06)' },
              }}
            >
              {d}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 2,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 4,
                  height: 4,
                  borderRadius: 50,
                  bgcolor: hasTrips ? brand.orange : isToday && !isSelected ? '#8A929B' : 'transparent',
                }}
              />
            </Box>
          )
        })}
      </Box>

      <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mt: 1.4 }}>
        <Box sx={{ width: 4, height: 4, borderRadius: 50, bgcolor: brand.orange }} />
        <Typography sx={{ fontSize: 11, color: '#64707C' }}>Día con viajes</Typography>
      </Stack>
    </Box>
  )
}