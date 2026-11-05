import { useEffect, useRef, useState } from 'react'
import { keyframes } from '@emotion/react'
import {
  ArrowForward,
  ArrowUpward,
  CheckCircleOutline,
  LocalShipping,
  Login,
  MapOutlined,
  Pause,
  PersonOutline,
  PlayArrow,
  Route,
  Star,
  Straighten,
  SupportAgent,
  VerifiedUser,
  VolumeOff,
  VolumeUp,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  GlobalStyles,
  IconButton,
  Link,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { api } from '../api'
import { Brand } from '../components/Brand'
import { PlaceAutocomplete } from '../components/PlaceAutocomplete'
import { EtiquetaCampo, MensajeCampo } from '../components/FormFields'
import { Toast, type ToastState } from '../components/Toast'
import { WhatsAppIcon } from '../components/WhatsAppIcon'
import { color, type } from '../design/tokens'
import { waLink } from '../format'
import { R } from '../routes'
import { getTodayISO } from '../agendaDates'
import { brand } from '../theme'
import type { PlaceDetail } from '../types'
import landingVideo from '../Landing/Landing.mp4'

type LandingStep = 'request' | 'sent'
type LandingField = 'name' | 'phone' | 'date' | 'arrivalFrom' | 'origin' | 'destination' | 'cargo'
type LandingErrors = Partial<Record<LandingField, string>>

type ContactFormProps = Readonly<{
  name: string
  phone: string
  setName: (value: string) => void
  setPhone: (value: string) => void
  errors: LandingErrors
  touched: Partial<Record<LandingField, boolean>>
  onBlur: (field: LandingField) => void
}>

type RequestFormProps = Readonly<{
  date: string
  arrivalFrom: string
  origin: string
  destination: string
  originPlace: PlaceDetail | null
  destinationPlace: PlaceDetail | null
  cargo: string
  notes: string
  busy: boolean
  setDate: (value: string) => void
  setArrivalFrom: (value: string) => void
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
const PAGE_MAX = 1200

const containerSx = {
  width: '100%',
  maxWidth: PAGE_MAX,
  mx: 'auto',
  px: { xs: 2.5, sm: 4, md: 5 },
  '@media (min-width: 1600px)': { maxWidth: 1360, px: 6 },
  '@media (min-width: 2000px)': { maxWidth: 1520, px: 8 },
  '@media (min-width: 2600px)': { maxWidth: 1680, px: 10 },
}

const displaySx = {
  fontFamily: "'Manrope', sans-serif",
  fontWeight: 800,
  fontSize: 'clamp(2.6rem, 3.6vw, 5rem)',
  lineHeight: 1.02,
  letterSpacing: '-0.04em',
}

const sectionTitleSx = {
  fontFamily: "'Manrope', sans-serif",
  fontWeight: 800,
  fontSize: 'clamp(1.9rem, 2.4vw, 3.25rem)',
  lineHeight: 1.08,
  letterSpacing: '-0.03em',
}

const leadSx = {
  color: color.ink,
  fontSize: 'clamp(1rem, 0.85vw, 1.15rem)',
  lineHeight: 1.65,
}

const rise = keyframes`
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
`

const noMotion = { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }

export function LandingPage() {
  const [step, setStep] = useState<LandingStep>('request')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(getTodayISO)
  const [arrivalFrom, setArrivalFrom] = useState('09:00')
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

  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoMuted, setVideoMuted] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (reduceMotion) video.pause()
  }, [reduceMotion])

  const toggleVideo = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play().catch(() => setVideoPlaying(false))
    } else {
      video.pause()
    }
  }

  const toggleVideoSound = () => {
    const video = videoRef.current
    if (!video) return
    const nextMuted = !video.muted
    video.muted = nextMuted
    setVideoMuted(nextMuted)
  }

  const validate = (): LandingErrors => {
    const next: LandingErrors = {}
    if (!name.trim()) next.name = 'Ingresá tu nombre y apellido.'
    if (!phone.trim()) next.phone = 'Ingresá tu teléfono.'
    if (!date) next.date = 'Elegí el día del servicio.'
    if (!arrivalFrom) next.arrivalFrom = 'Elegí desde qué hora.'
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
    setTouched({ name: true, phone: true, date: true, arrivalFrom: true, origin: true, destination: true, cargo: true })
    if (Object.keys(validationErrors).length > 0) return
    setBusy(true)
    try {
      await api.createPublicRequest({
        contact_name: name.trim(),
        contact_phone: phone.trim(),
        date,
        arrival_from: arrivalFrom,
        service_from: arrivalFrom,
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
      <GlobalStyles
        styles={{
          html: {
            scrollBehavior: 'smooth',
            '@media (prefers-reduced-motion: reduce)': { scrollBehavior: 'auto' },
          },
        }}
      />

      <LandingHeader />

      <Box component="main">
        <Box
          component="section"
          aria-labelledby="hero-title"
          sx={{
            ...containerSx,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.05fr) minmax(0, 0.95fr)' },
            gap: { xs: 4, md: 6, lg: 'clamp(64px, 4.5vw, 88px)' },
            alignItems: 'center',
            pt: { xs: 5, md: 7, lg: 'clamp(56px, 4vw, 80px)' },
            pb: { xs: 6, md: 8, lg: 'clamp(64px, 4.5vw, 88px)' },
          }}
        >
          <Box sx={{ minWidth: 0, animation: `${rise} 720ms cubic-bezier(0.16, 1, 0.3, 1) both`, ...noMotion }}>
            <Typography id="hero-title" component="h1" sx={{ ...displaySx, maxWidth: 720 }}>
              Mové lo que necesitás, <Box component="span" sx={{ color: color.orangeInk }}>con todo claro</Box>.
            </Typography>
            <Typography sx={{ mt: 2.5, maxWidth: 540, ...leadSx }}>
              Indicá tu recorrido y coordinamos el servicio con vos. Tu solicitud queda registrada para que el equipo pueda confirmar disponibilidad y condiciones.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3.5 }}>
              <Button
                component="a"
                href="#solicitar"
                variant="contained"
                color="secondary"
                size="large"
                endIcon={<ArrowForward />}
                sx={{ minHeight: 50, px: 3, width: { xs: '100%', sm: 'auto' } }}
              >
                Solicitar mi flete
              </Button>
              <Button
                component="a"
                href={waLink(FLETES_WHATSAPP, WHATSAPP_REQUEST_MESSAGE)}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                size="large"
                startIcon={<WhatsAppIcon size={18} />}
                sx={{
                  minHeight: 50,
                  width: { xs: '100%', sm: 'auto' },
                  color: color.green,
                  borderColor: 'rgba(47, 125, 85, 0.35)',
                  '&:hover': { borderColor: color.green, bgcolor: color.greenSoft },
                }}
              >
                Hablar por WhatsApp
              </Button>
            </Stack>
            <Typography sx={{ mt: 1.5, color: brand.muted, fontSize: type.caption }}>
              Sin crear cuenta. No se genera ningún pago al enviar la solicitud.
            </Typography>

            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={{ xs: 1.5, md: 2.5 }} sx={{ mt: { xs: 4, md: 5 } }}>
              <TrustPoint text="Datos claros desde el inicio" />
              <TrustPoint text="Coordinación humana" />
              <TrustPoint text="Seguimiento de tu solicitud" />
            </Stack>
          </Box>

          <Box
            id="solicitar"
            sx={{
              minWidth: 0,
              scrollMarginTop: { xs: '88px', md: '104px' },
              animation: `${rise} 720ms cubic-bezier(0.16, 1, 0.3, 1) both`,
              animationDelay: '120ms',
              ...noMotion,
            }}
          >
            <Box
              sx={{
                width: '100%',
                maxWidth: 620,
                mx: { xs: 'auto', lg: 0 },
                ml: { lg: 'auto' },
                bgcolor: '#fff',
                border: `1px solid ${brand.border}`,
                borderRadius: 4,
                p: { xs: 2.5, sm: 3.5, md: 4 },
                boxShadow: '0 24px 60px rgba(19, 43, 74, 0.10)',
              }}
            >
              {step === 'request' && (
                <RequestForm
                  name={name}
                  phone={phone}
                  date={date}
                  arrivalFrom={arrivalFrom}
                  origin={origin}
                  destination={destination}
                  originPlace={originPlace}
                  destinationPlace={destinationPlace}
                  cargo={cargo}
                  notes={notes}
                  busy={busy}
                  errors={errors}
                  touched={touched}
                  onBlur={onFieldBlur}
                  setName={setName}
                  setPhone={setPhone}
                  setDate={setDate}
                  setArrivalFrom={setArrivalFrom}
                  setOrigin={setOrigin}
                  setDestination={setDestination}
                  setOriginPlace={setOriginPlace}
                  setDestinationPlace={setDestinationPlace}
                  setCargo={setCargo}
                  setNotes={setNotes}
                  onSubmit={submitRequest}
                />
              )}
              {step === 'sent' && <SuccessState onNewRequest={() => setStep('request')} />}
            </Box>
          </Box>
        </Box>

        <VideoSection
          videoRef={videoRef}
          playing={videoPlaying}
          muted={videoMuted}
          autoPlay={!reduceMotion}
          onToggle={toggleVideo}
          onToggleSound={toggleVideoSound}
          onPlay={() => setVideoPlaying(true)}
          onPause={() => setVideoPlaying(false)}
        />
        <AboutSection />
        <HowItWorksSection />
        <ReviewsSection />
      </Box>

      <LandingFooter />
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </Box>
  )
}

