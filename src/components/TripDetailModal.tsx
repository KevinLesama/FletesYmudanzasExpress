import { useRef } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  ArrowForward,
  Check,
  Close,
  Flag,
  ImageOutlined,
  LocalShipping,
  Map,
  MyLocation,
  Notes,
  PhotoCamera,
  ReceiptLong,
  Schedule,
  WarningAmber,
} from '@mui/icons-material'
import { StatusChip } from './StatusChip'
import { ars, fmtDateEs, waLink } from '../format'
import { WhatsAppIcon } from './WhatsAppIcon'
import { brand } from '../theme'
import type { ShiftRequest, TripIncident } from '../types'

function InfoPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Box sx={{ p: 1, px: 1.2, borderRadius: 999, bgcolor: '#F0F2F5', display: 'inline-flex', alignItems: 'center', gap: 0.8 }}>
      <Box sx={{ color: '#64707C', display: 'flex' }}>{icon}</Box>
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#33475F' }}>{text}</Typography>
    </Box>
  )
}

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

  const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    `${trip.origin.address}, ${trip.origin.barrio}`,
  )}&destination=${encodeURIComponent(`${trip.destination.address}, ${trip.destination.barrio}`)}`

  const wa = waLink(
    trip.phone,
    `Hola ${trip.client}, te escribimos por tu viaje ${trip.id} del ${fmtDateEs(trip.date)} · servicio ${trip.serviceRange.join(' a ')}.`,
  )

  return (
    <Dialog open onClose={onClose} fullScreen={isMobile} maxWidth="md" fullWidth>
      <DialogTitle sx={{ px: { xs: 2.5, md: 3 }, pt: { xs: 4, md: 3 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#EEF2FA', color: brand.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Flag sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 17 }}>{trip.id}</Typography>
              <StatusChip label={trip.status} />
            </Stack>
            <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>
              {trip.client} · {trip.phone}
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Cerrar">
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 2.5, md: 3 }, pt: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
            <Box sx={{ p: 1.8, borderRadius: 2.5, bgcolor: '#FBF9F6', border: '1px solid #EDEAE3', flexGrow: 1 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64707C', letterSpacing: '0.08em' }}>ORIGEN · {trip.origin.label}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mt: 0.3 }}>{trip.origin.address}</Typography>
              <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>
                {trip.origin.barrio} · {trip.origin.floor} {trip.origin.elevator ? '· con ascensor' : ''}
              </Typography>
            </Box>
            <Box sx={{ p: 1.8, borderRadius: 2.5, bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', flexGrow: 1 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: brand.orange, letterSpacing: '0.08em' }}>DESTINO · {trip.destination.label}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mt: 0.3 }}>{trip.destination.address}</Typography>
              <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>
                {trip.destination.barrio} · {trip.destination.floor} {trip.destination.elevator ? '· con ascensor' : ''}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            <InfoPill icon={<Schedule sx={{ fontSize: 14 }} />} text={`Llegada ${trip.arrivalRange.join('–')} · Servicio ${trip.serviceRange.join('–')}`} />
            {(driverName || vehicleName) && (
              <InfoPill icon={<LocalShipping sx={{ fontSize: 14 }} />} text={[vehicleName, driverName].filter(Boolean).join(' · ')} />
            )}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              component="a"
              href={gmaps}
              target="_blank"
              rel="noreferrer"
              variant="outlined"
              startIcon={<Map />}
              sx={{ color: brand.navy, borderColor: '#D9D4C9', justifyContent: 'center', flexGrow: 1 }}
            >
              Abrir ruta en Google Maps
            </Button>
            <Button
              component="a"
              href={wa}
              target="_blank"
              rel="noreferrer"
              variant="contained"
              startIcon={<WhatsAppIcon />}
              sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1EBE5A' }, justifyContent: 'center', flexGrow: 1 }}
            >
              WhatsApp con el cliente
            </Button>
          </Stack>

          {trip.cargo.notes && (
            <Box sx={{ p: 1.4, borderRadius: 2, bgcolor: '#F7F5F0', border: '1px solid #EDEAE3' }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Notes sx={{ fontSize: 15, color: '#64707C', mt: 0.2 }} />
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64707C' }}>NOTA DEL CLIENTE</Typography>
                  <Typography sx={{ fontSize: 13, mt: 0.3 }}>{trip.cargo.notes}</Typography>
                </Box>
              </Stack>
            </Box>
          )}

          {role === 'chofer' && (
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#5C6B7A', mb: 1 }}>ESTADO DEL SERVICIO</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {!trip.finishedAt && !trip.arrivedAt && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<MyLocation />}
                    onClick={onMarkLlegada}
                    sx={{ py: 1 }}
                  >
                    Marcar llegada al destino
                  </Button>
                )}
                {trip.arrivedAt && !trip.finishedAt && (
                  <Button variant="contained" size="small" startIcon={<Check />} onClick={onMarkFin} sx={{ py: 1 }}>
                    Marcar fin de viaje
                  </Button>
                )}
                {trip.finishedAt && (
                  <InfoPill icon={<Check sx={{ fontSize: 14, color: '#4E9A6C' }} />} text={`Viaje finalizado · ${trip.finishedAt.slice(11)}`} />
                )}
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
                {trip.remitoPhoto ? (
                  <Box sx={{ p: 1.4, borderRadius: 2.5, border: '1px solid #E9E6DF', bgcolor: '#FFFFFF', width: '100%', maxWidth: { sm: 260 } }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <PhotoCamera sx={{ fontSize: 15, color: '#4E9A6C' }} />
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {trip.remitoPhoto.name}
                      </Typography>
                      <Button size="small" sx={{ color: '#9C493A', minWidth: 0 }} onClick={onRemoveRemito}>
                        Quitar
                      </Button>
                    </Stack>
                    <Box
                      component="img"
                      src={trip.remitoPhoto.dataUrl}
                      alt="Foto del remito"
                      sx={{ width: '100%', borderRadius: 2, border: '1px solid #EDEAE3', maxHeight: 200, objectFit: 'contain', bgcolor: '#fff' }}
                    />
                  </Box>
                ) : (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ImageOutlined />}
                    onClick={() => fileRef.current?.click()}
                    sx={{ color: brand.navy, borderColor: '#D9D4C9', py: 1 }}
                  >
                    Subir foto del remito
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<WarningAmber />}
                  onClick={onReport}
                  sx={{ color: brand.navy, borderColor: '#D9D4C9', py: 1 }}
                >
                  Reportar incidente
                </Button>
              </Stack>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    onRemito?.(f)
                    e.target.value = ''
                  }
                }}
              />
            </Box>
          )}

          {role === 'chofer' && (trip.incidents?.length ?? 0) > 0 && (
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#5C6B7A', mb: 1 }}>INCIDENTES</Typography>
              <Stack spacing={1}>
                {(trip.incidents ?? []).map((inc) => (
                  <Box key={inc.id} sx={{ p: 1.3, borderRadius: 2, bgcolor: '#FFF3EF', border: '1px solid #F3DAD2' }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#9C493A' }}>{inc.type}</Typography>
                      <Box sx={{ flexGrow: 1 }} />
                      <Typography sx={{ fontSize: 11, color: '#9C493A' }}>{inc.time.slice(11)}</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 12.5, color: '#33475F', mt: 0.3 }}>{inc.description}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {role === 'chofer' && earnings && (
            <Box sx={{ p: 1.8, borderRadius: 2.5, bgcolor: '#FBF9F6', border: '1px solid #EDEAE3' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <ReceiptLong sx={{ fontSize: 16, color: brand.navy }} />
                <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 14 }}>Cálculo del viaje</Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Typography sx={{ fontSize: 11, color: '#64707C' }}>según mi configuración</Typography>
              </Stack>
              <Stack spacing={0.7}>
                {earnings.lines.map((l) => (
                  <Stack key={l.label} direction="row" alignItems="center" justifyContent="space-between">
                    <Typography sx={{ fontSize: 12.5, color: '#5C6B7A' }}>{l.label}</Typography>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#33475F' }}>{ars(l.value)}</Typography>
                  </Stack>
                ))}
                <Divider sx={{ borderColor: '#E3DFD5', mt: 0.5 }} />
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: brand.navy }}>Total del viaje</Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, color: brand.navy }}>{ars(earnings.total)}</Typography>
                </Stack>
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2.5, md: 3 }, pb: 3, justifyContent: 'space-between' }}>
        <Button onClick={onClose} sx={{ color: '#5C6B7A' }}>
          Cerrar
        </Button>
        {role === 'chofer' ? (
          !isMobile && onMarkLlegada && onMarkFin ? (
            tren(trip, onMarkLlegada, onMarkFin)
          ) : null
        ) : onOpenPlan ? (
          <Button variant="contained" endIcon={<ArrowForward />} onClick={onOpenPlan}>
            Abrir planificación
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  )
}