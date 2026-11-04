import { useState } from 'react'
import {
  ArrowForward,
  ArrowUpward,
  CheckCircle,
  CheckCircleOutline,
  LocalShipping,
  MapOutlined,
  PersonOutline,
  Route,
  Straighten,
  SupportAgent,
  VerifiedUser,
} from '@mui/icons-material'
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material'
import { api } from '../api'
import { PlaceAutocomplete } from '../components/PlaceAutocomplete'
import { EtiquetaCampo, MensajeCampo } from '../components/FormFields'
import { Toast, type ToastState } from '../components/Toast'
import { WhatsAppIcon } from '../components/WhatsAppIcon'
import { color, type } from '../design/tokens'
import { waLink } from '../format'
import { getTodayISO } from '../agendaDates'
import { brand } from '../theme'
import type { PlaceDetail } from '../types'

type LandingStep = 'request' | 'sent'
type LandingField = 'name' | 'phone' | 'date' | 'arrivalFrom' | 'arrivalTo' | 'origin' | 'destination' | 'cargo'
type LandingErrors = Partial<Record<LandingField, string>>

type ContactFormProps = Readonly<{
  name: string
  phone: string
  busy: boolean
  setName: (value: string) => void
  setPhone: (value: string) => void
  errors: LandingErrors
  touched: Partial<Record<LandingField, boolean>>
  onBlur: (field: LandingField) => void
}>

type RequestFormProps = Readonly<{
  date: string
  arrivalFrom: string
  arrivalTo: string
  origin: string
  destination: string
  originPlace: PlaceDetail | null
  destinationPlace: PlaceDetail | null
  cargo: string
  notes: string
  busy: boolean
  setDate: (value: string) => void
  setArrivalFrom: (value: string) => void
  setArrivalTo: (value: string) => void
  setOrigin: (value: string) => void
  setDestination: (value: string) => void
  setOriginPlace: (place: PlaceDetail | null) => void
  setDestinationPlace: (place: PlaceDetail | null) => void
  setCargo: (value: string) => void
  setNotes: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
  errors: LandingErrors
  touched: Partial<Record<LandingField, boolean>>
  onBlur: (field: LandingField) => void
}>

const FLETES_WHATSAPP = '11 4500-1287'
const WHATSAPP_REQUEST_MESSAGE = 'Hola, quiero realizar una solicitud de flete.'

