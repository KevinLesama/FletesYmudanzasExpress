import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import {
  ArrowBack,
  Check,
  CheckCircle,
  LocalShipping,
  MyLocation,
  Payments,
  PhotoCamera,
  ReceiptLong,
  WhatsApp as WhatsAppIconMui,
} from '@mui/icons-material'
import { api } from '../api'
import { ars, formatShortPlace, joinParts, waLink } from '../format'
import { color, radius, type as typeScale } from '../design/tokens'
import { clearDriverProgress, loadDriverProgress, saveDriverProgress } from '../driverTripProgress'
import type { DriverPhase, DriverTripProgress } from '../driverTripProgress'
import type { Place, ShiftRequest } from '../types'
import { DriverRouteMap } from './DriverRouteMap'
import { PlaceMarker } from './PlaceMarker'
import { SegmentedControl } from './SegmentedControl'
import { StatusChip } from './StatusChip'

const nowLocal = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const PHASE_LABELS = ['Origen', 'Destino', 'Cierre'] as const

function initialProgress(trip: ShiftRequest): DriverTripProgress {
  const stored = loadDriverProgress(trip.id)
  if (trip.finishedAt || trip.arrivedAt) {
    return { ...stored, phase: 3, originArrived: true }
  }
  return stored
}

function Panel({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <Box
      component="section"
      sx={{
        border: `1px solid ${color.border}`,
        borderRadius: `${radius.md}px`,
        bgcolor: color.paper,
        p: { xs: 2, md: 2.5 },
      }}
    >
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1.5 }}>
        <Typography
          component="h3"
          sx={{ flexGrow: 1, fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 17, color: color.navy }}
        >
          {title}
        </Typography>
        {meta && (
          <Typography sx={{ fontSize: typeScale.micro, fontWeight: 700, color: color.muted, textAlign: 'right' }}>
            {meta}
          </Typography>
        )}
      </Stack>
      {children}
    </Box>
  )
}

function PhaseIndicator({ phase }: { phase: DriverPhase }) {
  return (
    <Box component="ol" aria-label="Etapas del viaje" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, m: 0, p: 0, listStyle: 'none' }}>
      {PHASE_LABELS.map((label, index) => {
        const number = index + 1
        const done = number < phase
        const current = number === phase
        return (
          <Box
            component="li"
            key={label}
            aria-current={current ? 'step' : undefined}
            sx={{ position: 'relative', pt: 1.75 }}
          >
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                borderRadius: 999,
                bgcolor: done ? color.green : current ? color.orange : color.border,
              }}
            />
            <Typography
              sx={{
                fontSize: typeScale.micro,
                fontWeight: current ? 800 : 700,
                color: current ? color.navy : done ? color.inkStrong : color.muted,
              }}
            >
              {number}. {label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

function PlaceBlock({ label, place }: { label: string; place: Place }) {
  const kind = label.toLowerCase().includes('origen') ? 'origin' : 'destination'
  const details = joinParts([
    place.barrio,
    place.floor ? `Piso ${place.floor}` : '',
    place.elevator ? 'Con ascensor' : 'Sin ascensor',
  ])

  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <PlaceMarker kind={kind} size={16} lineHeight={typeScale.body * 1.5} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: typeScale.micro, fontWeight: 700, letterSpacing: '0.06em', color: color.muted }}>
          {label.toUpperCase()}
        </Typography>
        <Typography sx={{ fontSize: typeScale.body, fontWeight: 700, color: color.navy, overflowWrap: 'anywhere' }}>
          {place.address || 'Sin dirección'}
        </Typography>
        {details && <Typography sx={{ fontSize: typeScale.caption, color: color.muted }}>{details}</Typography>}
        {place.label && place.label !== 'Origen' && place.label !== 'Destino' && (
          <Typography sx={{ fontSize: typeScale.caption, color: color.muted }}>{place.label}</Typography>
        )}
      </Box>
    </Stack>
  )
}

