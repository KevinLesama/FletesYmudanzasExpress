import { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { CalendarMonth, ChevronLeft, ChevronRight, Tune } from '@mui/icons-material'
import { MiniCalendar } from './MiniCalendar'
import { color, motion, radius, type } from '../design/tokens'
import { fmtRange } from '../agendaDates'
import type { Driver, Vehicle } from '../types'

export type AgendaView = 'day' | 'workWeek'

export interface AgendaFilters {
  driver: string
  vehicle: string
  status: string
}

export const EMPTY_FILTERS: AgendaFilters = { driver: 'all', vehicle: 'all', status: 'all' }

const STATUS_OPTIONS = ['Confirmada', 'Pendiente de seña', 'Pendiente de revisión', 'Cancelada']

export function countActiveFilters(filters: AgendaFilters): number {
  return Object.values(filters).filter((value) => value !== 'all').length
}

function LegendSwatch({ tone, label }: { tone: string; label: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.6}>
      <Box sx={{ width: 10, height: 10, borderRadius: 0.6, bgcolor: tone }} />
      <Typography sx={{ fontSize: type.micro, fontWeight: 600, color: color.muted, whiteSpace: 'nowrap' }}>{label}</Typography>
    </Stack>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  id,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  id: string
}) {
  return (
    <FormControl size="small" fullWidth>
      <InputLabel id={id} sx={{ fontSize: 13 }}>
        {label}
      </InputLabel>
      <Select labelId={id} label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ bgcolor: color.paper }}>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

