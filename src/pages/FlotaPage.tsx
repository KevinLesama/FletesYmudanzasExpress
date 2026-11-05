import { useRef, useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { Add, Block, Check, Close, Edit, InfoOutlined, LocalShipping, Person, Undo } from '@mui/icons-material'
import { AppShell, SECCION_BREADCRUMB } from '../components/AppShell'
import { ErrorState, LoadingState } from '../components/EmptyState'
import { CampoSelect, CampoTexto } from '../components/FormFields'
import { StatusChip } from '../components/StatusChip'
import { SegmentedControl } from '../components/SegmentedControl'
import { TablePaginationFooter } from '../components/TablePaginationFooter'
import { Toast, type ToastState } from '../components/Toast'
import { MobileCard } from '../components/mobile/MobileCard'
import { MOBILE_SAFE_BOTTOM, MOBILE_SAFE_TOP, wrapAnywhere } from '../components/mobile/mobileSx'
import { filtrarTelefono, validarTelefono } from '../utils/telefono'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { usePagedList } from '../usePagedList'
import { ars } from '../format'
import { brand } from '../theme'
import { color } from '../design/tokens'
import type { Driver, DriverStatus, Vehicle, VehicleStatus } from '../types'

const FLEET_PAGE_SIZE = 10

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
  // La baja es logica (usuarios.activo = false): el DELETE no existe. El chofer
  // dado de baja sale de la lista, pero sigue en la base con su historial.
  const [showInactive, setShowInactive] = useState(false)
  const [pendingBaja, setPendingBaja] = useState<Driver | null>(null)
  const [savingActive, setSavingActive] = useState(false)

  const activeVehicles = vehicles.filter((v) => v.status === 'Disponible').length
  const assignedVehicles = vehicles.filter((v) => v.status === 'Asignado').length
  const workshopVehicles = vehicles.filter((v) => v.status === 'En taller').length
  const activeDrivers = drivers.filter((d) => d.status === 'Activo').length
  const inactiveDrivers = drivers.filter((d) => d.status === 'Inactivo')
  const visibleDrivers = showInactive ? drivers : drivers.filter((d) => d.status !== 'Inactivo')

  // Cada solapa pagina por su cuenta, con el mismo tamaño de página.
  const driverPages = usePagedList(visibleDrivers, FLEET_PAGE_SIZE)
  const vehiclePages = usePagedList(vehicles, FLEET_PAGE_SIZE)

  const openAdd = () => setDialog({ mode: tab === 0 ? 'driver' : 'vehicle', data: null })
  const openEdit = (mode: 'driver' | 'vehicle', data: Driver | Vehicle) => setDialog({ mode, data: data as any })

  const setDriverActive = async (driver: Driver, activo: boolean) => {
    setSavingActive(true)
    try {
      await api.setDriverActive(driver.id, activo)
      setPendingBaja(null)
      setToast({
        message: activo ? `Chofer reactivado · ${driver.name}` : `Chofer dado de baja · ${driver.name}`,
        tone: 'success',
      })
      fleet.reload()
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'No pudimos actualizar al chofer.',
        tone: 'error',
      })
    } finally {
      setSavingActive(false)
    }
  }

  if (fleet.loading) {
    return (
      <AppShell active="flota" breadcrumb={[SECCION_BREADCRUMB, 'Choferes y vehículos']} title="Flota">
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
          <LoadingState label="Cargando flota..." />
        </Box>
      </AppShell>
    )
  }

  if (fleet.error) {
    return (
      <AppShell active="flota" breadcrumb={[SECCION_BREADCRUMB, 'Choferes y vehículos']} title="Flota">
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
        breadcrumb={[SECCION_BREADCRUMB, 'Choferes y vehículos']}
        kicker="Operación"
        title="Flota"
        description={
          tab === 0
            ? `${drivers.length} choferes registrados · ${activeDrivers} activos`
            : `${vehicles.length} vehículos registrados · ${activeVehicles} disponibles · ${assignedVehicles} asignado · ${workshopVehicles} en taller`
        }
        // The 2x2 metrics grid below repeats these counts on mobile.
        descriptionVisibleOnMobile={false}
        action={
          !isMobile && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={openAdd}
              sx={{ bgcolor: brand.orangeStrong, '&:hover': { bgcolor: brand.orangeInk } }}
            >
              {tab === 0 ? 'Agregar chofer' : 'Agregar vehículo'}
            </Button>
          )
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
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #EDEAE3' }}>
            <SegmentedControl
              value={tab}
              onChange={setTab}
              ariaLabel="Choferes y vehículos"
              fullWidth={isMobile}
              options={[
                { value: 0, label: `Choferes (${drivers.length})` },
                { value: 1, label: `Vehículos (${vehicles.length})` },
              ]}
            />
          </Box>

          {/* Mobile: same counts as the header lead, laid out as a 2x2 grid. */}
          {isMobile && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1.25,
                px: 2,
                pt: 2,
              }}
            >
              {(tab === 0
                ? [
                    { label: 'Choferes', value: visibleDrivers.length },
                    { label: 'Activos', value: activeDrivers },
                  ]
                : [
                    { label: 'Vehículos', value: vehicles.length },
                    { label: 'Disponibles', value: activeVehicles },
                    { label: 'Asignados', value: assignedVehicles },
                    { label: 'En taller', value: workshopVehicles },
                  ]
              ).map((metric) => (
                <Box
                  key={metric.label}
                  sx={{
                    border: `1px solid ${color.border}`,
                    borderRadius: 2,
                    bgcolor: color.sand,
                    px: 1.5,
                    py: 1.25,
                  }}
                >
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: color.muted }}>
                    {metric.label}
                  </Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2, color: color.navy }}>
                    {metric.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {tab === 0 &&
            (isMobile ? (
              <Stack spacing={1.5} sx={{ p: 2 }}>
                {visibleDrivers.map((d) => (
                  <MobileCard
                    key={d.id}
                    header={
                      <>
                        <Avatar sx={{ width: 36, height: 36, bgcolor: color.sandDeep, color: brand.navy, fontWeight: 800, fontSize: 13 }}>
                          {d.initials}
                        </Avatar>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: color.navy, ...wrapAnywhere }}>
                            {d.name}
                          </Typography>
                        </Box>
                        <StatusChip label={d.status} />
                      </>
                    }
                    footer={
                      <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                        <Button
                          fullWidth
                          variant="outlined"
                          onClick={() => openEdit('driver', d)}
                          sx={{ color: brand.navy, borderColor: '#D9D4C9' }}
                        >
                          Editar
                        </Button>
                        {d.status === 'Inactivo' ? (
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<Undo sx={{ fontSize: 16 }} />}
                            onClick={() => void setDriverActive(d, true)}
                            sx={{ color: brand.navy, borderColor: '#D9D4C9' }}
                          >
                            Reactivar
                          </Button>
                        ) : (
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<Block sx={{ fontSize: 16 }} />}
                            onClick={() => setPendingBaja(d)}
                            sx={{ color: color.red, borderColor: color.red }}
                          >
                            Baja
                          </Button>
                        )}
                      </Stack>
                    }
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12.5, color: color.muted, ...wrapAnywhere }}>{d.phone}</Typography>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: brand.navy, mt: 0.25 }}>
                        Tarifa base · {ars(d.baseRate)} / viaje
                      </Typography>
                    </Box>
                  </MobileCard>
                ))}
              </Stack>
            ) : (
              <>
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
                  {driverPages.pageItems.map((d) => (
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
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button size="small" startIcon={<Edit sx={{ fontSize: 15 }} />} onClick={() => openEdit('driver', d)} sx={{ color: brand.navy }}>
                            Editar
                          </Button>
                          {d.status === 'Inactivo' ? (
                            <Button size="small" startIcon={<Undo sx={{ fontSize: 15 }} />} onClick={() => void setDriverActive(d, true)} sx={{ color: brand.navy }}>
                              Reactivar
                            </Button>
                          ) : (
                            <Button size="small" startIcon={<Block sx={{ fontSize: 15 }} />} onClick={() => setPendingBaja(d)} sx={{ color: color.red }}>
                              Dar de baja
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePaginationFooter
                page={driverPages.page}
                pageSize={FLEET_PAGE_SIZE}
                total={driverPages.total}
                itemLabel="choferes"
                onPageChange={driverPages.setPage}
              />
              {inactiveDrivers.length > 0 && (
                <Box sx={{ px: 2, py: 1, borderTop: '1px solid #EDEAE3', display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    onClick={() => setShowInactive((current) => !current)}
                    sx={{ color: '#5C6B7A', textTransform: 'none', fontWeight: 700 }}
                  >
                    {showInactive
                      ? 'Ocultar dados de baja'
                      : `Mostrar dados de baja (${inactiveDrivers.length})`}
                  </Button>
                </Box>
              )}
              </>
            ))}

          {tab === 1 &&
            (isMobile ? (
              <Stack spacing={1.5} sx={{ p: 2 }}>
                {vehicles.map((v) => (
                  <MobileCard
                    key={v.id}
                    header={
                      <>
                        <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: color.sandDeep, color: brand.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <LocalShipping sx={{ fontSize: 18 }} />
                        </Box>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3, color: color.navy, ...wrapAnywhere }}>
                            {v.id}
                          </Typography>
                          <Typography sx={{ fontSize: 12.5, color: color.muted, ...wrapAnywhere }}>{v.type}</Typography>
                        </Box>
                        <StatusChip label={v.status} />
                      </>
                    }
                    footer={
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => openEdit('vehicle', v)}
                        sx={{ color: brand.navy, borderColor: '#D9D4C9' }}
                      >
                        Editar
                      </Button>
                    }
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12.5, color: color.muted, ...wrapAnywhere }}>
                        Capacidad registrada · {v.capacityKg} kg
                      </Typography>
                      {v.status === 'Asignado' && (
                        <Typography sx={{ mt: 0.5, fontSize: 12, color: color.amberInk, fontWeight: 600, ...wrapAnywhere }}>
                          {v.assignedNote}
                        </Typography>
                      )}
                    </Box>
                  </MobileCard>
                ))}
              </Stack>
            ) : (
              <>
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
                  {vehiclePages.pageItems.map((v) => (
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
              <TablePaginationFooter
                page={vehiclePages.page}
                pageSize={FLEET_PAGE_SIZE}
                total={vehiclePages.total}
                itemLabel="vehículos"
                onPageChange={vehiclePages.setPage}
              />
              </>
            ))}
        </Box>
      </AppShell>

      <DeactivateDriverDialog
        driver={pendingBaja}
        saving={savingActive}
        onClose={() => setPendingBaja(null)}
        onConfirm={() => {
          if (pendingBaja) void setDriverActive(pendingBaja, false)
        }}
      />

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

function DeactivateDriverDialog({
  driver,
  saving,
  onClose,
  onConfirm,
}: {
  driver: Driver | null
  saving: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={!!driver} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ px: 3, pt: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: color.redSoft, color: color.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Block sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 17 }}>Dar de baja al chofer</Typography>
            <Typography sx={{ fontSize: 12.5, color: color.muted }}>{driver?.name}</Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={onClose} aria-label="Cerrar" disabled={saving}>
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 2 }}>
        <Typography sx={{ fontSize: 13.5, color: color.inkStrong }}>
          {driver?.name} deja de aparecer en la lista y no va a poder iniciar sesión.
          Sus viajes, sus tarifas y el historial se conservan.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: color.ink }}>
          Volver
        </Button>
        <Button
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Block />}
          sx={{ bgcolor: color.red, '&:hover': { bgcolor: color.red } }}
          onClick={onConfirm}
        >
          Sí, dar de baja
        </Button>
      </DialogActions>
    </Dialog>
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
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isDriver = state.mode === 'driver'
  const initialD = (state.data as Driver) ?? null
  const initialV = (state.data as Vehicle) ?? null

  const [id, setId] = useState(initialD ? initialD.id : initialV ? initialV.id : '')
  const [name, setName] = useState(initialD?.name ?? '')
  const [phone, setPhone] = useState(initialD?.phone ?? '')
  const [email, setEmail] = useState(initialD?.email ?? '')
  const [type, setType] = useState(initialV?.type ?? '')
  const [capacity, setCapacity] = useState(initialV ? String(initialV.capacityKg) : '')
  const [driverStatus, setDriverStatus] = useState<DriverStatus>(initialD?.status ?? 'Activo')
  const [vehicleStatus, setVehicleStatus] = useState<VehicleStatus>(initialV?.status ?? 'Disponible')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<'name' | 'phone' | 'email' | 'id' | 'type' | 'capacity', string>>({
    name: '',
    phone: '',
    email: '',
    id: '',
    type: '',
    capacity: '',
  })
  const fieldRefs = {
    name: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    id: useRef<HTMLInputElement>(null),
    type: useRef<HTMLInputElement>(null),
    capacity: useRef<HTMLInputElement>(null),
  }

  const editing = !!state.data
  const validateField = (field: keyof typeof fieldErrors, value: string) => {
    if (field === 'name' && !value.trim()) return 'Ingresá el nombre y apellido.'
    if (field === 'phone') {
      return validarTelefono(value) ?? ''
    }
    if (field === 'email') {
      if (!value.trim()) return 'Ingresá el correo.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'El formato del correo no es válido.'
    }
    if (field === 'id' && !value.trim()) return 'Ingresá el identificador.'
    if (field === 'type' && !value.trim()) return 'Ingresá el tipo de vehículo.'
    if (field === 'capacity' && !(Number(value) > 0)) return 'Ingresá una capacidad mayor a 0.'
    return ''
  }
  const clearFieldError = (field: keyof typeof fieldErrors) => {
    setFieldErrors((previous) => ({ ...previous, [field]: '' }))
  }
  const validateAndSetFieldError = (field: keyof typeof fieldErrors, value: string) => {
    setFieldErrors((previous) => ({ ...previous, [field]: validateField(field, value) }))
  }

  const save = async () => {
    const nextFieldErrors = {
      name: validateField('name', name),
      phone: validateField('phone', phone),
      email: validateField('email', email),
      id: validateField('id', id),
      type: validateField('type', type),
      capacity: validateField('capacity', capacity),
    }
    setFieldErrors(nextFieldErrors)
    const invalidFields = isDriver ? ['name', 'phone', 'email'] as const : ['id', 'type', 'capacity'] as const
    const firstInvalidField = invalidFields.find((field) => nextFieldErrors[field])
    if (firstInvalidField) {
      fieldRefs[firstInvalidField].current?.focus()
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (isDriver) {
        if (editing) {
          await api.updateDriver(initialD!.id, { name, phone: phone.trim(), email: email.trim(), status: driverStatus })
        } else {
          await api.createDriver({ name, phone: phone.trim(), email: email.trim(), status: driverStatus })
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
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" fullScreen={isMobile}>
      <DialogTitle sx={{ px: { xs: 2, md: 3 }, pt: { xs: `calc(24px + ${MOBILE_SAFE_TOP})`, md: 3 } }}>
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
      <DialogContent sx={{ px: { xs: 2, md: 3 } }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {isDriver ? (
          <Stack spacing={2}>
            <CampoTexto
              label="Nombre y apellido"
              value={name}
              onChange={(e) => { setName(e.target.value); clearFieldError('name') }}
              onBlur={() => validateAndSetFieldError('name', name)}
              inputRef={fieldRefs.name}
              error={!!fieldErrors.name}
              mensaje={fieldErrors.name}
              fullWidth
              size="small"
              placeholder="Nombre completo"
              autoComplete="off"
            />
            <CampoTexto
              label="Teléfono"
              value={phone}
              onChange={(e) => {
                setPhone(filtrarTelefono(e.target.value))
                clearFieldError('phone')
              }}
              onBlur={() => validateAndSetFieldError('phone', phone)}
              inputRef={fieldRefs.phone}
              error={!!fieldErrors.phone}
              mensaje={fieldErrors.phone}
              fullWidth
              size="small"
              placeholder="11 5555-0000"
              inputProps={{ maxLength: 20, inputMode: 'tel' }}
              autoComplete="off"
            />
            <CampoTexto
              label="Email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearFieldError('email') }}
              onBlur={() => validateAndSetFieldError('email', email)}
              inputRef={fieldRefs.email}
              error={!!fieldErrors.email}
              mensaje={fieldErrors.email}
              fullWidth
              size="small"
              placeholder="chofer@ejemplo.com"
              autoComplete="off"
            />
            <CampoSelect
              label="Estado"
              value={driverStatus}
              onChange={(e) => setDriverStatus(e.target.value as DriverStatus)}
              size="small"
            >
              <MenuItem value="Activo">Activo</MenuItem>
              <MenuItem value="Inactivo">Inactivo</MenuItem>
            </CampoSelect>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <CampoTexto
              label="Identificador"
              value={id}
              onChange={(e) => { setId(e.target.value); clearFieldError('id') }}
              onBlur={() => validateAndSetFieldError('id', id)}
              inputRef={fieldRefs.id}
              error={!!fieldErrors.id}
              mensaje={fieldErrors.id}
              fullWidth
              size="small"
              placeholder="MOV-08"
              autoComplete="off"
            />
            <CampoTexto
              label="Tipo de vehículo"
              value={type}
              onChange={(e) => { setType(e.target.value); clearFieldError('type') }}
              onBlur={() => validateAndSetFieldError('type', type)}
              inputRef={fieldRefs.type}
              error={!!fieldErrors.type}
              mensaje={fieldErrors.type}
              fullWidth
              size="small"
              placeholder="Furgón grande"
              autoComplete="off"
            />
            <CampoTexto
              label="Capacidad registrada (kg)"
              value={capacity}
              onChange={(e) => { setCapacity(e.target.value.replace(/[^\d]/g, '')); clearFieldError('capacity') }}
              onBlur={() => validateAndSetFieldError('capacity', capacity)}
              inputRef={fieldRefs.capacity}
              error={!!fieldErrors.capacity}
              mensaje={fieldErrors.capacity}
              fullWidth
              size="small"
              autoComplete="off"
              InputProps={{ endAdornment: <InputAdornment position="end">kg</InputAdornment> }}
            />
            <CampoSelect
              label="Estado"
              value={vehicleStatus}
              onChange={(e) => setVehicleStatus(e.target.value as VehicleStatus)}
              size="small"
            >
              <MenuItem value="Disponible">Disponible</MenuItem>
              <MenuItem value="Asignado">Asignado</MenuItem>
              <MenuItem value="En taller">En taller</MenuItem>
            </CampoSelect>
          </Stack>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: { xs: 2, md: 3 },
          pt: { xs: 1.5, md: 1 },
          // Mobile: pinned to the bottom edge of the full-screen dialog.
          pb: { xs: `calc(12px + ${MOBILE_SAFE_BOTTOM})`, md: 3 },
          justifyContent: 'space-between',
          bgcolor: { xs: color.paper, md: 'transparent' },
          borderTop: { xs: `1px solid ${color.border}`, md: 'none' },
        }}
      >
        <Button onClick={onClose} sx={{ color: '#5C6B7A' }}>Cancelar</Button>
        <Button variant="contained" startIcon={<Check />} disabled={saving} onClick={save}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