export function LandingPage() {
  const [step, setStep] = useState<LandingStep>('request')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(getTodayISO)
  const [arrivalFrom, setArrivalFrom] = useState('09:00')
  const [arrivalTo, setArrivalTo] = useState('11:00')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [originPlace, setOriginPlace] = useState<PlaceDetail | null>(null)
  const [destinationPlace, setDestinationPlace] = useState<PlaceDetail | null>(null)
  const [cargo, setCargo] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [errors, setErrors] = useState<LandingErrors>({})
  const [touched, setTouched] = useState<Partial<Record<LandingField, boolean>>>({})

  const validate = (): LandingErrors => {
    const next: LandingErrors = {}
    if (!name.trim()) next.name = 'Ingresá tu nombre y apellido.'
    if (!phone.trim()) next.phone = 'Ingresá tu teléfono.'
    if (!date) next.date = 'Elegí el día del servicio.'
    if (!arrivalFrom) next.arrivalFrom = 'Elegí desde qué hora.'
    if (!arrivalTo) next.arrivalTo = 'Elegí hasta qué hora.'
    if (!origin.trim()) next.origin = 'Ingresá el punto de retiro.'
    if (!destination.trim()) next.destination = 'Ingresá el punto de entrega.'
    if (!cargo.trim()) next.cargo = 'Contanos qué hay que trasladar.'
    return next
  }

  const onFieldBlur = (field: LandingField) => {
    setTouched((current) => ({ ...current, [field]: true }))
    setErrors(validate())
  }

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    setTouched({ name: true, phone: true, date: true, arrivalFrom: true, arrivalTo: true, origin: true, destination: true, cargo: true })
    if (Object.keys(validationErrors).length > 0) return
    setBusy(true)
    try {
      await api.createPublicRequest({
        contact_name: name.trim(),
        contact_phone: phone.trim(),
        date,
        arrival_from: arrivalFrom,
        arrival_to: arrivalTo,
        service_from: arrivalFrom,
        service_to: arrivalTo,
        origin: {
          address: origin,
          barrio: originPlace?.locality || originPlace?.partido || '',
          floor: '',
          elevator: false,
          placeId: originPlace?.placeId,
          lat: originPlace?.lat,
          lng: originPlace?.lng,
        },
        destination: {
          address: destination,
          barrio: destinationPlace?.locality || destinationPlace?.partido || '',
          floor: '',
          elevator: false,
          placeId: destinationPlace?.placeId,
          lat: destinationPlace?.lat,
          lng: destinationPlace?.lng,
        },
        cargo: { items: [], approx_units: 0, fragile: false, notes: cargo + (notes ? ` · ${notes}` : '') },
      })
      setStep('sent')
      setToast({ message: 'Solicitud enviada correctamente.', tone: 'success' })
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'No pudimos enviar la solicitud.', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: brand.cream, color: brand.navy }}>
      <Box component="header" sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2.5, md: 5 }, py: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: brand.navy, color: '#fff', display: 'grid', placeItems: 'center' }}>
              <LocalShipping sx={{ fontSize: 21 }} />
            </Box>
            <Box>
              <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, lineHeight: 1 }}>Fletes Express</Typography>
              <Typography sx={{ color: brand.muted, fontSize: 12.5, mt: 0.4 }}>Tu mudanza, bien coordinada</Typography>
            </Box>
          </Stack>
          <Stack component="nav" aria-label="Navegación principal" direction="row" spacing={{ xs: 1.5, sm: 3 }}>
            <Link href="#about-title" underline="hover" color="inherit" sx={{ fontSize: { xs: 12.5, sm: type.body }, fontWeight: 700, whiteSpace: 'nowrap' }}>
              Sobre nosotros
            </Link>
            <Link href="#how-title" underline="hover" color="inherit" sx={{ fontSize: { xs: 12.5, sm: type.body }, fontWeight: 700, whiteSpace: 'nowrap' }}>
              Cómo funciona
            </Link>
            <Button
              component="a"
              href={waLink(FLETES_WHATSAPP, WHATSAPP_REQUEST_MESSAGE)}
              target="_blank"
              rel="noreferrer"
              size="small"
              startIcon={<WhatsAppIcon size={17} />}
              sx={{ color: color.green, fontWeight: 800, whiteSpace: 'nowrap', '&:hover': { bgcolor: color.greenSoft } }}
            >
              WhatsApp
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box component="main" sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2.5, md: 5 }, pb: { xs: 5, md: 9 }, '@media (max-height: 800px)': { pb: { xs: 4, md: 6 } } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1.08fr 0.92fr' },
            gap: { xs: 4, md: 6, lg: 8 },
            alignItems: 'center',
            pt: { xs: 4, md: 6, lg: 8 },
            pb: { xs: 1, md: 2 },
            '@media (max-height: 800px)': {
              pt: { xs: 3, md: 4, lg: 5 },
              gap: { xs: 3, md: 4, lg: 6 },
              pb: { xs: 0.5, md: 1 },
            },
            '@media (max-height: 720px)': {
              pt: { xs: 2.5, md: 3 },
              gap: { xs: 2.5, md: 3 },
            },
          }}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Box sx={{ width: 30, height: 2, bgcolor: brand.orange }} />
              <Typography sx={{ color: brand.orangeInk, fontWeight: 800, fontSize: 12, letterSpacing: '0.14em' }}>FLETES SIN VUELTAS</Typography>
            </Stack>
            <Typography
              component="h1"
              sx={{
                mt: 1.8,
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 800,
                fontSize: { xs: 'clamp(34px, 7vw, 46px)', sm: 'clamp(38px, 6vw, 52px)', md: 'clamp(42px, 4.5vw, 54px)', lg: 'clamp(46px, 4vw, 58px)' },
                lineHeight: 1.02,
                letterSpacing: '-0.04em',
                maxWidth: 620,
                textWrap: 'balance',
                '@media (max-height: 800px)': {
                  mt: 1.4,
                  fontSize: { xs: 'clamp(32px, 6.5vw, 42px)', md: 'clamp(38px, 4vw, 48px)' },
                },
                '@media (max-height: 720px)': {
                  mt: 1.2,
                  fontSize: { xs: 'clamp(30px, 6vw, 38px)', md: 'clamp(34px, 3.8vw, 44px)' },
                },
              }}
            >
              Mové lo que necesitás, con todo claro desde el inicio.
            </Typography>
            <Typography
              sx={{
                mt: 2.2,
                color: color.ink,
                fontSize: { xs: 16, md: 17, lg: 18 },
                lineHeight: 1.55,
                maxWidth: 540,
                '@media (max-height: 800px)': {
                  mt: 1.6,
                  fontSize: { xs: 15, md: 16 },
                },
                '@media (max-height: 720px)': {
                  mt: 1.4,
                  fontSize: { xs: 14.5, md: 15.5 },
                },
              }}
            >
              Indicá tu recorrido y coordinamos el servicio con vos. Tu solicitud queda registrada para que el equipo pueda confirmar disponibilidad y condiciones.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2.2}
              sx={{
                mt: 4,
                '@media (max-height: 800px)': { mt: 2.5, spacing: { xs: 1.5, sm: 1.8 } },
                '@media (max-height: 720px)': { mt: 2, spacing: { xs: 1.2, sm: 1.5 } },
              }}
            >
              <Benefit icon={<Route />} text="Origen y destino en un solo paso" />
              <Benefit icon={<CheckCircleOutline />} text="Seguimiento de tu solicitud" />
            </Stack>
          </Box>

          <Box
            sx={{
              bgcolor: '#fff',
              border: `1px solid ${brand.border}`,
              borderRadius: 4,
              p: { xs: 2.5, sm: 3, md: 3.5, lg: 4 },
              boxShadow: '0 12px 30px rgba(19,43,74,0.06)',
              '@media (max-height: 800px)': {
                p: { xs: 2, sm: 2.5, md: 3 },
              },
              '@media (max-height: 720px)': {
                p: { xs: 1.8, sm: 2.2, md: 2.6 },
              },
            }}
          >
            {step === 'request' && <RequestForm name={name} phone={phone} date={date} arrivalFrom={arrivalFrom} arrivalTo={arrivalTo} origin={origin} destination={destination} originPlace={originPlace} destinationPlace={destinationPlace} cargo={cargo} notes={notes} busy={busy} errors={errors} touched={touched} onBlur={onFieldBlur} setName={setName} setPhone={setPhone} setDate={setDate} setArrivalFrom={setArrivalFrom} setArrivalTo={setArrivalTo} setOrigin={setOrigin} setDestination={setDestination} setOriginPlace={setOriginPlace} setDestinationPlace={setDestinationPlace} setCargo={setCargo} setNotes={setNotes} onSubmit={submitRequest} />}
            {step === 'sent' && <SuccessState onNewRequest={() => setStep('request')} />}
          </Box>
        </Box>

        <AboutSection />
        <HowItWorksSection />
        <ReviewsSection />
      </Box>
      <LandingFooter />
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </Box>
  )
}

