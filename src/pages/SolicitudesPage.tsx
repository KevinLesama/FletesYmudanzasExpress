import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
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
import { Add, ArrowForward, Search, FilterAltOff, InfoOutlined } from '@mui/icons-material'
import { AppShell, SECCION_BREADCRUMB } from '../components/AppShell'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { CampoSelect, EtiquetaCampo } from '../components/FormFields'
import { StatusChip } from '../components/StatusChip'
import { TablePaginationFooter } from '../components/TablePaginationFooter'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { usePagedList } from '../usePagedList'
import { R } from '../routes'
import { brand } from '../theme'
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

  const statusOptions = STATUS_FILTER_OPTIONS

  return (
    <AppShell
      active="solicitudes"
      breadcrumb={[SECCION_BREADCRUMB, 'Solicitudes']}
      kicker="Gestión de pedidos"
      title="Solicitudes"
      description="Revisá los pedidos y organizá cada servicio."
      action={
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ bgcolor: brand.orangeStrong, '&:hover': { bgcolor: brand.orangeInk } }}
          href={R.nuevaSolicitud}
        >
          Nueva solicitud
        </Button>
      }
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Chip label="Listado completo" size="small" sx={{ bgcolor: '#EEF2FA', color: '#526B8A', fontWeight: 700 }} />
        <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>
          {list.length} {list.length === 1 ? 'solicitud' : 'solicitudes'} en total
        </Typography>
      </Stack>

      {/* Filters */}
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
          '@media (max-width: 600px)': {
            flexDirection: 'column',
            alignItems: 'stretch',
            '& > .search-filter, & > .select-filter, & > .clear-filters': {
              width: '100%',
              flex: 'none',
            },
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
            <Box
              key={r.id}
              sx={{
                bgcolor: '#FFFFFF',
                border: '1px solid #E9E6DF',
                borderRadius: 3,
                p: 2,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography sx={{ fontWeight: 800, fontSize: 13, color: brand.navy }}>{r.id}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>· {fmtDate(r.date, true)}</Typography>
                </Stack>
                <Stack spacing={0.5} alignItems="flex-end">
                  <StatusChip label={r.status} />
                  <Chip
                    label={paymentLabel(r)}
                    size="small"
                    variant="outlined"
                    sx={{ color: 'text.secondary', borderColor: 'divider', fontSize: 11 }}
                  />
                </Stack>
              </Stack>
              <Typography sx={{ mt: 1, fontSize: 15, fontWeight: 700 }}>{r.client}</Typography>
              <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mt: 0.5 }}>
                <Typography sx={{ fontSize: 13, color: '#5C6B7A' }}>{r.origin.barrio}</Typography>
                <ArrowForward sx={{ fontSize: 13, color: '#8A929B' }} />
                <Typography sx={{ fontSize: 13, color: '#5C6B7A' }}>{r.destination.barrio}</Typography>
              </Stack>
              <Button
                size="small"
                fullWidth
                variant="outlined"
                sx={{ mt: 1.5, color: brand.navy, borderColor: '#D9D4C9' }}
                href={R.planificacion(r.id)}
              >
                Ver detalle
              </Button>
            </Box>
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