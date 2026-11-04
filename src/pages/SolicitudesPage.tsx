import { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { Add, ArrowForward, Close, FilterAlt, Search, FilterAltOff, InfoOutlined } from '@mui/icons-material'
import { AppShell, SECCION_BREADCRUMB } from '../components/AppShell'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { CampoSelect, EtiquetaCampo } from '../components/FormFields'
import { StatusChip } from '../components/StatusChip'
import { TablePaginationFooter } from '../components/TablePaginationFooter'
import { MobileCard } from '../components/mobile/MobileCard'
import { MobileFilterSheet } from '../components/mobile/MobileFilterSheet'
import { MOBILE_INPUT_SX, wrapAnywhere } from '../components/mobile/mobileSx'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { usePagedList } from '../usePagedList'
import { R } from '../routes'
import { brand } from '../theme'
import { color } from '../design/tokens'
import { fmtDate, formatShortPlace } from '../format'
import { SEARCH_FIELD_SX, SEARCH_INPUT_PROPS } from '../searchField'
import type { ShiftRequest } from '../types'

const LIST_PAGE_SIZE = 10

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'Pendiente de revisión', label: 'Pendiente de revisión' },
  { value: 'Pendiente de seña', label: 'Pendiente de seña' },
  { value: 'Confirmada', label: 'Confirmada' },
  { value: 'Finalizada', label: 'Finalizada' },
  { value: 'Cancelada', label: 'Cancelada' },
]

function paymentLabel(request: ShiftRequest): string {
  const collected = request.payments?.length
    ? request.payments.reduce((total, payment) => total + payment.amount, 0)
    : request.depositReceived
  if (request.price > 0 && collected >= request.price) return 'Pagado'
  return collected > 0 ? 'Seña recibida' : 'Sin seña'
}

