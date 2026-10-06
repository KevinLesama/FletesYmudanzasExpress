import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { Add, ArrowForward, ArrowBack, Search, FilterAltOff, InfoOutlined } from '@mui/icons-material'
import { AppShell } from '../components/AppShell'
import { EmptyState } from '../components/EmptyState'
import { StatusChip } from '../components/StatusChip'
import { REQUESTS } from '../mockData'
import { R } from '../routes'
import { brand } from '../theme'
import { fmtDate } from '../format'

export function SolicitudesPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('all')
  const [status, setStatus] = useState('all')

  const list = useMemo(() => {
    return REQUESTS.filter((r) => {
      const q = search.trim().toLowerCase()
      if (q && !r.client.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false
      if (date !== 'all' && r.date.slice(5).replace('-', '/') !== date && r.date.slice(8) !== date) return false
      if (status !== 'all' && r.status !== status) return false
      return true
    }).sort((a, b) => Number(b.id.slice(4)) - Number(a.id.slice(4)))
  }, [search, date, status])

  const clearFilters = () => {
    setSearch('')
    setDate('all')
    setStatus('all')
  }

  const filtersActive = search !== '' || date !== 'all' || status !== 'all'

  const dateOptions = [
    { value: 'all', label: 'Todas las fechas' },
    { value: '24/09', label: '24/09' },
    { value: '26/09', label: '26/09' },
    { value: '20/09', label: '20/09' },
  ]

  const statusOptions = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'Pendiente de seña', label: 'Pendiente de seña' },
    { value: 'Confirmada', label: 'Confirmada' },
    { value: 'Pendiente de revisión', label: 'Pendiente de revisión' },
    { value: 'Cancelada', label: 'Cancelada' },
  ]

  return (
    <AppShell
      active="solicitudes"
      breadcrumb={['Gestión', 'Solicitudes']}
      kicker="Gestión de pedidos"
      title="Solicitudes"
      description="Revisá los pedidos y organizá cada servicio."
      action={
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ bgcolor: brand.orange, '&:hover': { bgcolor: brand.orangeDark } }}
          href={R.nuevaSolicitud}
        >
          Nueva solicitud
        </Button>
      }
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Chip label="Listado completo" size="small" sx={{ bgcolor: '#EEF2FA', color: '#526B8A', fontWeight: 700 }} />
        <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>
          {list.length} {list.length === 1 ? 'solicitud' : 'solicitudes'} en total
        </Typography>
      </Stack>

      {/* Filters */}
      <Box
        sx={{
          bgcolor: '#FFFFFF',
          border: '1px solid #E9E6DF',
          borderRadius: 3,
          p: 2,
          mb: 2.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr auto' },
          gap: 1.5,
          alignItems: 'center',
        }}
      >
        <TextField
          size="small"
          placeholder="Buscar por cliente o número de solicitud"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ fontSize: 17, color: '#8A939E', mr: 1 }} /> }}
        />
        <FormControl size="small">
          <InputLabel>Filtrar por fecha</InputLabel>
          <Select label="Filtrar por fecha" value={date} onChange={(e) => setDate(e.target.value)}>
            {dateOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Filtrar por estado</InputLabel>
          <Select label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value)}>
            {statusOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button startIcon={<FilterAltOff />} onClick={clearFilters} sx={{ color: brand.navy, fontWeight: 700 }}>
          Limpiar filtros
        </Button>
      </Box>

      {/* List */}
      {list.length === 0 ? (
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
          <EmptyState title="No encontramos solicitudes" subtext="Probá cambiar la búsqueda o los filtros." />
        </Box>
      ) : !isMobile ? (
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Número</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Origen → destino</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 800, color: brand.navy }}>{r.id}</TableCell>
                  <TableCell>{r.client}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={0.8}>
                      <Typography sx={{ fontSize: 13.5 }}>{r.origin.barrio}</Typography>
                      <ArrowForward sx={{ fontSize: 13, color: '#B8C0C9' }} />
                      <Typography sx={{ fontSize: 13.5 }}>{r.destination.barrio}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell><StatusChip label={r.status} /></TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      sx={{ fontWeight: 700 }}
                      endIcon={<ArrowForward sx={{ fontSize: 15 }} />}
                      href={R.planificacion(r.id)}
                    >
                      Ver detalle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2.5, py: 1.5, borderTop: '1px solid #EDEAE3', bgcolor: '#FBF9F6' }}
          >
            <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>
              Mostrando 1-{list.length} de {list.length} solicitudes
            </Typography>
            <Stack direction="row" spacing={1}>
              <IconButton size="small" disabled aria-label="Página anterior"><ArrowBack sx={{ fontSize: 18 }} /></IconButton>
              <IconButton size="small" disabled aria-label="Página siguiente"><ArrowForward sx={{ fontSize: 18 }} /></IconButton>
            </Stack>
          </Stack>
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
                  <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>· {fmtDate(r.date, true)}</Typography>
                </Stack>
                <StatusChip label={r.status} />
              </Stack>
              <Typography sx={{ mt: 1, fontSize: 15, fontWeight: 700 }}>{r.client}</Typography>
              <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mt: 0.5 }}>
                <Typography sx={{ fontSize: 13, color: '#5C6B7A' }}>{r.origin.barrio}</Typography>
                <ArrowForward sx={{ fontSize: 13, color: '#B8C0C9' }} />
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
        <InfoOutlined sx={{ fontSize: 15, color: '#8A939E', mt: 0.2 }} />
        <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>
          Una solicitud se confirma cuando se acuerdan las condiciones y se registra la seña.
        </Typography>
      </Stack>
    </AppShell>
  )
}