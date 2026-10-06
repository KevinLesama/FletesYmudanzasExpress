import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
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
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Check, ChevronLeft, ChevronRight, Close, WarningAmber } from '@mui/icons-material'
import { ChoferShell } from '../components/ChoferShell'
import { StatusChip } from '../components/StatusChip'
import { AgendaGrid } from '../components/AgendaGrid'
import { TripDetailModal } from '../components/TripDetailModal'
import { DRIVERS, REQUESTS, vehicleById, tripEarnings } from '../mockData'
import { loadChoferConfig } from '../choferConfig'
import { DEMO_DATE, fmtLong } from '../format'
import { brand } from '../theme'
import type { ShiftRequest } from '../types'

const DEMO_DRIVER_ID = 'JA'

const nowTime = () => new Date().toTimeString().slice(0, 5)

function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + delta)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function ChoferPage() {
  const driver = DRIVERS.find((d) => d.id === DEMO_DRIVER_ID)!
  const cfg = loadChoferConfig(DEMO_DRIVER_ID)
  const driverWithCfg = { ...driver, ...cfg }

  const [date, setDate] = useState(DEMO_DATE)
  const [trips, setTrips] = useState<ShiftRequest[]>(() =>
    REQUESTS.filter((r) => r.driverId === DEMO_DRIVER_ID).map((r) => ({
      ...r,
      incidents: r.incidents ? [...r.incidents] : [],
    })),
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [incidentOpen, setIncidentOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const dayTrips = useMemo(() => trips.filter((t) => t.date === date), [trips, date])
  const selected = trips.find((t) => t.id === selectedId) ?? null

  const updateTrip = (id: string, patch: Partial<ShiftRequest>) =>
    setTrips((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const markLlegada = (t: ShiftRequest) => {
    updateTrip(t.id, { arrivedAt: `2026-09-24T${nowTime()}` })
    setToast('Llegada marcada · por tu cuenta')
  }

  const markFin = (t: ShiftRequest) => {
    updateTrip(t.id, { finishedAt: `2026-09-24T${nowTime()}` })
    setToast('Viaje finalizado · buen servicio')
  }

  const saveRemito = (t: ShiftRequest, file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      updateTrip(t.id, { remitoPhoto: { name: file.name, dataUrl: String(reader.result) } })
      setToast('Remito cargado (demo, sin guardado)')
    }
    reader.readAsDataURL(file)
  }

  const removeRemito = (t: ShiftRequest) => {
    updateTrip(t.id, { remitoPhoto: undefined })
    setToast('Remito quitado')
  }

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
          <Chip label={fmtLong(date)} sx={{ fontWeight: 700, bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', ml: 0.5 }} />
        </Stack>

        {dayTrips.length === 0 ? (
          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, py: 8, textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 700 }}>Sin viajes asignados para esta fecha</Typography>
            <Typography sx={{ fontSize: 14, color: '#8A939E', mt: 0.5 }}>
              Cuando la administración te asigne un servicio en este día, va a aparecer acá.
            </Typography>
          </Box>
        ) : (
          <AgendaGrid trips={dayTrips} onOpenTrip={(t) => setSelectedId(t.id)} />
        )}
      </ChoferShell>

      {selected && (
        <TripDetailModal
          trip={selected}
          role="chofer"
          driverName={driver.name}
          vehicleName={selected.vehicleId ? `${selected.vehicleId} · ${vehicleById(selected.vehicleId)?.type}` : undefined}
          onClose={() => setSelectedId(null)}
          earnings={tripEarnings(driverWithCfg, selected.estimatedKm ?? 0, selected.estimatedHours ?? 0)}
          onMarkLlegada={() => markLlegada(selected)}
          onMarkFin={() => markFin(selected)}
          onAddIncident={(inc) => updateTrip(selected.id, { incidents: [...(selected.incidents ?? []), inc] })}
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
            updateTrip(selected.id, {
              incidents: [
                ...(selected.incidents ?? []),
                { id: `INC-${Math.floor(1000 + Math.random() * 8999)}`, type, description, time: `2026-09-24T${nowTime()}` },
              ],
            })
            setIncidentOpen(false)
            setToast('Incidente reportado')
          }}
        />
      )}

      <Snackbar open={!!toast} autoHideDuration={3200} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert variant="filled" sx={{ bgcolor: brand.navy }} onClose={() => setToast(null)}>
          {toast}
        </Alert>
      </Snackbar>
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
            <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>Queda registrado en el viaje para la administración.</Typography>
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