export function SolicitudesPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('all')
  // Mobile only: the filters live in a bottom sheet.
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Permite llegar con un filtro preseleccionado, por ejemplo desde la agenda:
  // /solicitudes?estado=Pendiente%20de%20revisi%C3%B3n
  const [status, setStatus] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('estado')
    return requested && STATUS_FILTER_OPTIONS.some((option) => option.value === requested) ? requested : 'all'
  })

  const { data, loading, error, reload } = useAsync(() => api.listRequests(), [])

  const list = useMemo(() => {
    const requests = data ?? []
    return requests
      .filter((r) => {
        const q = search.trim().toLowerCase()
        if (q && !r.client.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false
        if (date !== 'all' && r.date.slice(5).replace('-', '/') !== date && r.date.slice(8) !== date) return false
        if (status !== 'all' && r.status !== status) return false
        return true
      })
      .sort((a, b) => Number(b.id.slice(4)) - Number(a.id.slice(4)))
  }, [data, search, date, status])

  const pages = usePagedList(list, LIST_PAGE_SIZE)

  const dateOptions = useMemo(() => {
    const unique = Array.from(new Set((data ?? []).map((r) => r.date)))
      .sort()
      .reverse()
    return [
      { value: 'all', label: 'Todas las fechas' },
      ...unique.map((d) => ({ value: d.slice(5).replace('-', '/'), label: fmtDate(d, true) })),
    ]
  }, [data])


  const clearFilters = () => {
    setSearch('')
    setDate('all')
    setStatus('all')
  }

  const filtersActive = search !== '' || date !== 'all' || status !== 'all'
  // Badge on the mobile "Filtros" button: the filters that live inside the sheet.
  const sheetFilterCount = (date !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0)

  // Same setters as the desktop controls, rendered as removable chips on mobile.
  const activeChips: Array<{ key: string; label: string; clear: () => void }> = []
  if (search.trim()) activeChips.push({ key: 'search', label: `Búsqueda: ${search.trim()}`, clear: () => setSearch('') })
  if (date !== 'all') {
    activeChips.push({
      key: 'date',
      label: `Fecha: ${dateOptions.find((option) => option.value === date)?.label ?? date}`,
      clear: () => setDate('all'),
    })
  }
  if (status !== 'all') activeChips.push({ key: 'status', label: `Estado: ${status}`, clear: () => setStatus('all') })

  const statusOptions = STATUS_FILTER_OPTIONS

  return (
    <AppShell
      active="solicitudes"
      breadcrumb={[SECCION_BREADCRUMB, 'Solicitudes']}
      kicker="Gestión de pedidos"
      title="Solicitudes"
      description="Revisá los pedidos y organizá cada servicio."
      mobileAction={
        <IconButton
          component="a"
          href={R.nuevaSolicitud}
          aria-label="Nueva solicitud"
          sx={{ color: 'inherit', width: 44, height: 44 }}
        >
          <Add />
        </IconButton>
      }
      action={
        !isMobile && (
          <Button
            variant="contained"
            startIcon={<Add />}
            sx={{ bgcolor: brand.orangeStrong, '&:hover': { bgcolor: brand.orangeInk } }}
            href={R.nuevaSolicitud}
          >
            Nueva solicitud
          </Button>
        )
      }
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: { xs: 1.5, md: 2 } }}>
        <Chip label="Listado completo" size="small" sx={{ bgcolor: '#EEF2FA', color: '#526B8A', fontWeight: 700 }} />
        <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>
          {list.length} {list.length === 1 ? 'solicitud' : 'solicitudes'} en total
        </Typography>
      </Stack>

      {isMobile ? (
        <>
          {/* Search + filter sheet: same state and same handlers as desktop. */}
          <Stack direction="row" alignItems="flex-end" spacing={1} sx={{ mb: 1.5 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <EtiquetaCampo text="Buscar" htmlFor="solicitudes-search-mobile" />
              <TextField
                id="solicitudes-search-mobile"
                fullWidth
                size="small"
                type="search"
                placeholder="Buscar por cliente o número de solicitud"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ ...SEARCH_FIELD_SX, ...MOBILE_INPUT_SX }}
                inputProps={SEARCH_INPUT_PROPS}
                InputProps={{ startAdornment: <Search sx={{ fontSize: 17, color: 'text.secondary', mr: 1 }} /> }}
              />
            </Box>
            <Badge badgeContent={sheetFilterCount} color="secondary" overlap="circular">
              <IconButton
                aria-label={sheetFilterCount > 0 ? `Filtros (${sheetFilterCount} activos)` : 'Filtros'}
                onClick={() => setFiltersOpen(true)}
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  color: brand.navy,
                }}
              >
                <FilterAlt />
              </IconButton>
            </Badge>
          </Stack>

          {activeChips.length > 0 && (
            <Stack direction="row" useFlexGap spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
              {activeChips.map((chip) => (
                <Chip
                  key={chip.key}
                  label={chip.label}
                  onClick={chip.clear}
                  onDelete={chip.clear}
                  deleteIcon={<Close sx={{ fontSize: 18 }} />}
                  aria-label={`Quitar filtro ${chip.label}`}
                  sx={{
                    minHeight: 44,
                    height: 'auto',
                    maxWidth: '100%',
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    color: color.inkStrong,
                    '& .MuiChip-label': { py: 0.75, ...wrapAnywhere },
                  }}
                />
              ))}
            </Stack>
          )}

          <MobileFilterSheet
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            onClear={clearFilters}
            activeCount={sheetFilterCount}
          >
            <CampoSelect label="Filtrar por fecha" value={date} onChange={(e) => setDate(e.target.value)}>
              {dateOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </CampoSelect>
            <CampoSelect label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </CampoSelect>
          </MobileFilterSheet>
        </>
      ) : (
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            px: 2,
            py: 2,
            mb: 2.5,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1.5,
            '& > .search-filter': {
              flex: 1,
              minWidth: 0,
              '& .MuiOutlinedInput-root': { height: 48 },
            },
            '& > .select-filter': {
              width: 180,
              flexShrink: 0,
              '& .MuiOutlinedInput-root': { height: 48 },
            },
            '& > .clear-filters': {
              height: 48,
              minHeight: 48,
              flexShrink: 0,
              alignSelf: 'flex-end',
            },
          }}
        >
          <Box className="search-filter">
            <EtiquetaCampo text="Buscar" htmlFor="solicitudes-search" />
            <TextField
              id="solicitudes-search"
              fullWidth
              size="small"
              type="search"
              placeholder="Buscar por cliente o número de solicitud"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={SEARCH_FIELD_SX}
              inputProps={SEARCH_INPUT_PROPS}
              InputProps={{ startAdornment: <Search sx={{ fontSize: 17, color: 'text.secondary', mr: 1 }} /> }}
            />
          </Box>
          <Box className="select-filter">
            <CampoSelect label="Filtrar por fecha" size="small" value={date} onChange={(e) => setDate(e.target.value)}>
              {dateOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </CampoSelect>
          </Box>
          <Box className="select-filter">
            <CampoSelect label="Filtrar por estado" size="small" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </CampoSelect>
          </Box>
          <Button className="clear-filters" startIcon={<FilterAltOff />} onClick={clearFilters} sx={{ color: brand.navy, fontWeight: 700 }}>
            Limpiar filtros
          </Button>
        </Box>
      )}

      {/* List */}
      {loading ? (
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
          <LoadingState label="Cargando solicitudes..." />
        </Box>
      ) : error ? (
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
          <ErrorState message={error} onRetry={reload} />
        </Box>
      ) : list.length === 0 ? (
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
          <EmptyState title="No encontramos solicitudes" subtext="Probá cambiar la búsqueda o los filtros." />
        </Box>
      ) : !isMobile ? (
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, overflow: 'hidden' }}>
          <Table sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 110, whiteSpace: 'nowrap' }}>Número</TableCell>
                <TableCell sx={{ width: '18%' }}>Cliente</TableCell>
                <TableCell sx={{ width: 110, whiteSpace: 'nowrap' }}>Fecha</TableCell>
                <TableCell sx={{ width: '34%' }}>Origen → destino</TableCell>
                <TableCell sx={{ width: 130, whiteSpace: 'nowrap' }}>Estado</TableCell>
                <TableCell align="right" sx={{ width: 130, whiteSpace: 'nowrap' }}>Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pages.pageItems.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 800, color: brand.navy, whiteSpace: 'nowrap', height: 64 }}>{r.id}</TableCell>
                  <TableCell sx={{ height: 64 }}>
                    <Typography
                      sx={{
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        lineHeight: 1.35,
                      }}
                      title={r.client}
                    >
                      {r.client}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</TableCell>
                  <TableCell sx={{ height: 64 }}>
                    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ minWidth: 0 }}>
                      <Typography
                        sx={{
                          minWidth: 0,
                          flex: 1,
                          fontSize: 13.5,
                          display: '-webkit-box',
                          overflow: 'hidden',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          lineHeight: 1.35,
                        }}
                        title={r.origin.address}
                      >
                        {formatShortPlace(r.origin)}
                      </Typography>
                      <ArrowForward sx={{ fontSize: 13, color: '#8A929B' }} />
                      <Typography
                        sx={{
                          minWidth: 0,
                          flex: 1,
                          fontSize: 13.5,
                          display: '-webkit-box',
                          overflow: 'hidden',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          lineHeight: 1.35,
                        }}
                        title={r.destination.address}
                      >
                        {formatShortPlace(r.destination)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Stack spacing={0.5} alignItems="flex-start">
                      <StatusChip label={r.status} />
                      <Chip
                        label={paymentLabel(r)}
                        size="small"
                        variant="outlined"
                        sx={{ color: 'text.secondary', borderColor: 'divider', fontSize: 11 }}
                      />
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      aria-label="Ver detalle"
                      sx={{
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                        '@media (max-width: 1100px)': {
                          '& .detail-label': { display: 'none' },
                          '& .MuiButton-endIcon': { margin: 0 },
                        },
                      }}
                      endIcon={<ArrowForward sx={{ fontSize: 15 }} />}
                      href={R.planificacion(r.id)}
                    >
                      <Box component="span" className="detail-label">Ver detalle</Box>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePaginationFooter
            page={pages.page}
            pageSize={LIST_PAGE_SIZE}
            total={pages.total}
            itemLabel="solicitudes"
            onPageChange={pages.setPage}
          />
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {list.map((r) => (
            // The whole card is the link to the same destination as "Ver detalle".
            <MobileCard
              key={r.id}
              href={R.planificacion(r.id)}
              header={
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: brand.navy }}>{r.id}</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <StatusChip label={r.status} />
                </>
              }
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: color.navy, ...wrapAnywhere }}>
                  {r.client}
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: color.muted }}>{fmtDate(r.date, true)}</Typography>
                <Stack direction="row" alignItems="flex-start" spacing={0.75} sx={{ mt: 0.75, minWidth: 0 }}>
                  <Typography
                    sx={{
                      flex: 1,
                      fontSize: 12.5,
                      lineHeight: 1.35,
                      color: color.inkStrong,
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                      ...wrapAnywhere,
                    }}
                  >
                    {formatShortPlace(r.origin)}
                  </Typography>
                  <ArrowForward sx={{ fontSize: 14, color: color.mutedSoft, mt: '2px', flexShrink: 0 }} />
                  <Typography
                    sx={{
                      flex: 1,
                      fontSize: 12.5,
                      lineHeight: 1.35,
                      color: color.inkStrong,
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                      ...wrapAnywhere,
                    }}
                  >
                    {formatShortPlace(r.destination)}
                  </Typography>
                </Stack>
                <Box sx={{ mt: 1 }}>
                  <Chip
                    label={paymentLabel(r)}
                    size="small"
                    variant="outlined"
                    sx={{ color: 'text.secondary', borderColor: 'divider', fontSize: 11 }}
                  />
                </Box>
              </Box>
            </MobileCard>
          ))}
        </Stack>
      )}

      <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mt: 2.5 }}>
        <InfoOutlined sx={{ fontSize: 15, color: '#64707C', mt: 0.2 }} />
        <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>
          Una solicitud se confirma cuando se acuerdan las condiciones y se registra la seña.
        </Typography>
      </Stack>
    </AppShell>
  )
}