function LandingHeader() {
  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        bgcolor: brand.cream,
        borderBottom: `1px solid ${brand.border}`,
      }}
    >
      <Box sx={{ ...containerSx, py: { xs: 1.5, md: 1.75 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Brand subtitle="Mudanzas y fletes" />

          <Stack component="nav" aria-label="Navegación principal" direction="row" spacing={{ xs: 1, md: 3 }} alignItems="center">
            <Stack direction="row" spacing={{ xs: 0, md: 2.5 }} sx={{ display: { xs: 'none', md: 'flex' } }}>
              <NavLink href="#servicio">El servicio</NavLink>
              <NavLink href="#como-funciona">Cómo funciona</NavLink>
              <NavLink href="#opiniones">Opiniones</NavLink>
            </Stack>

            <Button
              component="a"
              href={waLink(FLETES_WHATSAPP, WHATSAPP_REQUEST_MESSAGE)}
              target="_blank"
              rel="noreferrer"
              size="small"
              startIcon={<WhatsAppIcon size={17} />}
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                color: color.green,
                fontWeight: 800,
                whiteSpace: 'nowrap',
                '&:hover': { bgcolor: color.greenSoft },
              }}
            >
              WhatsApp
            </Button>
            <IconButton
              component="a"
              href={waLink(FLETES_WHATSAPP, WHATSAPP_REQUEST_MESSAGE)}
              target="_blank"
              rel="noreferrer"
              aria-label="Escribir por WhatsApp"
              sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: color.green, width: 44, height: 44 }}
            >
              <WhatsAppIcon size={21} />
            </IconButton>

            <Button
              component="a"
              href={R.ingreso}
              variant="outlined"
              size="small"
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                whiteSpace: 'nowrap',
                minHeight: { xs: 44, sm: 40 },
                px: { xs: 1.5, sm: 2 },
              }}
            >
              Iniciar sesión
            </Button>
            <IconButton
              component="a"
              href={R.ingreso}
              aria-label="Iniciar sesión"
              sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: brand.navy, width: 44, height: 44 }}
            >
              <Login sx={{ fontSize: 21 }} />
            </IconButton>

            <Button
              component="a"
              href="#solicitar"
              variant="contained"
              size="small"
              sx={{ minHeight: { xs: 44, sm: 40 }, whiteSpace: 'nowrap', px: { xs: 1.5, sm: 2 } }}
            >
              Solicitar flete
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  )
}