function ArrivalBanner({ text }: { text: string }) {
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        borderRadius: 2,
        bgcolor: color.greenSoft,
        border: `1px solid ${color.green}`,
      }}
    >
      <CheckCircle sx={{ fontSize: 18, color: color.green }} />
      <Typography sx={{ fontSize: typeScale.caption, fontWeight: 700, color: color.green }}>{text}</Typography>
    </Box>
  )
}

function MoneyRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Typography sx={{ fontSize: strong ? typeScale.body : typeScale.caption, fontWeight: strong ? 800 : 500, color: strong ? color.navy : color.ink }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: strong ? 17 : typeScale.caption, fontWeight: strong ? 800 : 700, color: strong ? color.navy : color.inkStrong }}>
        {ars(value)}
      </Typography>
    </Stack>
  )
}

export function DriverTripFlow({
  trip,
  vehicleName,
  onClose,
  onFinished,
  onNotify,
}: {
  trip: ShiftRequest
  vehicleName?: string
  onClose: () => void
  onFinished: () => Promise<void>
  onNotify: (message: string, tone: 'success' | 'error') => void
}) {
  const [progress, setProgress] = useState<DriverTripProgress>(() => initialProgress(trip))
  const [photo, setPhoto] = useState<{ name: string; dataUrl: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cargoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveDriverProgress(trip.id, progress)
  }, [trip.id, progress])

  const cargoItems = trip.cargo.items
  const loadedSet = new Set(progress.loadedItems)
  const allLoaded = cargoItems.every((_, index) => loadedSet.has(index))
  const remaining = cargoItems.filter((_, index) => !loadedSet.has(index)).length

  const paidBalance = (trip.payments ?? [])
    .filter((payment) => payment.concept === 'Saldo')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const balance = Math.max(0, trip.price - trip.depositReceived - paidBalance)
  const requiresPayment = balance > 0.5
  const canFinish = (!requiresPayment || Boolean(progress.paymentMethod)) && Boolean(photo)

  const update = (patch: Partial<DriverTripProgress>) =>
    setProgress((current) => ({ ...current, ...patch }))

  const goToPhase = (phase: DriverPhase) =>
    setProgress((current) => ({
      ...current,
      phase,
      originArrived: phase > 1 ? true : current.originArrived,
    }))

  const confirmOrigin = () => {
    update({ originArrived: true })
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.requestAnimationFrame(() =>
      cargoRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }),
    )
  }

  const toggleItem = (index: number, checked: boolean) => {
    setProgress((current) => {
      const next = new Set(current.loadedItems)
      if (checked) next.add(index)
      else next.delete(index)
      return { ...current, loadedItems: Array.from(next).sort((a, b) => a - b) }
    })
  }

  const toggleAll = () => {
    setProgress((current) => ({
      ...current,
      loadedItems: allLoaded ? [] : cargoItems.map((_, index) => index),
    }))
  }

  const onFile = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto({ name: file.name, dataUrl: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const finish = async () => {
    setBusy(true)
    try {
      await api.markFinished(trip.id, nowLocal(), {
        paymentMethod: progress.paymentMethod,
        remitoCaptured: Boolean(photo),
      })
      clearDriverProgress(trip.id)
      setConfirmOpen(false)
      onNotify('Viaje finalizado · buen servicio', 'success')
      await onFinished()
    } catch (err) {
      setConfirmOpen(false)
      onNotify(err instanceof Error ? err.message : 'No pudimos finalizar el viaje.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const finishHint = !requiresPayment || progress.paymentMethod
    ? photo
      ? 'Todo listo para cerrar el viaje.'
      : 'Sacá la foto del remito para cerrar el viaje.'
    : 'Elegí cómo se cobra el saldo para cerrar el viaje.'

  return (
    <Stack spacing={2} sx={{ pb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button
          size="small"
          startIcon={<ArrowBack sx={{ fontSize: 17 }} />}
          onClick={onClose}
          sx={{ minHeight: 40, color: color.inkStrong, px: 1 }}
        >
          Mis viajes
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <StatusChip label="Confirmada" />
      </Stack>

      <Box>
        <Typography
          component="h2"
          sx={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
            fontSize: { xs: 22, md: 26 },
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: color.navy,
          }}
        >
          {formatShortPlace(trip.origin) || 'Origen'} → {formatShortPlace(trip.destination) || 'Destino'}
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: typeScale.caption, color: color.muted }}>
          {joinParts([
            trip.id,
            trip.client,
            `${trip.serviceRange[0]}–${trip.serviceRange[1]}`,
            vehicleName,
          ])}
        </Typography>
      </Box>

      <PhaseIndicator phase={progress.phase} />

      {progress.phase === 1 && (
        <>
          <Panel title="Ir al origen" meta={`Paso 1 de 3 · ${trip.serviceRange[0]}`}>
            <DriverRouteMap target={trip.origin} targetKind="origin" height={300} />
            <Divider sx={{ my: 2, borderColor: color.borderSoft }} />
            <PlaceBlock label="Origen" place={trip.origin} />
            {trip.origin.notes && (
              <Typography sx={{ mt: 1, fontSize: typeScale.caption, color: color.ink }}>
                Nota: {trip.origin.notes}
              </Typography>
            )}

            <Box sx={{ mt: 2 }}>
              {progress.originArrived ? (
                <ArrivalBanner text="Llegada al origen confirmada" />
              ) : (
                <>
                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    startIcon={<MyLocation />}
                    onClick={confirmOrigin}
                    sx={{ minHeight: 50 }}
                  >
                    Llegué al origen
                  </Button>
                  <Typography sx={{ mt: 1, textAlign: 'center', fontSize: typeScale.caption, color: color.muted }}>
                    Confirmá la llegada para ver la lista de cosas que tenés que subir.
                  </Typography>
                </>
              )}
            </Box>
          </Panel>

          {progress.originArrived && (
            <Box ref={cargoRef}>
              <Panel title="Carga a subir" meta={`${cargoItems.length} tipos · ${trip.cargo.approxUnits} bultos`}>
                <Typography sx={{ mb: 1.5, fontSize: typeScale.caption, color: color.ink }}>
                  Marcá cada cosa cuando ya esté arriba del flete.
                </Typography>

                {cargoItems.length === 0 ? (
                  <Typography sx={{ fontSize: typeScale.body, color: color.muted }}>
                    El viaje no tiene detalle de carga. Confirmá que todo está cargado para salir.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {cargoItems.map((item, index) => {
                      const checked = loadedSet.has(index)
                      return (
                        <Box
                          key={`${item.name}-${index}`}
                          component="label"
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1.25,
                            p: 1.5,
                            minHeight: 48,
                            borderRadius: 2,
                            border: `1px solid ${checked ? color.green : color.border}`,
                            bgcolor: checked ? color.greenSoft : color.sand,
                            cursor: 'pointer',
                          }}
                        >
                          <Checkbox
                            checked={checked}
                            onChange={(event) => toggleItem(index, event.target.checked)}
                            inputProps={{ 'aria-label': `Cargar ${item.name}` }}
                            sx={{ p: 0.25, color: color.muted, '&.Mui-checked': { color: color.green } }}
                          />
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: typeScale.body, fontWeight: 700, color: color.navy }}>
                              {item.name}
                            </Typography>
                            {item.note && (
                              <Typography sx={{ fontSize: typeScale.caption, color: color.muted }}>{item.note}</Typography>
                            )}
                          </Box>
                          <Typography sx={{ fontSize: typeScale.caption, fontWeight: 700, color: color.ink }}>
                            ×{item.units}
                          </Typography>
                        </Box>
                      )
                    })}
                  </Stack>
                )}

                {trip.cargo.notes && (
                  <Typography sx={{ mt: 1.5, fontSize: typeScale.caption, color: color.ink }}>
                    Nota de carga: {trip.cargo.notes}
                  </Typography>
                )}

                {cargoItems.length > 0 && (
                  <Button size="small" onClick={toggleAll} sx={{ mt: 1, minHeight: 38, color: color.navy }}>
                    {allLoaded ? 'Desmarcar todos' : 'Marcar todos'}
                  </Button>
                )}

                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  disabled={!allLoaded}
                  onClick={() => goToPhase(2)}
                  sx={{ mt: 1.5, minHeight: 50 }}
                >
                  {allLoaded ? 'Carga completa · ir al destino' : `Faltan ${remaining} ítem${remaining === 1 ? '' : 's'}`}
                </Button>
              </Panel>
            </Box>
          )}
        </>
      )}

      {progress.phase === 2 && (
        <>
          <Panel
            title="Viaje al destino"
            meta={joinParts(['Paso 2 de 3', trip.totalKm ? `${trip.totalKm} km` : ''])}
          >
            <DriverRouteMap target={trip.destination} fallbackFrom={trip.origin} targetKind="destination" height={320} />
            <Divider sx={{ my: 2, borderColor: color.borderSoft }} />
            <PlaceBlock label="Destino" place={trip.destination} />
            {trip.destination.notes && (
              <Typography sx={{ mt: 1, fontSize: typeScale.caption, color: color.ink }}>
                Nota: {trip.destination.notes}
              </Typography>
            )}

            <Box sx={{ mt: 2 }}>
              <Button
                fullWidth
                size="large"
                variant="contained"
                startIcon={<Check />}
                onClick={() => goToPhase(3)}
                sx={{ minHeight: 50 }}
              >
                Llegué al destino
              </Button>
              <Typography sx={{ mt: 1, textAlign: 'center', fontSize: typeScale.caption, color: color.muted }}>
                Al confirmar, pasás al cierre del viaje y al remito.
              </Typography>
            </Box>
          </Panel>

          {trip.phone && (
            <Button
              variant="outlined"
              startIcon={<WhatsAppIconMui sx={{ fontSize: 18 }} />}
              href={waLink(trip.phone, `Hola ${trip.client}, soy el chofer asignado al viaje ${trip.id}.`)}
              target="_blank"
              rel="noreferrer"
              sx={{ minHeight: 46, alignSelf: 'flex-start' }}
            >
              Avisar a {trip.client || 'el cliente'} por WhatsApp
            </Button>
          )}
        </>
      )}

      {progress.phase === 3 && (
        <>
          <Panel title="Entrega en destino" meta={`Paso 3 de 3 · ${trip.id}`}>
            <ArrivalBanner text="Llegada al destino confirmada" />
            <Box sx={{ mt: 2 }}>
              <PlaceBlock label="Destino" place={trip.destination} />
            </Box>
            <Divider sx={{ my: 2, borderColor: color.borderSoft }} />
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ color: color.ink }}>
              <LocalShipping sx={{ fontSize: 18 }} />
              <Typography sx={{ fontSize: typeScale.caption }}>
                {cargoItems.length} tipos de carga · {trip.cargo.approxUnits} bultos entregados
              </Typography>
            </Stack>
          </Panel>

          <Panel title="Cobro del saldo" meta={requiresPayment ? 'Pago pendiente' : 'Sin saldo'}>
            <Stack spacing={0.8}>
              <MoneyRow label="Total del viaje" value={trip.price} />
              <MoneyRow label="Seña recibida" value={trip.depositReceived} />
              <Divider sx={{ borderColor: color.borderSoft, my: 0.5 }} />
              <MoneyRow label="Saldo a cobrar" value={balance} strong />
            </Stack>

            {requiresPayment ? (
              <>
                <Typography id="driver-payment-method" sx={{ mt: 2, mb: 1, fontSize: typeScale.caption, fontWeight: 700, color: color.navy }}>
                  Modalidad de pago del saldo
                </Typography>
                <SegmentedControl
                  fullWidth
                  ariaLabelledBy="driver-payment-method"
                  options={[
                    { value: 'Efectivo', label: 'Efectivo' },
                    { value: 'Transferencia', label: 'Transferencia' },
                  ]}
                  value={progress.paymentMethod ?? null}
                  onChange={(value) => update({ paymentMethod: value as 'Efectivo' | 'Transferencia' })}
                />
                <Typography sx={{ mt: 1, fontSize: typeScale.caption, color: color.muted }}>
                  {progress.paymentMethod === 'Efectivo'
                    ? 'Cobrás el saldo en mano cuando el cliente recibe la carga.'
                    : progress.paymentMethod === 'Transferencia'
                      ? 'Verificá que la transferencia esté acreditada antes de cerrar.'
                      : 'Elegí cómo te paga el cliente el saldo restante.'}
                </Typography>
              </>
            ) : (
              <ArrivalBanner text="No queda saldo pendiente: el viaje ya está pago." />
            )}
          </Panel>

          <Panel title="Remito" meta={photo ? 'Foto cargada' : 'Falta la foto'}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(event) => {
                onFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
            {photo ? (
              <Stack spacing={1.25}>
                <Box
                  component="img"
                  src={photo.dataUrl}
                  alt="Foto del remito cargada"
                  sx={{
                    display: 'block',
                    width: '100%',
                    maxHeight: 280,
                    objectFit: 'contain',
                    borderRadius: 2,
                    border: `1px solid ${color.border}`,
                    bgcolor: color.sand,
                  }}
                />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                  <Button size="small" startIcon={<PhotoCamera />} onClick={() => fileRef.current?.click()} sx={{ minHeight: 44 }}>
                    Cambiar foto
                  </Button>
                  <Button size="small" onClick={() => setPhoto(null)} sx={{ minHeight: 44, color: color.red }}>
                    Quitar foto
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Button
                fullWidth
                size="large"
                variant="outlined"
                startIcon={<PhotoCamera />}
                onClick={() => fileRef.current?.click()}
                sx={{ minHeight: 54 }}
              >
                Abrir cámara
              </Button>
            )}
            <Typography sx={{ mt: 1.25, fontSize: typeScale.caption, color: color.muted }}>
              La foto del remito queda en este dispositivo por ahora.
            </Typography>
          </Panel>

          <Box>
            <Button
              fullWidth
              size="large"
              variant="contained"
              disabled={!canFinish || busy}
              startIcon={busy ? <CircularProgress size={18} sx={{ color: color.paper }} /> : <Check />}
              onClick={() => setConfirmOpen(true)}
              sx={{ minHeight: 52 }}
            >
              Viaje finalizado
            </Button>
            <Typography role="status" sx={{ mt: 1, textAlign: 'center', fontSize: typeScale.caption, color: canFinish ? color.green : color.muted }}>
              {finishHint}
            </Typography>
          </Box>
        </>
      )}

      <Dialog open={confirmOpen} onClose={busy ? undefined : () => setConfirmOpen(false)} fullWidth maxWidth="xs" aria-labelledby="finish-trip-title">
        <DialogTitle id="finish-trip-title" sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800 }}>
          ¿Finalizar el viaje?
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.25}>
            <Typography sx={{ fontSize: typeScale.body, color: color.ink }}>
              Vas a cerrar el viaje {trip.id}. Esta acción no se puede deshacer.
            </Typography>
            <Stack spacing={0.75} sx={{ p: 1.5, borderRadius: 2, bgcolor: color.sand, border: `1px solid ${color.borderSoft}` }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Payments sx={{ fontSize: 17, color: color.navy }} />
                <Typography sx={{ fontSize: typeScale.caption, color: color.ink }}>
                  {requiresPayment ? `${ars(balance)} · ${progress.paymentMethod ?? 'Sin modalidad'}` : 'Sin saldo pendiente'}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <ReceiptLong sx={{ fontSize: 17, color: color.navy }} />
                <Typography sx={{ fontSize: typeScale.caption, color: color.ink }}>
                  {photo ? 'Remito fotografiado' : 'Falta la foto del remito'}
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={busy} sx={{ color: color.ink }}>
            Volver
          </Button>
          <Button
            variant="contained"
            onClick={() => void finish()}
            disabled={busy || !canFinish}
            startIcon={busy ? <CircularProgress size={16} sx={{ color: color.paper }} /> : <Check />}
          >
            Sí, finalizar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