export function AgendaToolbar({
  view,
  onViewChange,
  days,
  anchor,
  marked,
  onSelectDate,
  onShift,
  onToday,
  filters,
  onFiltersChange,
  drivers,
  vehicles,
  showViewSwitch,
  showLegend,
}: {
  view: AgendaView
  onViewChange: (view: AgendaView) => void
  days: string[]
  anchor: string
  marked: Set<string>
  onSelectDate: (date: string) => void
  onShift: (direction: -1 | 1) => void
  onToday: () => void
  filters: AgendaFilters
  onFiltersChange: (filters: AgendaFilters) => void
  drivers: Driver[]
  vehicles: Vehicle[]
  showViewSwitch: boolean
  showLegend: boolean
}) {
  const [dateAnchor, setDateAnchor] = useState<HTMLElement | null>(null)
  const [filtersAnchor, setFiltersAnchor] = useState<HTMLElement | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const [year, month] = anchor.split('-').map(Number)
    return { year, month: (month ?? 1) - 1 }
  })

  const activeFilters = countActiveFilters(filters)
  const rangeLabel = fmtRange(days)

  const openCalendar = (event: React.MouseEvent<HTMLElement>) => {
    const [year, month] = anchor.split('-').map(Number)
    setCalendarMonth({ year, month: (month ?? 1) - 1 })
    setDateAnchor(event.currentTarget)
  }

  const pickDate = (date: string) => {
    setDateAnchor(null)
    onSelectDate(date)
  }

  const shiftCalendarMonth = (delta: number) => {
    const moved = new Date(calendarMonth.year, calendarMonth.month + delta, 1)
    setCalendarMonth({ year: moved.getFullYear(), month: moved.getMonth() })
  }

  const clearFilters = () => onFiltersChange(EMPTY_FILTERS)

  const driverOptions = useMemo(
    () => [{ value: 'all', label: 'Todos los choferes' }, ...drivers.map((d) => ({ value: d.id, label: d.name }))],
    [drivers],
  )
  const vehicleOptions = useMemo(
    () => [{ value: 'all', label: 'Todos los vehículos' }, ...vehicles.map((v) => ({ value: v.id, label: `${v.id} · ${v.type}` }))],
    [vehicles],
  )
  const statusOptions = useMemo(
    () => [{ value: 'all', label: 'Todos los estados' }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))],
    [],
  )

  return (
    <>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ flexWrap: 'wrap', rowGap: 1.2, columnGap: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Button
            size="small"
            variant="outlined"
            onClick={onToday}
            sx={{
              fontWeight: 700,
              fontSize: type.caption,
              color: color.navy,
              borderColor: color.border,
              px: 1.4,
              '&:hover': { borderColor: color.navy, bgcolor: color.sand },
            }}
          >
            Hoy
          </Button>
          <IconButton size="small" onClick={() => onShift(-1)} aria-label={view === 'day' ? 'Día anterior' : 'Semana anterior'}>
            <ChevronLeft fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => onShift(1)} aria-label={view === 'day' ? 'Día siguiente' : 'Semana siguiente'}>
            <ChevronRight fontSize="small" />
          </IconButton>
        </Stack>

        <Button
          onClick={openCalendar}
          startIcon={<CalendarMonth sx={{ fontSize: 17 }} />}
          aria-label={`Elegir fecha. Rango actual: ${rangeLabel}`}
          sx={{
            color: color.navy,
            fontWeight: 700,
            fontSize: type.body,
            textTransform: 'none',
            px: 1.2,
            py: 0.6,
            borderRadius: 2,
            '&:hover': { bgcolor: color.sandDeep },
          }}
        >
          {rangeLabel}
        </Button>

        <Box sx={{ flexGrow: 1 }} />

        {showViewSwitch && (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, next: AgendaView | null) => next && onViewChange(next)}
            aria-label="Vista de la agenda"
            sx={{
              bgcolor: color.sandDeep,
              borderRadius: radius.pill,
              p: 0.4,
              '& .MuiToggleButtonGroup-grouped': {
                border: 0,
                borderRadius: `${radius.pill}px !important`,
                px: 1.6,
                py: 0.5,
                color: color.muted,
                fontWeight: 700,
                fontSize: type.caption,
                textTransform: 'none',
                transition: `background-color ${motion.fast}, color ${motion.fast}`,
                '&:hover': { bgcolor: 'rgba(19,43,74,0.06)' },
                '&.Mui-selected': {
                  bgcolor: color.paper,
                  color: color.navy,
                  boxShadow: '0 1px 2px rgba(19,43,74,0.12)',
                  '&:hover': { bgcolor: color.paper },
                },
              },
            }}
          >
            <ToggleButton value="day">Día</ToggleButton>
            <ToggleButton value="workWeek">Semana laboral</ToggleButton>
          </ToggleButtonGroup>
        )}

        <Tooltip title={activeFilters === 0 ? 'Filtros' : `Filtros (${activeFilters} activos)`}>
          <IconButton
            onClick={(event) => setFiltersAnchor(event.currentTarget)}
            aria-label={`Filtros${activeFilters ? `, ${activeFilters} activos` : ''}`}
            sx={{
              border: `1px solid ${activeFilters ? color.navy : color.border}`,
              borderRadius: 2,
              color: activeFilters ? color.navy : color.muted,
              bgcolor: activeFilters ? color.sandDeep : 'transparent',
              '&:hover': { bgcolor: color.sandDeep },
            }}
          >
            <Badge
              variant="dot"
              invisible={activeFilters === 0}
              sx={{ '& .MuiBadge-badge': { bgcolor: color.orangeInk, boxShadow: `0 0 0 2px ${color.paper}` } }}
            >
              <Tune sx={{ fontSize: 18 }} />
            </Badge>
          </IconButton>
        </Tooltip>

        {showLegend && (
          <Stack direction="row" alignItems="center" spacing={1.4} sx={{ pl: 0.5 }}>
            <LegendSwatch tone={color.green} label="Confirmada" />
            <LegendSwatch tone={color.amber} label="Pendiente de seña" />
          </Stack>
        )}
      </Stack>

      <Popover
        open={Boolean(dateAnchor)}
        anchorEl={dateAnchor}
        onClose={() => setDateAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 2, borderRadius: 3, border: `1px solid ${color.border}` } } }}
      >
        <Box sx={{ width: 260 }}>
          <MiniCalendar
            year={calendarMonth.year}
            month={calendarMonth.month}
            selected={anchor}
            marked={marked}
            onSelect={pickDate}
            onPrevMonth={() => shiftCalendarMonth(-1)}
            onNextMonth={() => shiftCalendarMonth(1)}
          />
        </Box>
      </Popover>

      <Popover
        open={Boolean(filtersAnchor)}
        anchorEl={filtersAnchor}
        onClose={() => setFiltersAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 2, borderRadius: 3, border: `1px solid ${color.border}` } } }}
      >
        <Stack spacing={1.5} sx={{ width: 260 }}>
          <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: type.lead }}>
            Filtros
          </Typography>
          <FilterSelect
            id="agenda-filter-driver"
            label="Chofer"
            value={filters.driver}
            onChange={(driver) => onFiltersChange({ ...filters, driver })}
            options={driverOptions}
          />
          <FilterSelect
            id="agenda-filter-vehicle"
            label="Vehículo"
            value={filters.vehicle}
            onChange={(vehicle) => onFiltersChange({ ...filters, vehicle })}
            options={vehicleOptions}
          />
          <FilterSelect
            id="agenda-filter-status"
            label="Estado"
            value={filters.status}
            onChange={(status) => onFiltersChange({ ...filters, status })}
            options={statusOptions}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" onClick={clearFilters} disabled={activeFilters === 0} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Limpiar filtros
            </Button>
          </Box>
        </Stack>
      </Popover>
    </>
  )
}