function NavLink({ href, children }: Readonly<{ href: string; children: React.ReactNode }>) {
  return (
    <Link
      href={href}
      underline="none"
      color="inherit"
      sx={{
        fontSize: type.body,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        '&:hover': { color: color.orangeInk },
      }}
    >
      {children}
    </Link>
  )
}

function TrustPoint({ text }: Readonly<{ text: string }>) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: color.ink }}>
      <CheckCircleOutline sx={{ fontSize: 18, color: color.orangeInk }} aria-hidden="true" />
      <Typography sx={{ fontSize: type.body, fontWeight: 600 }}>{text}</Typography>
    </Stack>
  )
}

function VideoSection({
  videoRef,
  playing,
  muted,
  autoPlay,
  onToggle,
  onToggleSound,
  onPlay,
  onPause,
}: Readonly<{
  videoRef: React.RefObject<HTMLVideoElement>
  playing: boolean
  muted: boolean
  autoPlay: boolean
  onToggle: () => void
  onToggleSound: () => void
  onPlay: () => void
  onPause: () => void
}>) {
  return (
    <Box
      component="section"
      aria-labelledby="video-title"
      sx={{
        bgcolor: brand.navy,
        color: '#fff',
        py: { xs: 6, md: 8, lg: 'clamp(64px, 4.5vw, 88px)' },
      }}
    >
      <Box
        sx={{
          ...containerSx,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 0.82fr) minmax(0, 1.18fr)' },
          gap: { xs: 4, md: 6, lg: 8 },
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography id="video-title" component="h2" sx={{ ...sectionTitleSx, color: '#fff' }}>
            Así se mueve un flete con nosotros.
          </Typography>
          <Typography sx={{ mt: 2, color: 'rgba(255, 255, 255, 0.78)', fontSize: 'clamp(1rem, 0.85vw, 1.15rem)', lineHeight: 1.65, maxWidth: 460 }}>
            Un vistazo al trabajo en movimiento: el recorrido, la carga y la coordinación que hacen que todo llegue en orden.
          </Typography>
          <Button
            component="a"
            href="#solicitar"
            variant="contained"
            color="secondary"
            endIcon={<ArrowForward />}
            sx={{ mt: 3.5, minHeight: 48 }}
          >
            Quiero coordinar el mío
          </Button>
        </Box>

        <Box
          sx={{
            position: 'relative',
            minWidth: 0,
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            boxShadow: '0 30px 70px rgba(0, 0, 0, 0.35)',
            bgcolor: color.navyDeep,
          }}
        >
          <video
            ref={videoRef}
            src={landingVideo}
            autoPlay={autoPlay}
            muted={muted}
            loop
            playsInline
            preload="metadata"
            aria-label="Video de un servicio de mudanza en marcha"
            onPlay={onPlay}
            onPause={onPause}
            style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' }}
          />
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'linear-gradient(180deg, rgba(14, 33, 64, 0) 55%, rgba(14, 33, 64, 0.58) 100%)',
            }}
          />
          <Stack
            direction="row"
            spacing={1}
            sx={{
              position: 'absolute',
              right: { xs: 12, md: 16 },
              bottom: { xs: 12, md: 16 },
            }}
          >
            <IconButton
              onClick={onToggleSound}
              aria-label={muted ? 'Activar sonido' : 'Silenciar video'}
              sx={{
                width: 48,
                height: 48,
                bgcolor: 'rgba(14, 33, 64, 0.78)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                '&:hover': { bgcolor: color.navyDeep },
              }}
            >
              {muted ? <VolumeOff /> : <VolumeUp />}
            </IconButton>
            <IconButton
              onClick={onToggle}
              aria-label={playing ? 'Pausar el video' : 'Reproducir el video'}
              sx={{
                width: 48,
                height: 48,
                bgcolor: 'rgba(14, 33, 64, 0.78)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                '&:hover': { bgcolor: color.navyDeep },
              }}
            >
              {playing ? <Pause /> : <PlayArrow />}
            </IconButton>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}