function ContactForm({ name, phone, busy, setName, setPhone, errors, touched, onBlur }: ContactFormProps) {
  return <Stack spacing={2}>
    <LandingTextField id="landing-name" label="Nombre y apellido" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => onBlur('name')} error={touched.name ? errors.name : undefined} />
    <LandingTextField id="landing-phone" label="Teléfono" value={phone} onChange={(event) => setPhone(event.target.value)} onBlur={() => onBlur('phone')} placeholder="11 5555-0000" error={touched.phone ? errors.phone : undefined} />
  </Stack>
}

function RequestForm({ name, phone, date, arrivalFrom, arrivalTo, origin, destination, originPlace, destinationPlace, cargo, notes, busy, errors, touched, onBlur, setName, setPhone, setDate, setArrivalFrom, setArrivalTo, setOrigin, setDestination, setOriginPlace, setDestinationPlace, setCargo, setNotes, onSubmit }: RequestFormProps & ContactFormProps) {
  const changeOrigin = (value: string) => {
    setOrigin(value)
    if (originPlace && value !== originPlace.address) setOriginPlace(null)
  }
  const changeDestination = (value: string) => {
    setDestination(value)
    if (destinationPlace && value !== destinationPlace.address) setDestinationPlace(null)
  }

  const errorFor = (field: LandingField) => touched[field] ? errors[field] : undefined

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Typography variant="h5" sx={{ fontSize: { xs: 18, md: 20 } }}>Solicitá tu flete</Typography>
      <Typography sx={{ mt: 0.6, color: brand.muted, fontSize: 14 }}>Dejanos tus datos y completá el recorrido. No necesitás crear una cuenta.</Typography>
      <Stack
        spacing={{ xs: 1.5, md: 2 }}
        sx={{
          mt: { xs: 2, md: 3 },
          '@media (max-height: 800px)': { spacing: 1.25, mt: 2 },
          '@media (max-height: 720px)': { spacing: 1, mt: 1.6 },
        }}
      >
        <ContactForm name={name} phone={phone} busy={busy} setName={setName} setPhone={setPhone} errors={errors} touched={touched} onBlur={onBlur} />
        <LandingTextField id="landing-date" label="Día del servicio" type="date" value={date} onChange={(event) => setDate(event.target.value)} onBlur={() => onBlur('date')} error={errorFor('date')} InputLabelProps={{ shrink: true }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.25, md: 1.5 }}>
          <LandingTextField id="landing-arrival-from" label="Desde las" type="time" value={arrivalFrom} onChange={(event) => setArrivalFrom(event.target.value)} onBlur={() => onBlur('arrivalFrom')} error={errorFor('arrivalFrom')} InputLabelProps={{ shrink: true }} />
          <LandingTextField id="landing-arrival-to" label="Hasta las" type="time" value={arrivalTo} onChange={(event) => setArrivalTo(event.target.value)} onBlur={() => onBlur('arrivalTo')} error={errorFor('arrivalTo')} />
        </Stack>
        <PlaceAutocomplete
          label="¿Desde dónde retiramos?"
          value={origin}
          onValueChange={changeOrigin}
          onSelect={setOriginPlace}
          selected={originPlace !== null}
          placeholder="Buscá calle y número…"
          helperText={errorFor('origin') ?? 'Escribí al menos 3 letras y elegí una sugerencia.'}
        />
        <MensajeCampo id="landing-origin-error" mensaje={errorFor('origin')} />
        <PlaceAutocomplete
          label="¿A dónde lo llevamos?"
          value={destination}
          onValueChange={changeDestination}
          onSelect={setDestinationPlace}
          selected={destinationPlace !== null}
          placeholder="Buscá calle y número…"
          helperText={errorFor('destination') ?? 'Escribí al menos 3 letras y elegí una sugerencia.'}
        />
        <MensajeCampo id="landing-destination-error" mensaje={errorFor('destination')} />
        <LandingTextField id="landing-cargo" label="¿Qué hay que trasladar?" value={cargo} onChange={(event) => setCargo(event.target.value)} onBlur={() => onBlur('cargo')} error={errorFor('cargo')} multiline minRows={2} />
        <TextField label="Observaciones (opcional)" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={2} fullWidth autoComplete="off" />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={busy}
          endIcon={<ArrowForward />}
          sx={{
            minHeight: { xs: 44, md: 48 },
            mt: { xs: 0.5, md: 1 },
            '@media (max-height: 720px)': { minHeight: 44, mt: 0.5 },
          }}
        >
          {busy ? 'Enviando...' : 'Enviar solicitud'}
        </Button>
      </Stack>
    </Box>
  )
}

