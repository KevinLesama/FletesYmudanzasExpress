import { Box, Stack, Typography, useTheme, useMediaQuery } from '@mui/material'
import { AccessTime, CalendarMonth, Person, ArrowForward, MyLocation, LocationOn, WarningAmber } from '@mui/icons-material'
import type { ShiftRequest } from '../types'
import { StatusChip } from './StatusChip'
import type { Driver, Vehicle } from '../types'
import { brand } from '../theme'

interface TripCardProps {
  trip: ShiftRequest
  driver?: Driver
  vehicle?: Vehicle
  selected?: boolean
  onSelect?: () => void
  conflictNote?: string
}

export function TripCard({ trip, driver, vehicle, selected, onSelect, conflictNote }: TripCardProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const row = (label: string, value: string, icon: React.ReactNode) => (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box sx={{ color: '#8A939E', display: 'flex' }}>{icon}</Box>
      <Typography sx={{ fontSize: 12, color: '#8A939E', width: 86, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#33475F' }}>{value}</Typography>
    </Stack>
  )

  return (
    <Box
      component="article"
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onSelect()
        }
      }}
      sx={{
        bgcolor: '#FFFFFF',
        border: selected ? `1.5px solid ${brand.navy}` : '1px solid #E9E6DF',
        borderRadius: 3,
        p: 2,
        cursor: onSelect ? 'pointer' : 'default',
        boxShadow: selected ? '0 4px 16px rgba(19,43,74,0.10)' : '0 1px 2px rgba(19,43,74,0.04)',
        transition: 'box-shadow 120ms,border-color 120ms',
        '&:hover': onSelect ? { boxShadow: '0 4px 16px rgba(19,43,74,0.12)' } : undefined,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: brand.navy, letterSpacing: '0.02em' }}>
          {trip.id}
        </Typography>
        <StatusChip label={trip.status} />
      </Stack>

      <Typography
        sx={{
          mt: 1,
          fontFamily: "'Manrope', sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: brand.navy,
        }}
      >
        {trip.client}
      </Typography>

      <Stack
        spacing={isMobile ? 1.2 : 1.5}
        sx={{ my: 1.5, py: 1.4, borderTop: '1px solid #EDF0F2', borderBottom: '1px solid #EDF0F2' }}
      >
        {row(
          'Llegada',
          `${trip.arrivalRange[0]}-${trip.arrivalRange[1]}`,
          <AccessTime sx={{ fontSize: 15 }} />,
        )}
        {row(
          trip.serviceRange[0] === trip.arrivalRange[0] ? 'Servicio' : 'Servicio est.',
          `${trip.serviceRange[0]}-${trip.serviceRange[1]}`,
          <CalendarMonth sx={{ fontSize: 15 }} />,
        )}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        <Typo color="#8A939E" size={12.5}>
          {trip.origin.barrio}
        </Typo>
        <ArrowForward sx={{ fontSize: 13, color: '#B8C0C9', flexShrink: 0 }} />
        <Typo color="#8A939E" size={12.5}>
          {trip.destination.barrio}
        </Typo>
      </Stack>

      {driver && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.2 }}>
          <Person sx={{ fontSize: 14, color: '#8A939E' }} />
          <Typography sx={{ fontSize: 12.5, color: '#5C6B7A' }}>{driver.name}</Typography>
          {vehicle && (
            <>
              <Box sx={{ width: 3, height: 3, borderRadius: 50, bgcolor: '#C4C9CE' }} />
              <Typography
                sx={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: brand.navy,
                  bgcolor: '#F0F2F5',
                  borderRadius: 1,
                  px: 0.8,
                  py: 0.2,
                }}
              >
                {vehicle.id}
              </Typography>
            </>
          )}
        </Stack>
      )}

      {conflictNote && (
        <Box
          sx={{
            mt: 1.4,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            borderRadius: 2,
            bgcolor: '#FFF3EF',
            border: '1px solid #F3DAD2',
            color: '#9C493A',
            p: 1.2,
          }}
        >
          <WarningAmber sx={{ fontSize: 16, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{conflictNote}</Typography>
        </Box>
      )}
    </Box>
  )
}

function Typo({ children, color, size }: { children: React.ReactNode; color: string; size: number }) {
  return (
    <Typography sx={{ fontSize: size, fontWeight: 600, color }} component="span">
      {children}
    </Typography>
  )
}