function ContactForm({ name, phone, setName, setPhone, errors, touched, onBlur }: ContactFormProps) {
  return (
    <>
      <LandingTextField
        id="landing-name"
        label="Nombre y apellido"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => onBlur('name')}
        error={touched.name ? errors.name : undefined}
        autoComplete="name"
      />
      <LandingTextField
        id="landing-phone"
        label="Teléfono"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        onBlur={() => onBlur('phone')}
        placeholder="1155550000"
        error={touched.phone ? errors.phone : undefined}
        autoComplete="tel"
      />
    </>
  )
}

function RequestForm({
  name,
  phone,
  date,
  arrivalFrom,
  origin,
  destination,
  originPlace,
  destinationPlace,
  cargo,
  notes,
  busy,
  errors,
  touched,
  onBlur,
  setName,
  setPhone,
  setDate,
  setArrivalFrom,
  setOrigin,
  setDestination,
  setOriginPlace,
  setDestinationPlace,
  setCargo,
  setNotes,
  onSubmit,
}: RequestFormProps & ContactFormProps) {
  const changeOrigin = (value: string) => {
    setOrigin(value)
    if (originPlace && value !== originPlace.address) setOriginPlace(null)
  }
  const changeDestination = (value: string) => {
    setDestination(value)
    if (destinationPlace && value !== destinationPlace.address) setDestinationPlace(null)
  }

  const errorFor = (field: LandingField) => (touched[field] ? errors[field] : undefined)

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Typography component="h2" variant="h5" sx={{ fontSize: { xs: 22, md: 24 }, letterSpacing: '-0.02em' }}>
        Solicitá tu flete
      </Typography>
      <Typography sx={{ mt: 0.8, color: brand.muted, fontSize: type.body, lineHeight: 1.55 }}>
        Dejanos tus datos y completá el recorrido. No necesitás crear una cuenta.
      </Typography>

      <Box sx={{ mt: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 1.75, sm: 2 } }}>
        <ContactForm name={name} phone={phone} setName={setName} setPhone={setPhone} errors={errors} touched={touched} onBlur={onBlur} />

        <Box sx={{ gridColumn: { xs: 'auto', sm: '1 / -1' }, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: { xs: 1.75, sm: 2 } }}>
          <LandingTextField
            id="landing-date"
            label="Día del servicio"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            onBlur={() => onBlur('date')}
            error={errorFor('date')}
            InputLabelProps={{ shrink: true }}
          />
          <LandingTextField
            id="landing-arrival-from"
            label="Desde las"
            type="time"
            value={arrivalFrom}
            onChange={(event) => setArrivalFrom(event.target.value)}
            onBlur={() => onBlur('arrivalFrom')}
            error={errorFor('arrivalFrom')}
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        <Box sx={{ gridColumn: '1 / -1' }}>
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
        </Box>
        <Box sx={{ gridColumn: '1 / -1' }}>
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
        </Box>

        <Box sx={{ gridColumn: '1 / -1' }}>
          <LandingTextField
            id="landing-cargo"
            label="¿Qué hay que trasladar?"
            value={cargo}
            onChange={(event) => setCargo(event.target.value)}
            onBlur={() => onBlur('cargo')}
            error={errorFor('cargo')}
            multiline
            minRows={2}
          />
        </Box>
        <Box sx={{ gridColumn: '1 / -1' }}>
          <LandingTextField
            id="landing-notes"
            label="Observaciones (opcional)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            multiline
            minRows={1}
          />
        </Box>

        <Box sx={{ gridColumn: '1 / -1' }}>
          <Button type="submit" variant="contained" color="secondary" size="large" fullWidth disabled={busy} endIcon={<ArrowForward />} sx={{ minHeight: 50 }}>
            {busy ? 'Enviando...' : 'Enviar solicitud'}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