function LandingTextField({ id, label, error, ...props }: { id: string; label: string; error?: string } & Omit<React.ComponentProps<typeof TextField>, 'id' | 'label' | 'error'>) {
  return <Box><EtiquetaCampo text={label} htmlFor={id} /><TextField {...props} id={id} fullWidth error={Boolean(error)} inputProps={{ ...props.inputProps, 'aria-describedby': error ? `${id}-error` : undefined }} /><MensajeCampo id={`${id}-error`} mensaje={error} /></Box>
}

function SuccessState({ onNewRequest }: Readonly<{ onNewRequest: () => void }>) {
  return <Stack spacing={2} alignItems="flex-start">
    <CheckCircleOutline sx={{ color: color.green, fontSize: 42 }} />
    <Typography variant="h5">Ya recibimos tu solicitud.</Typography>
    <Typography sx={{ color: color.ink, lineHeight: 1.6 }}>El equipo va a revisar disponibilidad y se va a poner en contacto para confirmar los detalles del servicio.</Typography>
    <Alert severity="success" sx={{ width: '100%' }}>No se generó ningún pago en este paso.</Alert>
    <Button variant="outlined" onClick={onNewRequest} endIcon={<ArrowForward />}>Solicitar otro flete</Button>
  </Stack>
}

function Benefit({ icon, text }: Readonly<{ icon: React.ReactNode; text: string }>) {
  return <Stack direction="row" alignItems="center" spacing={1} sx={{ color: color.ink }}><Box sx={{ color: brand.orangeInk, display: 'grid', placeItems: 'center' }}>{icon}</Box><Typography sx={{ fontSize: 13.5 }}>{text}</Typography></Stack>
}

