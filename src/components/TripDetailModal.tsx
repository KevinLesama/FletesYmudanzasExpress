import { useRef } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  ArrowForward,
  Check,
  Close,
  Map,
  MyLocation,
  PhotoCamera,
  ReceiptLong,
  WarningAmber,
} from '@mui/icons-material'
import { StatusChip } from './StatusChip'
import { TrackingAside, TrackingHero, StatusStepper, UpdatesTimeline, buildUpdates, stageIndex, updatedAt } from './TripTracking'
import { ars, fmtDateEs, waLink } from '../format'
import { WhatsAppIcon } from './WhatsAppIcon'
import { brand } from '../theme'
import { color, type } from '../design/tokens'
import type { ShiftRequest, TripIncident } from '../types'

function tren(t: ShiftRequest, onMarkLlegada: () => void, onMarkFin: () => void) {
  if (t.finishedAt) return null
  if (t.arrivedAt) {
    return (
      <Button variant="contained" startIcon={<Check />} onClick={onMarkFin}>
        Marcar fin de viaje
      </Button>
    )
  }
  return (
    <Button variant="contained" startIcon={<MyLocation />} onClick={onMarkLlegada}>
      Marcar llegada al destino
    </Button>
  )
}

export function TripDetailModal({
  trip,
  driverName,
  vehicleName,
  role,
  onClose,
  onOpenPlan,
  earnings,
  onMarkLlegada,
  onMarkFin,
  onAddIncident,
  onRemito,
  onRemoveRemito,
  onReport,
}: {
  trip: ShiftRequest
  driverName?: string
  vehicleName?: string
  role: 'admin' | 'chofer'
  onClose: () => void
  onOpenPlan?: () => void
  earnings?: { lines: { label: string; value: number }[]; total: number }
  onMarkLlegada?: () => void
  onMarkFin?: () => void
  onAddIncident?: (inc: TripIncident) => void
  onRemito?: (file: File) => void
  onRemoveRemito?: () => void
  onReport?: () => void
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const fileRef = useRef<HTMLInputElement>(null)

  const mapPoint = (place: typeof trip.origin) =>
    place.lat != null && place.lng != null
      ? `${place.lat},${place.lng}`
      : `${place.address}, ${place.barrio}`
  const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    mapPoint(trip.origin),
  )}&destination=${encodeURIComponent(mapPoint(trip.destination))}`

  const wa = waLink(
    trip.phone,
    `Hola ${trip.client}, te escribimos por tu viaje ${trip.id} del ${fmtDateEs(trip.date)} · servicio ${trip.serviceRange.join(' a ')}.`,
  )

  const stage = stageIndex(trip)
  const updates = buildUpdates(trip, driverName, vehicleName)

  const barAction =
    role === 'chofer'
      ? !isMobile && onMarkLlegada && onMarkFin
        ? tren(trip, onMarkLlegada, onMarkFin)
        : null
      : onOpenPlan
        ? (
            <Button variant="contained" endIcon={<ArrowForward />} onClick={onOpenPlan}>
              Abrir planificación
            </Button>
          )
        : null

  return (
    <Dialog open onClose={onClose} fullScreen={isMobile} maxWidth="md" fullWidth aria-labelledby="trip-modal-title">
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ px: { xs: 2.5, md: 3 }, pt: { xs: 2, md: 2.5 }, pb: 1, flexWrap: 'wrap', rowGap: 1 }}
        >
          <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: '0.04em', color: color.muted }}>
            {trip.id}
          </Typography>
          <StatusChip label={trip.status} />
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: type.micro, color: color.muted }}>
            {trip.client} · {trip.phone}
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title="Abrir ruta en Google Maps">
            <IconButton component="a" href={gmaps} target="_blank" rel="noreferrer" aria-label="Abrir ruta en Google Maps" size="small">
              <Map fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="WhatsApp con el cliente">
            <IconButton component="a" href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp con el cliente" size="small" sx={{ color: color.green }}>
              <WhatsAppIcon size={18} />
            </IconButton>
          </Tooltip>
          {role === 'chofer' && (
            <Tooltip title={trip.remitoPhoto ? 'Cambiar foto del remito' : 'Subir foto del remito'}>
              <IconButton onClick={() => fileRef.current?.click()} aria-label="Foto del remito" size="small">
                <PhotoCamera fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {role === 'chofer' && (
            <Tooltip title="Reportar incidente">
              <IconButton onClick={onReport} aria-label="Reportar incidente" size="small">
                <WarningAmber fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={onClose} aria-label="Cerrar">
            <Close fontSize="small" />
          </IconButton>
        </Stack>

        <DialogContent sx={{ px: { xs: 2.5, md: 3 }, py: 1.5 }}>
          <TrackingHero trip={trip} />
          <StatusStepper stage={stage} cancelled={trip.status === 'Cancelada'} />

          <Divider sx={{ my: { xs: 2, md: 2.5 }, borderColor: color.borderSoft }} />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.1fr) minmax(0, 1fr)' },
              gap: { xs: 2.5, md: 3 },
              alignItems: 'start',
            }}
          >
            <UpdatesTimeline updates={updates} onRemoveRemito={role === 'chofer' ? onRemoveRemito : undefined} />

            <TrackingAside
              trip={trip}
              driverName={driverName}
              vehicleName={vehicleName}
            >
              {role === 'chofer' && earnings && (
                <Box sx={{ border: `1px solid ${color.border}`, borderRadius: 3, bgcolor: color.sand, p: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.2 }}>
                    <ReceiptLong sx={{ fontSize: 16, color: brand.navy }} />
                    <Typography sx={{ fontSize: type.caption, fontWeight: 800, color: color.navy, flexGrow: 1 }}>
                      Cálculo del viaje
                    </Typography>
                    <Typography sx={{ fontSize: type.micro, color: color.muted }}>mi configuración</Typography>
                  </Stack>
                  <Stack spacing={0.7}>
                    {earnings.lines.map((line) => (
                      <Stack key={line.label} direction="row" alignItems="center" justifyContent="space-between">
                        <Typography sx={{ fontSize: type.caption, color: color.ink }}>{line.label}</Typography>
                        <Typography sx={{ fontSize: type.caption, fontWeight: 700, color: color.inkStrong }}>{ars(line.value)}</Typography>
                      </Stack>
                    ))}
                    <Divider sx={{ borderColor: color.border, my: 0.5 }} />
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: color.navy }}>Total del viaje</Typography>
                      <Typography sx={{ fontSize: 16, fontWeight: 800, color: color.navy }}>{ars(earnings.total)}</Typography>
                    </Stack>
                  </Stack>
                </Box>
              )}
            </TrackingAside>
          </Box>
        </DialogContent>

        <DialogActions
          sx={{
            px: { xs: 2.5, md: 3 },
            py: 2,
            borderTop: `1px solid ${color.borderSoft}`,
            justifyContent: { xs: 'flex-end', sm: 'space-between' },
            alignItems: 'center',
          }}
        >
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: type.micro, color: color.muted }}>
            Actualizado {updatedAt(trip)}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button onClick={onClose} sx={{ color: color.ink }}>
              Cerrar
            </Button>
            {barAction}
          </Stack>
        </DialogActions>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              onRemito?.(file)
              event.target.value = ''
            }
          }}
        />
      </Box>
    </Dialog>
  )
}
