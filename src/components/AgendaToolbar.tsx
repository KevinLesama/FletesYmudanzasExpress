import { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { CalendarMonth, ChevronLeft, ChevronRight, Close, Tune } from '@mui/icons-material'
import { MiniCalendar } from './MiniCalendar'
import { SegmentedControl } from './SegmentedControl'
import { ESTADOS_AGENDA } from './AgendaGrid'
import { color, radius, type } from '../design/tokens'
import { fmtRange } from '../agendaDates'
import type { Driver, Vehicle } from '../types'

export type AgendaView = 'day' | 'workWeek'

export interface AgendaFilters {
  driver: string
  vehicle: string
  status: string
}

export const EMPTY_FILTERS: AgendaFilters = { driver: 'all', vehicle: 'all', status: 'all' }

export function countActiveFilters(filters: AgendaFilters): number {
  return Object.values(filters).filter((value) => value !== 'all').length
}

/**
 * Filter option lists shared by the desktop popover and the mobile filter
 * sheet, so both render exactly the same choices.
 */
export function driverFilterOptions(drivers: Driver[]): { value: string; label: string }[] {
  return [{ value: 'all', label: 'Todos los choferes' }, ...drivers.map((d) => ({ value: d.id, label: d.name }))]
}

export function vehicleFilterOptions(vehicles: Vehicle[]): { value: string; label: string }[] {
  return [
    { value: 'all', label: 'Todos los vehículos' },
    // El filtro compara contra `solicitudes.vehiculo_id`, que guarda la PK: la
    // patente (`v.id`) es solo para mostrar.
    ...vehicles.map((v) => ({ value: v.vehicleId, label: `${v.id} · ${v.type}` })),
  ]
}

/** Los estados salen de la leyenda de la agenda para que nunca se desincronicen. */
export function statusFilterOptions(): { value: string; label: string }[] {
  return [
    { value: 'all', label: 'Todos los estados' },
    ...ESTADOS_AGENDA.map((status) => ({ value: status.key, label: status.label })),
  ]
}

/** Calendar month (`0`-based) that contains an ISO date. */
export function calendarMonthOf(iso: string): { year: number; month: number } {
  const [year, month] = iso.split('-').map(Number)
  return { year, month: (month ?? 1) - 1 }
}

/** Moves a calendar month by `delta` months, keeping the day at 1. */
export function shiftMonth(current: { year: number; month: number }, delta: number) {
  const moved = new Date(current.year, current.month + delta, 1)
  return { year: moved.getFullYear(), month: moved.getMonth() }
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

/**
 * Chips de los filtros activos. Repiten el label del selector (misma fuente, sin
 * duplicar nombres) y se quitan con la X. Sin filtros no renderizan nada: el
 * encabezado no carga un contenedor vacío.
 */
export function ActiveFilterChips({
  filters,
  onChange,
  drivers,
  vehicles,
}: {
  filters: AgendaFilters
  onChange: (filters: AgendaFilters) => void
  drivers: Driver[]
  vehicles: Vehicle[]
}) {
  const chips: { key: keyof AgendaFilters; label: string }[] = []
  if (filters.driver !== 'all') {
    const label = driverFilterOptions(drivers).find((option) => option.value === filters.driver)?.label
    chips.push({ key: 'driver', label: `Chofer: ${label ?? filters.driver}` })
  }
  if (filters.vehicle !== 'all') {
    const label = vehicleFilterOptions(vehicles).find((option) => option.value === filters.vehicle)?.label
    chips.push({ key: 'vehicle', label: `Vehículo: ${label ?? filters.vehicle}` })
  }
  if (filters.status !== 'all') {
    const label = statusFilterOptions().find((option) => option.value === filters.status)?.label
    chips.push({ key: 'status', label: `Estado: ${label ?? filters.status}` })
  }

  if (chips.length === 0) return null

  return (
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', rowGap: 0.75, columnGap: 0.75, minWidth: 0 }}>
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          onClick={() => onChange({ ...filters, [chip.key]: 'all' })}
          onDelete={() => onChange({ ...filters, [chip.key]: 'all' })}
          deleteIcon={<Close sx={{ fontSize: 16 }} />}
          aria-label={`Quitar filtro ${chip.label}`}
          sx={{
            height: 'auto',
            minHeight: { xs: 40, md: 28 },
            maxWidth: '100%',
            borderRadius: `${radius.pill}px`,
            bgcolor: color.blueSoft,
            border: `1px solid ${color.border}`,
            color: color.navy,
            fontWeight: 700,
            fontSize: type.caption,
            '& .MuiChip-label': { px: 1.25, py: 0.5, minWidth: 0, overflowWrap: 'anywhere' },
            '& .MuiChip-deleteIcon': {
              color: color.muted,
              mr: 0.6,
              '&:hover': { color: color.navy },
            },
          }}
        />
      ))}
    </Stack>
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
  const [calendarMonth, setCalendarMonth] = useState(() => calendarMonthOf(anchor))

  const activeFilters = countActiveFilters(filters)
  const rangeLabel = fmtRange(days)

  const openCalendar = (event: React.MouseEvent<HTMLElement>) => {
    setCalendarMonth(calendarMonthOf(anchor))
    setDateAnchor(event.currentTarget)
  }

  const pickDate = (date: string) => {
    setDateAnchor(null)
    onSelectDate(date)
  }

  const shiftCalendarMonth = (delta: number) => {
    setCalendarMonth(shiftMonth(calendarMonth, delta))
  }

  const clearFilters = () => onFiltersChange(EMPTY_FILTERS)

  const driverOptions = useMemo(() => driverFilterOptions(drivers), [drivers])
  const vehicleOptions = useMemo(() => vehicleFilterOptions(vehicles), [vehicles])
  const statusOptions = useMemo(() => statusFilterOptions(), [])

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

        <ActiveFilterChips
          filters={filters}
          onChange={onFiltersChange}
          drivers={drivers}
          vehicles={vehicles}
        />

        <Box sx={{ flexGrow: 1 }} />

        {showViewSwitch && (
          <SegmentedControl
            value={view}
            onChange={onViewChange}
            ariaLabel="Vista de la agenda"
            options={[
              { value: 'day', label: 'Día' },
              { value: 'workWeek', label: 'Semana laboral' },
            ]}
          />
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
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.4}
            useFlexGap
            sx={{ pl: 0.5, flexWrap: 'wrap', rowGap: 0.6 }}
          >
            {ESTADOS_AGENDA.map((status) => (
              <LegendSwatch key={status.key} tone={status.ink} label={status.label} />
            ))}
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
