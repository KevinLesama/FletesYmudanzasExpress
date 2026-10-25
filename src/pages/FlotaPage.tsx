import { useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
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
import { Add, Check, Close, Edit, InfoOutlined, LocalShipping, Person } from '@mui/icons-material'
import { AppShell } from '../components/AppShell'
import { ErrorState, LoadingState } from '../components/EmptyState'
import { StatusChip } from '../components/StatusChip'
import { Toast, type ToastState } from '../components/Toast'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { ars } from '../format'
import { brand } from '../theme'
import type { Driver, DriverStatus, Vehicle, VehicleStatus } from '../types'

type DialogState =
  | { mode: 'driver'; data: Driver | null }
  | { mode: 'vehicle'; data: Vehicle | null }
  | null

export function FlotaPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [tab, setTab] = useState(0)
  const fleet = useAsync(async () => {
    const [drivers, vehicles] = await Promise.all([api.listDrivers(), api.listVehicles()])
    return { drivers, vehicles }
  }, [])
  const drivers: Driver[] = fleet.data?.drivers ?? []
  const vehicles: Vehicle[] = fleet.data?.vehicles ?? []
  const [dialog, setDialog] = useState<DialogState>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const activeVehicles = vehicles.filter((v) => v.status === 'Disponible').length
  const assignedVehicles = vehicles.filter((v) => v.status === 'Asignado').length
  const workshopVehicles = vehicles.filter((v) => v.status === 'En taller').length
  const activeDrivers = drivers.filter((d) => d.status === 'Activo').length

  const openAdd = () => setDialog({ mode: tab === 0 ? 'driver' : 'vehicle', data: null })
  const openEdit = (mode: 'driver' | 'vehicle', data: Driver | Vehicle) => setDialog({ mode, data: data as any })

  if (fleet.loading) {
    return (
      <AppShell active="flota" breadcrumb={['Operación', 'Choferes y vehículos']} title="Flota">
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
          <LoadingState label="Cargando flota..." />
        </Box>
      </AppShell>
    )
  }

  if (fleet.error) {
    return (
      <AppShell active="flota" breadcrumb={['Operación', 'Choferes y vehículos']} title="Flota">
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
          <ErrorState message={fleet.error} onRetry={fleet.reload} />
        </Box>
      </AppShell>
    )
  }

  return (
    <>
      <AppShell
        active="flota"
        breadcrumb={['Operación', 'Choferes y vehículos']}
        kicker="Operación"
        title="Flota"
        description={
          tab === 0
            ? `${drivers.length} choferes registrados · ${activeDrivers} activos`
            : `${vehicles.length} vehículos registrados · ${activeVehicles} disponibles · ${assignedVehicles} asignado · ${workshopVehicles} en taller`
        }
        action={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={openAdd}
            sx={{ bgcolor: brand.orangeStrong, '&:hover': { bgcolor: brand.orangeInk } }}
          >
            {tab === 0 ? 'Agregar chofer' : 'Agregar vehículo'}
          </Button>
        }
      >
        <Box sx={{ mb: 2.5, p: 1.6, borderRadius: 2, bgcolor: '#EEF2FA', border: '1px solid #D9E2EE', color: '#526B8A' }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <InfoOutlined sx={{ fontSize: 16, mt: 0.2 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
              El vehículo se elige para cada viaje; no está asignado de forma fija al chofer.
            </Typography>
          </Stack>
        </Box>

        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, overflow: 'hidden' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ px: 2, borderBottom: '1px solid #EDEAE3', '& .MuiTab-root': { py: 1.6 } }}
          >
            <Tab label={`Choferes (${drivers.length})`} />
            <Tab label={`Vehículos (${vehicles.length})`} />
          </Tabs>

          {tab === 0 &&
            (isMobile ? (
              <Stack spacing={1.5} sx={{ p: 2 }}>
                {drivers.map((d) => (
                  <Box key={d.id} sx={{ border: '1px solid #EDEAE3', borderRadius: 2.5, p: 1.8 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ width: 38, height: 38, bgcolor: '#E9EDF1', color: brand.navy, fontWeight: 800, fontSize: 13 }}>
                        {d.initials}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{d.name}</Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>{d.phone}</Typography>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: brand.navy, mt: 0.25 }}>
                          Tarifa base · {ars(d.baseRate)} / viaje
                        </Typography>
                      </Box>
                      <StatusChip label={d.status} />
                    </Stack>
                    <Button size="small" fullWidth variant="outlined" sx={{ mt: 1.5, color: brand.navy, borderColor: '#D9D4C9' }} onClick={() => openEdit('driver', d)}>
                      Editar
                    </Button>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Chofer</TableCell>
                    <TableCell>Teléfono</TableCell>
                    <TableCell>Tarifa base</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {drivers.map((d) => (
                    <TableRow key={d.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar sx={{ width: 34, height: 34, bgcolor: '#E9EDF1', color: brand.navy, fontWeight: 800, fontSize: 12 }}>
                            {d.initials}
                          </Avatar>
                          <Typography sx={{ fontWeight: 700 }}>{d.name}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{d.phone}</TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 800, color: brand.navy }}>{ars(d.baseRate)}</Typography>
                        <Typography sx={{ fontSize: 12, color: '#64707C' }}>por viaje</Typography>
                      </TableCell>
                      <TableCell><StatusChip label={d.status} /></TableCell>
                      <TableCell align="right">
                        <Button size="small" startIcon={<Edit sx={{ fontSize: 15 }} />} onClick={() => openEdit('driver', d)} sx={{ color: brand.navy }}>
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}

          {tab === 1 &&
            (isMobile ? (
              <Stack spacing={1.5} sx={{ p: 2 }}>
                {vehicles.map((v) => (
                  <Box key={v.id} sx={{ border: '1px solid #EDEAE3', borderRadius: 2.5, p: 1.8 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: '#F0F2F5', color: brand.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LocalShipping sx={{ fontSize: 19 }} />
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{v.id}</Typography>
                          <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>{v.type}</Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 12, color: '#64707C' }}>Capacidad registrada · {v.capacityKg} kg</Typography>
                      </Box>
                      <StatusChip label={v.status} />
                    </Stack>
                    {v.status === 'Asignado' && (
                      <Typography sx={{ mt: 1, fontSize: 12, color: '#98621B', fontWeight: 600 }}>{v.assignedNote}</Typography>
                    )}
                    <Button size="small" fullWidth variant="outlined" sx={{ mt: 1.5, color: brand.navy, borderColor: '#D9D4C9' }} onClick={() => openEdit('vehicle', v)}>
                      Editar
                    </Button>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Identificador</TableCell>
                    <TableCell>Vehículo</TableCell>
                    <TableCell>Capacidad</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vehicles.map((v) => (
                    <TableRow key={v.id} hover>
                      <TableCell sx={{ fontWeight: 800, color: brand.navy }}>{v.id}</TableCell>
                      <TableCell>{v.type}</TableCell>
                      <TableCell>{v.capacityKg} kg</TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <StatusChip label={v.status} />
                          {v.status === 'Asignado' && <Typography sx={{ fontSize: 12, color: '#64707C' }}>{v.assignedNote}</Typography>}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" startIcon={<Edit sx={{ fontSize: 15 }} />} onClick={() => openEdit('vehicle', v)} sx={{ color: brand.navy }}>
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}
        </Box>
      </AppShell>

      {dialog && (
        <RecordDialog
          state={dialog}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            setDialog(null)
            setToast({ message, tone: 'success' })
            fleet.reload()
          }}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}

function RecordDialog({
  state,
  onClose,
  onSaved,
}: {
  state: NonNullable<DialogState>
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const isDriver = state.mode === 'driver'
  const initialD = (state.data as Driver) ?? null
  const initialV = (state.data as Vehicle) ?? null

  const [id, setId] = useState(initialD ? initialD.id : initialV ? initialV.id : '')
  const [name, setName] = useState(initialD?.name ?? '')
  const [phone, setPhone] = useState(initialD?.phone ?? '')
  const [type, setType] = useState(initialV?.type ?? '')
  const [capacity, setCapacity] = useState(initialV ? String(initialV.capacityKg) : '')
  const [driverStatus, setDriverStatus] = useState<DriverStatus>(initialD?.status ?? 'Activo')
  const [vehicleStatus, setVehicleStatus] = useState<VehicleStatus>(initialV?.status ?? 'Disponible')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const editing = !!state.data
  const canSave = isDriver ? name.trim() !== '' && phone.trim() !== '' : id.trim() !== '' && type.trim() !== '' && Number(capacity) > 0

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      if (isDriver) {
        if (editing) {
          await api.updateDriver(initialD!.id, { name, phone, status: driverStatus })
        } else {
          await api.createDriver({ name, phone, status: driverStatus })
        }
        onSaved('Cambios guardados')
      } else {
        if (editing) {
          await api.updateVehicle(initialV!.id, {
            id,
            type,
            capacity_kg: Number(capacity),
            status: vehicleStatus,
            assigned_note: vehicleStatus === 'Asignado' ? initialV?.assignedNote ?? null : null,
          })
        } else {
          await api.createVehicle({
            id,
            type,
            capacity_kg: Number(capacity),
            status: vehicleStatus,
            assigned_note: null,
          })
        }
        onSaved('Vehículo guardado')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" fullScreen={false}>
      <DialogTitle sx={{ px: 3, pt: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: '#EEF2FA', color: brand.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isDriver ? <Person sx={{ fontSize: 18 }} /> : <LocalShipping sx={{ fontSize: 18 }} />}
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontSize: 17, fontFamily: "'Manrope', sans-serif", fontWeight: 800 }}>
              {editing ? 'Editar' : isDriver ? 'Agregar chofer' : 'Agregar vehículo'}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>
              {isDriver ? 'Completá los datos del chofer.' : 'Completá los datos del vehículo.'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="Cerrar">
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 2.5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {isDriver ? (
          <Stack spacing={2}>
            <TextField label="Nombre y apellido" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" placeholder="Nombre completo" />
            <TextField label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth size="small" placeholder="11 5555-0000" />
            <FormControl size="small" fullWidth>
              <InputLabel>Estado</InputLabel>
              <Select label="Estado" value={driverStatus} onChange={(e) => setDriverStatus(e.target.value as DriverStatus)}>
                <MenuItem value="Activo">Activo</MenuItem>
                <MenuItem value="Inactivo">Inactivo</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <TextField label="Identificador" value={id} onChange={(e) => setId(e.target.value)} fullWidth size="small" placeholder="MOV-08" />
            <TextField label="Tipo de vehículo" value={type} onChange={(e) => setType(e.target.value)} fullWidth size="small" placeholder="Furgón grande" />
            <TextField
              label="Capacidad registrada (kg)"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value.replace(/[^\d]/g, ''))}
              fullWidth
              size="small"
              InputProps={{ endAdornment: <InputAdornment position="end">kg</InputAdornment> }}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Estado</InputLabel>
              <Select label="Estado" value={vehicleStatus} onChange={(e) => setVehicleStatus(e.target.value as VehicleStatus)}>
                <MenuItem value="Disponible">Disponible</MenuItem>
                <MenuItem value="Asignado">Asignado</MenuItem>
                <MenuItem value="En taller">En taller</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Button onClick={onClose} sx={{ color: '#5C6B7A' }}>Cancelar</Button>
        <Button variant="contained" startIcon={<Check />} disabled={!canSave || saving} onClick={save}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}