function LandingTextField({ id, label, error, ...props }: { id: string; label: string; error?: string } & Omit<React.ComponentProps<typeof TextField>, 'id' | 'label' | 'error'>) {
  return (
    <Box>
      <EtiquetaCampo text={label} htmlFor={id} />
      <TextField
        {...props}
        id={id}
        fullWidth
        error={Boolean(error)}
        inputProps={{ ...props.inputProps, 'aria-describedby': error ? `${id}-error` : undefined }}
      />
      <MensajeCampo id={`${id}-error`} mensaje={error} />
    </Box>
  )
}

function SuccessState({ onNewRequest }: Readonly<{ onNewRequest: () => void }>) {
  return (
    <Stack spacing={2} alignItems="flex-start">
      <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: color.greenSoft, color: color.green, display: 'grid', placeItems: 'center' }}>
        <CheckCircleOutline sx={{ fontSize: 32 }} aria-hidden="true" />
      </Box>
      <Typography component="h2" variant="h5" sx={{ fontSize: 24 }}>
        Ya recibimos tu solicitud.
      </Typography>
      <Typography sx={{ color: color.ink, lineHeight: 1.6 }}>
        El equipo va a revisar disponibilidad y se va a poner en contacto para confirmar los detalles del servicio.
      </Typography>
      <Alert severity="success" sx={{ width: '100%' }}>
        No se generó ningún pago en este paso.
      </Alert>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: '100%' }}>
        <Button variant="outlined" onClick={onNewRequest} endIcon={<ArrowForward />}>
          Solicitar otro flete
        </Button>
        <Button
          component="a"
          href={waLink(FLETES_WHATSAPP, WHATSAPP_REQUEST_MESSAGE)}
          target="_blank"
          rel="noreferrer"
          startIcon={<WhatsAppIcon size={18} />}
          sx={{ color: color.green }}
        >
          Escribirnos
        </Button>
      </Stack>
    </Stack>
  )
}

