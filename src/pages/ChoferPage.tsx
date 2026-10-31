import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Check, ChevronLeft, ChevronRight, Close, WarningAmber } from '@mui/icons-material'
import { ChoferShell } from '../components/ChoferShell'
import { StatusChip } from '../components/StatusChip'
import { AgendaGrid } from '../components/AgendaGrid'
import { TripDetailModal } from '../components/TripDetailModal'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { Toast, type ToastState } from '../components/Toast'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { DEMO_DATE, fmtLong } from '../format'
import { currentUser } from '../supabase'
import type { Driver, ShiftRequest } from '../types'

const nowTime = () => new Date().toTimeString().slice(0, 5)

const nowLocal = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + delta)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/**
 * Desglose del viaje con las tarifas que quedaron guardadas al cotizarlo.
 * El total es el que calculó el backend (costo_chofer); las lineas solo
 * muestran de donde sale ese numero.
 */
function earningsFromTrip(trip: ShiftRequest) {
  const tariffs = trip.tariffs
  const kmTotal = trip.totalKm ?? 0
  const hours = trip.estimatedHours ?? 0
  const lines = [
    { label: 'Tarifa base', value: tariffs?.base ?? 0 },
    { label: `Kilometraje (${kmTotal} km)`, value: Math.round(kmTotal * (tariffs?.perKm ?? 0)) },
    { label: `Tiempo (${hours.toString().replace('.', ',')} h)`, value: Math.round(hours * (tariffs?.perHour ?? 0)) },
  ]
  return { lines, total: trip.driverCost ?? 0 }
}

export function ChoferPage() {
  const user = currentUser()
  const [date, setDate] = useState(DEMO_DATE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [incidentOpen, setIncidentOpen] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)

  const driversState = useAsync(() => api.listDrivers(), [])
  const drivers: Driver[] = driversState.data ?? []
  const driver = drivers.find((d) => user?.email && d.email.toLowerCase() === user.email.toLowerCase())
  const tripsState = useAsync(
    () => (driver ? api.listRequests({ driver_id: driver.id }) : Promise.resolve([] as ShiftRequest[])),
    [driver?.id],
  )
  const trips: ShiftRequest[] = tripsState.data ?? []
  const vehicles = useAsync(() => api.listVehicles(), [])

  const dayTrips = useMemo(() => trips.filter((t) => t.date === date), [trips, date])
  const selected = trips.find((t) => t.id === selectedId) ?? null
  const selectedVehicleName = selected?.vehicleId
    ? `${selected.vehicleId} · ${(vehicles.data ?? []).find((v) => v.id === selected.vehicleId)?.type ?? ''}`
    : undefined

  const runAction = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await fn()
      await tripsState.reload()
      setToast({ message, tone: 'success' })
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'No pudimos completar la operación.', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const markLlegada = (t: ShiftRequest) => runAction(() => api.markArrived(t.id, nowLocal()), 'Llegada marcada · por tu cuenta')
  const markFin = (t: ShiftRequest) => runAction(() => api.markFinished(t.id, nowLocal()), 'Viaje finalizado · buen servicio')

  const saveRemito = (t: ShiftRequest, file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      runAction(() => api.setRemito(t.id, { name: file.name, dataUrl: String(reader.result) }), 'Remito cargado')
    }
    reader.readAsDataURL(file)
  }

  const removeRemito = (t: ShiftRequest) => runAction(() => api.deleteRemito(t.id), 'Remito quitado')

  return (
    <>
      <ChoferShell
        active="viajes"
        breadcrumb={['Chofer', 'Agenda']}
        title="Agenda de viajes"
        description={fmtLong(date)}
        action={<StatusChip label={trips.some((t) => t.finishedAt) ? 'Finalizado' : 'En destino'} />}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <IconButton size="small" onClick={() => setDate(shiftDate(date, -1))} aria-label="Día anterior">
            <ChevronLeft fontSize="small" />
          </IconButton>
          <Button size="small" onClick={() => setDate(DEMO_DATE)} sx={{ fontSize: 12.5 }}>
            Hoy
          </Button>
          <IconButton size="small" onClick={() => setDate(shiftDate(date, 1))} aria-label="Día siguiente">
            <ChevronRight fontSize="small" />
          </IconButton>
        </Stack>

        {tripsState.loading ? (
          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
            <LoadingState label="Cargando viajes..." />
          </Box>
        ) : tripsState.error ? (
          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
            <ErrorState message={tripsState.error} onRetry={tripsState.reload} />
          </Box>
        ) : dayTrips.length === 0 ? (
          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
            <EmptyState
              title="Sin viajes asignados para esta fecha"
              subtext="Cuando la administración te asigne un servicio en este día, va a aparecer acá."
            />
          </Box>
        ) : (
          <AgendaGrid days={[date]} trips={dayTrips} today={DEMO_DATE} onOpenTrip={(t) => setSelectedId(t.id)} />
        )}
      </ChoferShell>

      {selected && (
        <TripDetailModal
          trip={selected}
          role="chofer"
          driverName={driver?.name}
          vehicleName={selectedVehicleName}
          onClose={() => setSelectedId(null)}
          earnings={selected ? earningsFromTrip(selected) : undefined}
          onMarkLlegada={() => markLlegada(selected)}
          onMarkFin={() => markFin(selected)}
          onAddIncident={(inc) => runAction(() => api.addIncident(selected.id, inc), 'Incidente reportado')}
          onRemito={(file) => saveRemito(selected, file)}
          onRemoveRemito={() => removeRemito(selected)}
          onReport={() => setIncidentOpen(true)}
        />
      )}

      {selected && (
        <IncidentDialog
          open={incidentOpen}
          onClose={() => setIncidentOpen(false)}
          onSave={(type, description) => {
            setIncidentOpen(false)
            runAction(() => api.addIncident(selected.id, { type, description, time: nowLocal() }), 'Incidente reportado')
          }}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}

function IncidentDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (type: string, description: string) => void
}) {
  const [type, setType] = useState('Demora')
  const [description, setDescription] = useState('')
  const canSave = description.trim() !== ''

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ px: 3, pt: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: '#FFF3EF', color: '#9C493A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WarningAmber sx={{ fontSize: 17 }} />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontSize: 17, fontFamily: "'Manrope', sans-serif", fontWeight: 800 }}>Reportar incidente</Typography>
            <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>Queda registrado en el viaje para la administración.</Typography>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="Cerrar">
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 2 }}>
        <Stack spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel>Tipo</InputLabel>
            <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
              <MenuItem value="Demora">Demora</MenuItem>
              <MenuItem value="Tránsito">Problema de tránsito</MenuItem>
              <MenuItem value="Acceso">Dificultad de acceso</MenuItem>
              <MenuItem value="Daño">Daño o susto en la carga</MenuItem>
              <MenuItem value="Otro">Otro</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            size="small"
            placeholder="Contá qué pasó durante el viaje."
            InputProps={{
              startAdornment: <InputAdornment position="start" />,
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Button onClick={onClose} sx={{ color: '#5C6B7A' }}>
          Cancelar
        </Button>
        <Button variant="contained" startIcon={<Check />} disabled={!canSave} onClick={() => onSave(type, description)}>
          Registrar
        </Button>
      </DialogActions>
    </Dialog>
  )
}