function AboutSection() {
  return (
    <Box
      component="section"
      aria-labelledby="about-title"
      sx={{
        mt: { xs: 8, md: 13 },
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: { xs: 3, md: 7 },
        alignItems: 'center',
      }}
    >
      <Box
        component="img"
        src="https://images.unsplash.com/photo-1600518464441-9154a4dea21b?auto=format&fit=crop&w=1200&q=85"
        alt="Equipo preparando cajas para una mudanza"
        sx={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 3, border: `1px solid ${brand.border}` }}
      />
      <Box>
        <Typography sx={{ color: brand.orangeInk, fontWeight: 800, fontSize: 12, letterSpacing: '0.14em' }}>SOBRE FLETES EXPRESS</Typography>
        <Typography id="about-title" component="h2" variant="h3" sx={{ mt: 1, fontSize: { xs: 28, md: 36 } }}>
          Una forma más clara de coordinar tu mudanza
        </Typography>
        <Typography sx={{ mt: 2, color: color.ink, fontSize: type.lead, lineHeight: 1.6 }}>
          Te ayudamos a ordenar el recorrido, los tiempos y la información importante antes de que el equipo salga a trabajar.
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 3 }}>
          <AboutPoint icon={<VerifiedUser />} text="Datos del servicio claros desde el primer contacto." />
          <AboutPoint icon={<SupportAgent />} text="Acompañamiento humano para coordinar cada detalle." />
          <AboutPoint icon={<Route />} text="Un recorrido real para tomar mejores decisiones." />
        </Stack>
      </Box>
    </Box>
  )
}

function AboutPoint({ icon, text }: Readonly<{ icon: React.ReactNode; text: string }>) {
  return <Stack direction="row" spacing={1.25} alignItems="center"><Box sx={{ color: brand.orangeInk, display: 'grid', placeItems: 'center' }}>{icon}</Box><Typography sx={{ color: color.ink, fontSize: type.body }}>{text}</Typography></Stack>
}

function HowItWorksSection() {
  const steps = [
    { number: '01', icon: <MapOutlined />, title: 'Indicás origen y destino', text: 'Buscás las direcciones reales y elegís una sugerencia para ubicar cada punto.' },
    { number: '02', icon: <Straighten />, title: 'Estimamos el recorrido', text: 'Calculamos distancia y duración aproximada para que tengas una referencia antes de coordinar.' },
    { number: '03', icon: <CheckCircleOutline />, title: 'Confirmás la solicitud', text: 'Revisamos disponibilidad y nos ponemos en contacto para cerrar los detalles.' },
  ]

  return (
    <Box component="section" aria-labelledby="how-title" sx={{ mt: { xs: 9, md: 14 }, py: { xs: 4, md: 6 }, px: { xs: 2, md: 4 }, bgcolor: '#EEF2F5', borderTop: `1px solid ${brand.border}`, borderBottom: `1px solid ${brand.border}` }}>
      <Box sx={{ textAlign: 'center', maxWidth: 650, mx: 'auto' }}>
        <Typography sx={{ color: brand.orangeInk, fontWeight: 800, fontSize: 12, letterSpacing: '0.14em' }}>CÓMO FUNCIONA</Typography>
        <Typography id="how-title" component="h2" variant="h3" sx={{ mt: 1, fontSize: { xs: 28, md: 36 } }}>Del recorrido a la coordinación</Typography>
        <Typography sx={{ mt: 1.25, color: color.ink, fontSize: type.lead }}>Tres pasos simples para pedir un flete con mejor información.</Typography>
      </Box>
      <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {steps.map((step) => <StepCard key={step.number} {...step} />)}
      </Box>
    </Box>
  )
}