function AboutSection() {
  return (
    <Box
      component="section"
      id="servicio"
      aria-labelledby="about-title"
      sx={{
        ...containerSx,
        scrollMarginTop: { xs: '88px', md: '104px' },
        mt: { xs: 8, md: 12, lg: 'clamp(96px, 7vw, 128px)' },
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: { xs: 5, md: 7, lg: 'clamp(56px, 4.5vw, 88px)' },
        alignItems: 'center',
      }}
    >
      <Box sx={{ position: 'relative', minWidth: 0 }}>
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            right: { xs: -8, md: -18 },
            bottom: { xs: -8, md: -18 },
            width: '58%',
            height: '58%',
            borderRadius: 3,
            bgcolor: color.orange,
            opacity: 0.14,
          }}
        />
        <Box
          component="img"
          src="https://images.unsplash.com/photo-1600518464441-9154a4dea21b?auto=format&fit=crop&w=1400&q=85"
          alt="Equipo preparando cajas para una mudanza"
          loading="lazy"
          decoding="async"
          sx={{
            position: 'relative',
            display: 'block',
            width: '100%',
            aspectRatio: '4 / 3',
            objectFit: 'cover',
            borderRadius: 3,
            border: `1px solid ${brand.border}`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            left: { xs: 16, md: -20 },
            bottom: { xs: 16, md: 24 },
            maxWidth: 240,
            bgcolor: '#fff',
            border: `1px solid ${brand.border}`,
            borderRadius: 2,
            px: 2.5,
            py: 2,
            boxShadow: '0 8px 24px rgba(19, 43, 74, 0.10)',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color.orange }} />
            <Typography sx={{ fontWeight: 800, fontSize: type.caption }}>Trato directo</Typography>
          </Stack>
          <Typography sx={{ mt: 0.5, color: brand.muted, fontSize: type.caption, lineHeight: 1.45 }}>
            Coordinación de punta a punta.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography id="about-title" component="h2" sx={sectionTitleSx}>
          Una forma más clara de coordinar tu mudanza
        </Typography>
        <Typography sx={{ mt: 2, maxWidth: 520, ...leadSx }}>
          Te ayudamos a ordenar el recorrido, los tiempos y la información importante antes de que el equipo salga a trabajar.
        </Typography>
        <Stack spacing={1.75} sx={{ mt: 3.5 }}>
          <AboutPoint icon={<VerifiedUser />} text="Datos del servicio claros desde el primer contacto." />
          <AboutPoint icon={<SupportAgent />} text="Acompañamiento humano para coordinar cada detalle." />
          <AboutPoint icon={<Route />} text="Un recorrido real para tomar mejores decisiones." />
        </Stack>
      </Box>
    </Box>
  )
}

function AboutPoint({ icon, text }: Readonly<{ icon: React.ReactNode; text: string }>) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box sx={{ color: color.orangeInk, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{icon}</Box>
      <Typography sx={{ color: color.ink, fontSize: type.body, lineHeight: 1.5 }}>{text}</Typography>
    </Stack>
  )
}

function HowItWorksSection() {
  const steps = [
    { number: '01', icon: <MapOutlined />, title: 'Indicás origen y destino', text: 'Buscás las direcciones reales y elegís una sugerencia para ubicar cada punto.' },
    { number: '02', icon: <Straighten />, title: 'Estimamos el recorrido', text: 'Calculamos distancia y duración aproximada para que tengas una referencia antes de coordinar.' },
    { number: '03', icon: <CheckCircleOutline />, title: 'Confirmás la solicitud', text: 'Revisamos disponibilidad y nos ponemos en contacto para cerrar los detalles.' },
  ]

  return (
    <Box
      component="section"
      id="como-funciona"
      aria-labelledby="how-title"
      sx={{
        mt: { xs: 9, md: 13, lg: 'clamp(104px, 7.5vw, 144px)' },
        scrollMarginTop: { xs: '88px', md: '104px' },
        py: { xs: 6, md: 8, lg: 'clamp(64px, 4.5vw, 88px)' },
        bgcolor: color.sandDeep,
        borderTop: `1px solid ${brand.border}`,
        borderBottom: `1px solid ${brand.border}`,
      }}
    >
      <Box sx={containerSx}>
        <Box sx={{ maxWidth: 700 }}>
          <Typography id="how-title" component="h2" sx={sectionTitleSx}>
            Del recorrido a la coordinación
          </Typography>
          <Typography sx={{ mt: 1.5, maxWidth: 620, ...leadSx }}>
            Tres pasos simples para pedir un flete con mejor información.
          </Typography>
        </Box>

        <Box
          sx={{
            mt: { xs: 5, md: 6 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: { xs: 4, md: 4, lg: 'clamp(32px, 3vw, 56px)' },
          }}
        >
          {steps.map((step) => (
            <Step key={step.number} {...step} />
          ))}
        </Box>
      </Box>
    </Box>
  )
}

function Step({ number, icon, title, text }: Readonly<{ number: string; icon: React.ReactNode; title: string; text: string }>) {
  return (
    <Box sx={{ position: 'relative', borderTop: `1px solid ${brand.border}`, pt: 3 }}>
      <Box
        aria-hidden="true"
        sx={{ position: 'absolute', top: -4, left: 0, width: 8, height: 8, borderRadius: '50%', bgcolor: color.orange }}
      />
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Typography
          sx={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
            fontSize: { xs: 40, md: 48, lg: 'clamp(48px, 3.2vw, 64px)' },
            lineHeight: 1,
            letterSpacing: '-0.04em',
            color: color.orangeInk,
          }}
        >
          {number}
        </Typography>
        <Box sx={{ color: color.orangeInk, display: 'grid', placeItems: 'center', mt: 0.5 }}>{icon}</Box>
      </Stack>
      <Typography component="h3" variant="h6" sx={{ mt: 2.5, fontSize: { xs: 18, md: 20 } }}>
        {title}
      </Typography>
      <Typography sx={{ mt: 1, color: color.ink, fontSize: type.body, lineHeight: 1.6, maxWidth: 340 }}>{text}</Typography>
    </Box>
  )
}

