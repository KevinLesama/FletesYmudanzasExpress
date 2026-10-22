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
  Close,
  Flag,
  ImageOutlined,
  LocalShipping,
  Map,
  Notes,
  Paid,
  PhotoCamera,
  ReceiptLong,
  Schedule,
} from '@mui/icons-material'
import { StatusChip } from './StatusChip'
import { ars, fmtDateEs, waLink } from '../format'
import { WhatsAppIcon } from './WhatsAppIcon'
import { brand } from '../theme'
import type { ShiftRequest } from '../types'

function InfoPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Box sx={{ p: 1, px: 1.2, borderRadius: 999, bgcolor: '#F0F2F5', display: 'inline-flex', alignItems: 'center', gap: 0.8 }}>
      <Box sx={{ color: '#8A939E', display: 'flex' }}>{icon}</Box>
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#33475F' }}>{text}</Typography>
    </Box>
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
  onAddPayment,
  onAttachRemito,
  onDetachRemito,
}: {
  trip: ShiftRequest
  driverName?: string
  vehicleName?: string
  role: 'admin' | 'chofer'
  onClose: () => void
  onOpenPlan?: () => void
  earnings?: { lines: { label: string; value: number }[]; total: number }
  onAddPayment?: () => void
  onAttachRemito?: (paymentId: number, file: File) => void
  onDetachRemito?: (paymentId: number) => void
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const fileRef = useRef<HTMLInputElement>(null)
  const paymentIdRef = useRef<number | null>(null)

  const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    `${trip.origin.address}, ${trip.origin.barrio}`,
  )}&destination=${encodeURIComponent(`${trip.destination.address}, ${trip.destination.barrio}`)}`

  const wa = waLink(
    trip.phone,
    `Hola ${trip.client}, te escribimos por tu viaje ${trip.id} del ${fmtDateEs(trip.date)} · servicio ${trip.serviceRange.join(' a ')}.`,
  )

  const payments = trip.payments ?? []

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
            <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>
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
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#8A939E', letterSpacing: '0.08em' }}>ORIGEN · {trip.origin.label}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mt: 0.3 }}>{trip.origin.address}</Typography>
              <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>
                {trip.origin.barrio} · {trip.origin.floor} {trip.origin.elevator ? '· con ascensor' : ''}
              </Typography>
            </Box>
            <Box sx={{ p: 1.8, borderRadius: 2.5, bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', flexGrow: 1 }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: brand.orange, letterSpacing: '0.08em' }}>DESTINO · {trip.destination.label}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mt: 0.3 }}>{trip.destination.address}</Typography>
              <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>
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
                <Notes sx={{ fontSize: 15, color: '#8A939E', mt: 0.2 }} />
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#8A939E' }}>NOTA DEL CLIENTE</Typography>
                  <Typography sx={{ fontSize: 13, mt: 0.3 }}>{trip.cargo.notes}</Typography>
                </Box>
              </Stack>
            </Box>
          )}

          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#5C6B7A' }}>COBROS</Typography>
              <Box sx={{ flexGrow: 1 }} />
              {role === 'chofer' && onAddPayment && (
                <Button size="small" variant="contained" startIcon={<Paid />} onClick={onAddPayment} sx={{ py: 0.8 }}>
                  Registrar cobro
                </Button>
              )}
            </Stack>

            {payments.length === 0 ? (
              <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>Todavía no hay cobros registrados para este viaje.</Typography>
            ) : (
              <Stack spacing={1}>
                {payments.map((p) => (
                  <Box key={p.id} sx={{ p: 1.4, borderRadius: 2.5, bgcolor: '#FFFFFF', border: '1px solid #E9E6DF' }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: brand.navy }}>{p.concept}</Typography>
                      <Typography sx={{ fontSize: 12, color: '#8A939E' }}>{p.method}</Typography>
                      <Box sx={{ flexGrow: 1 }} />
                      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: brand.navy }}>{ars(p.amount)}</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 11.5, color: '#8A939E', mt: 0.3 }}>
                      {fmtDateEs(p.date)} · recibido por {p.receivedBy}
                      {p.notes ? ` · ${p.notes}` : ''}
                    </Typography>

                    {p.remito ? (
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                        <PhotoCamera sx={{ fontSize: 15, color: '#4E9A6C' }} />
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.remito.name}
                        </Typography>
                        {role === 'chofer' && onDetachRemito && p.id !== undefined && (
                          <Button size="small" sx={{ color: '#9C493A', minWidth: 0 }} onClick={() => onDetachRemito(p.id!)}>
                            Quitar
                          </Button>
                        )}
                      </Stack>
                    ) : role === 'chofer' && onAttachRemito && p.id !== undefined ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ImageOutlined />}
                        onClick={() => {
                          paymentIdRef.current = p.id!
                          fileRef.current?.click()
                        }}
                        sx={{ mt: 1, color: brand.navy, borderColor: '#D9D4C9', py: 0.8 }}
                      >
                        Adjuntar foto del remito
                      </Button>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                const paymentId = paymentIdRef.current
                if (f && paymentId !== null) {
                  onAttachRemito?.(paymentId, f)
                }
                paymentIdRef.current = null
                e.target.value = ''
              }}
            />
          </Box>

          {role === 'chofer' && earnings && (
            <Box sx={{ p: 1.8, borderRadius: 2.5, bgcolor: '#FBF9F6', border: '1px solid #EDEAE3' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <ReceiptLong sx={{ fontSize: 16, color: brand.navy }} />
                <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 14 }}>Cálculo del viaje</Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Typography sx={{ fontSize: 11, color: '#8A939E' }}>según mi configuración</Typography>
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
        {role !== 'chofer' && onOpenPlan && (
          <Button variant="contained" endIcon={<ArrowForward />} onClick={onOpenPlan}>
            Abrir planificación
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