function StepCard({ number, icon, title, text }: Readonly<{ number: string; icon: React.ReactNode; title: string; text: string }>) {
  return <Box sx={{ bgcolor: '#fff', border: `1px solid ${brand.border}`, borderRadius: 3, p: { xs: 2.5, md: 3 }, minHeight: 220 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box sx={{ color: brand.orangeInk, display: 'grid', placeItems: 'center' }}>{icon}</Box><Typography sx={{ color: brand.orangeInk, fontWeight: 800, fontSize: 13 }}>{number}</Typography></Stack><Typography component="h3" variant="h6" sx={{ mt: 3 }}>{title}</Typography><Typography sx={{ mt: 1, color: color.ink, fontSize: type.body, lineHeight: 1.55 }}>{text}</Typography></Box>
}

function ReviewsSection() {
  const reviews = [
    { name: 'Sofía', place: 'Villa Crespo', text: 'Pude dejar el recorrido claro desde el principio y coordinar el servicio sin idas y vueltas.' },
    { name: 'Alejandro', place: 'Ramos Mejía', text: 'La estimación del trayecto me ayudó a organizar mejor los horarios de la mudanza.' },
    { name: 'Marcela', place: 'Chivilcoy', text: 'Buena atención, respuestas claras y un equipo que entendió lo que necesitábamos mover.' },
  ]

  return (
    <Box component="section" aria-labelledby="reviews-title" sx={{ mt: { xs: 9, md: 14 } }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ color: brand.orangeInk, fontWeight: 800, fontSize: 12, letterSpacing: '0.14em' }}>EXPERIENCIAS REALES</Typography>
        <Typography id="reviews-title" component="h2" variant="h3" sx={{ mt: 1, fontSize: { xs: 28, md: 36 } }}>Cuando coordinar se siente simple</Typography>
      </Box>
      <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {reviews.map((review) => <ReviewCard key={review.name} {...review} />)}
      </Box>
    </Box>
  )
}

function ReviewCard({ name, place, text }: Readonly<{ name: string; place: string; text: string }>) {
  return <Box sx={{ borderTop: `2px solid ${brand.orange}`, pt: 2.5, px: { md: 1 } }}><Stack direction="row" spacing={1.25} alignItems="center"><Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: '#E8EEF2', color: brand.navy, display: 'grid', placeItems: 'center' }}><PersonOutline /></Box><Box><Typography sx={{ fontWeight: 800 }}>{name}</Typography><Typography sx={{ color: brand.muted, fontSize: 12.5 }}>{place}</Typography></Box></Stack><Typography sx={{ mt: 2, color: color.ink, fontSize: type.body, lineHeight: 1.6 }}>“{text}”</Typography><Stack direction="row" spacing={0.25} sx={{ mt: 1.5, color: brand.orangeInk }}>{[1, 2, 3, 4, 5].map((star) => <CheckCircle key={star} sx={{ fontSize: 15 }} />)}</Stack></Box>
}

function LandingFooter() {
  return <Box component="footer" sx={{ mt: { xs: 8, md: 12 }, bgcolor: brand.navy, color: '#fff' }}><Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2.5, md: 5 }, py: { xs: 4, md: 5 }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, justifyContent: 'space-between', alignItems: { md: 'center' } }}><Box><Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 20 }}>Fletes Express</Typography><Typography sx={{ mt: 0.75, color: '#D9E2E8', fontSize: type.body }}>Coordinación clara para cada mudanza.</Typography></Box><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }}><Link href="#about-title" underline="hover" color="inherit" sx={{ fontSize: type.body }}>Sobre nosotros</Link><Link href="#how-title" underline="hover" color="inherit" sx={{ fontSize: type.body }}>Cómo funciona</Link><Button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Volver arriba" sx={{ minWidth: 44, color: '#fff' }}><ArrowUpward /></Button></Stack></Box><Box sx={{ borderTop: '1px solid rgba(255,255,255,0.2)', maxWidth: 1180, mx: 'auto', px: { xs: 2.5, md: 5 }, py: 2 }}><Typography sx={{ color: '#D9E2E8', fontSize: 12.5 }}>© {new Date().getFullYear()} Fletes Express. Acceso y coordinación de servicios.</Typography></Box></Box>
}