function ReviewsSection() {
  const reviews = [
    { name: 'Sofía', place: 'Villa Crespo', text: 'Pude dejar el recorrido claro desde el principio y coordinar el servicio sin idas y vueltas.' },
    { name: 'Alejandro', place: 'Ramos Mejía', text: 'La estimación del trayecto me ayudó a organizar mejor los horarios de la mudanza.' },
    { name: 'Marcela', place: 'Chivilcoy', text: 'Buena atención, respuestas claras y un equipo que entendió lo que necesitábamos mover.' },
  ]
  const [featured, ...others] = reviews

  return (
    <Box
      component="section"
      id="opiniones"
      aria-labelledby="reviews-title"
      sx={{
        ...containerSx,
        mt: { xs: 9, md: 13, lg: 'clamp(104px, 7.5vw, 144px)' },
        scrollMarginTop: { xs: '88px', md: '104px' },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.15fr) minmax(0, 0.85fr)' },
          gap: { xs: 5, md: 7, lg: 10 },
          alignItems: 'center',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography id="reviews-title" component="h2" sx={sectionTitleSx}>
            Cuando coordinar se siente simple
          </Typography>

          <Box sx={{ position: 'relative', mt: { xs: 4, md: 5 }, pl: { xs: 0, sm: 5 } }}>
            <Typography
              aria-hidden="true"
              sx={{
                position: 'absolute',
                left: 0,
                top: -14,
                fontFamily: "'Manrope', sans-serif",
                fontSize: 88,
                lineHeight: 1,
                color: color.orange,
                opacity: 0.4,
                display: { xs: 'none', sm: 'block' },
              }}
            >
              “
            </Typography>
            <Typography
              sx={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 600,
                fontSize: 'clamp(1.35rem, 1.8vw, 1.9rem)',
                lineHeight: 1.38,
                letterSpacing: '-0.02em',
                color: brand.navy,
                maxWidth: 620,
              }}
            >
              “{featured.text}”
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 3 }}>
              <Avatar name={featured.name} />
              <Box>
                <Typography sx={{ fontWeight: 800 }}>{featured.name}</Typography>
                <Typography sx={{ color: brand.muted, fontSize: type.caption }}>{featured.place}</Typography>
              </Box>
            </Stack>
            <Stars />
          </Box>
        </Box>

        <Stack spacing={3} sx={{ justifyContent: 'center' }}>
          {others.map((review) => (
            <Box key={review.name} sx={{ borderTop: `1px solid ${brand.border}`, pt: 2.5 }}>
              <Typography sx={{ color: color.ink, fontSize: type.lead, lineHeight: 1.6 }}>“{review.text}”</Typography>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 2 }}>
                <Avatar name={review.name} small />
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: type.body }}>{review.name}</Typography>
                  <Typography sx={{ color: brand.muted, fontSize: type.caption }}>{review.place}</Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  )
}

function Avatar({ name, small = false }: Readonly<{ name: string; small?: boolean }>) {
  const size = small ? 34 : 44
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: color.navy,
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontFamily: "'Manrope', sans-serif",
        fontWeight: 800,
        fontSize: small ? 14 : 17,
        flexShrink: 0,
      }}
    >
      {name.charAt(0)}
    </Box>
  )
}

function Stars() {
  return (
    <Stack direction="row" spacing={0.25} sx={{ mt: 2, color: color.amber }} role="img" aria-label="5 de 5 estrellas">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} sx={{ fontSize: 18 }} aria-hidden="true" />
      ))}
    </Stack>
  )
}

function LandingFooter() {
  return (
    <Box component="footer" id="contacto" sx={{ mt: { xs: 9, md: 13 }, bgcolor: brand.navy, color: '#fff', scrollMarginTop: { xs: '88px', md: '104px' } }}>
      <Box sx={{ ...containerSx, py: { xs: 6, md: 8, lg: 'clamp(64px, 4.5vw, 88px)' } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr 1fr' },
            gap: { xs: 5, md: 6 },
            alignItems: 'start',
          }}
        >
          <Box>
            <FooterBrand />
            <Typography sx={{ mt: 2, maxWidth: 360, color: 'rgba(255, 255, 255, 0.74)', fontSize: type.lead, lineHeight: 1.6 }}>
              Coordinación clara para cada mudanza. Contanos qué necesitás mover y lo organizamos con vos.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
              <Button
                component="a"
                href={waLink(FLETES_WHATSAPP, WHATSAPP_REQUEST_MESSAGE)}
                target="_blank"
                rel="noreferrer"
                variant="contained"
                color="secondary"
                startIcon={<WhatsAppIcon size={18} />}
              >
                Escribir por WhatsApp
              </Button>
              <Button
                component="a"
                href="#solicitar"
                variant="outlined"
                sx={{
                  color: '#fff',
                  borderColor: 'rgba(255, 255, 255, 0.35)',
                  '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255, 255, 255, 0.06)' },
                }}
              >
                Solicitar flete
              </Button>
            </Stack>
          </Box>

          <FooterColumn title="Navegación">
            <FooterLink href="#servicio">El servicio</FooterLink>
            <FooterLink href="#como-funciona">Cómo funciona</FooterLink>
            <FooterLink href="#opiniones">Opiniones</FooterLink>
            <FooterLink href="#solicitar">Solicitar flete</FooterLink>
          </FooterColumn>

          <FooterColumn title="Contacto">
            <Link href={`tel:+541145001287`} underline="hover" color="inherit" sx={{ fontSize: type.body, fontWeight: 600 }}>
              {FLETES_WHATSAPP}
            </Link>
            <Link
              href={waLink(FLETES_WHATSAPP, WHATSAPP_REQUEST_MESSAGE)}
              target="_blank"
              rel="noreferrer"
              underline="hover"
              color="inherit"
              sx={{ fontSize: type.body, fontWeight: 600 }}
            >
              WhatsApp
            </Link>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.68)', fontSize: type.body }}>Buenos Aires, Argentina</Typography>
          </FooterColumn>
        </Box>
      </Box>

      <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.16)' }}>
        <Box
          sx={{
            ...containerSx,
            py: 2.5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.68)', fontSize: type.caption }}>
            © {new Date().getFullYear()} Fletes Express. Acceso y coordinación de servicios.
          </Typography>
          <Button
            onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
            startIcon={<ArrowUpward />}
            sx={{ color: '#fff', minHeight: 44, '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.06)' } }}
          >
            Volver arriba
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

function FooterBrand() {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: 2,
          bgcolor: '#fff',
          color: brand.navy,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <LocalShipping sx={{ fontSize: 22 }} aria-hidden="true" />
      </Box>
      <Box>
        <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 17, lineHeight: 1.1 }}>
          Fletes Express
        </Typography>
        <Typography sx={{ mt: 0.4, color: 'rgba(255, 255, 255, 0.68)', fontSize: type.caption }}>Mudanzas y fletes</Typography>
      </Box>
    </Stack>
  )
}

function FooterColumn({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 800, fontSize: type.caption, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.58)' }}>
        {title}
      </Typography>
      <Stack spacing={1.25} sx={{ mt: 2 }}>
        {children}
      </Stack>
    </Box>
  )
}

function FooterLink({ href, children }: Readonly<{ href: string; children: React.ReactNode }>) {
  return (
    <Link href={href} underline="hover" color="inherit" sx={{ fontSize: type.body, fontWeight: 600 }}>
      {children}
    </Link>
  )
}
