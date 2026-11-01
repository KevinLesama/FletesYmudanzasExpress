import { useEffect, useState, type FocusEvent } from 'react'
import {
  Box,
  Button,
  Collapse,
  Fade,
  FormHelperText,
  MenuItem,
  Select,
  Stepper,
  Step,
  StepLabel,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { ArrowBack, Check, ErrorOutline, InfoOutlined, ArrowForward } from '@mui/icons-material'
import { AppShell, SECCION_BREADCRUMB } from '../components/AppShell'
import { PlaceAutocomplete } from '../components/PlaceAutocomplete'
import { Toast, type ToastState } from '../components/Toast'
import { R } from '../routes'
import { api } from '../api'
import { useAsync } from '../useAsync'
import type { Client, PlaceDetail } from '../types'
import { brand } from '../theme'
import { radius, type as typeScale } from '../design/tokens'
import { filtrarTelefono, validarTelefono } from '../utils/telefono'

const ANCHO_FORMULARIO = 1200
const ESPACIO = {
  label: 0.5,
  tituloCampo: 0.75,
  campo: 1.5,
  grupo: 2,
  seccion: 2.5,
  card: 2.5,
} as const

const fieldSx = {
  '& .MuiOutlinedInput-root:not(.MuiInputBase-multiline)': {
    height: 48,
    borderRadius: `${radius.md}px`,
    fontSize: typeScale.lead,
  },
  '& .MuiOutlinedInput-root.MuiInputBase-multiline': {
    minHeight: 48,
    borderRadius: `${radius.md}px`,
    fontSize: typeScale.lead,
  },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider', borderWidth: '1px' },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'divider',
    borderWidth: '1px',
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'secondary.dark',
    borderWidth: '1px',
  },
  '& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline, & .MuiOutlinedInput-root.Mui-error.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'error.main',
    borderWidth: '1px',
  },
  '& .MuiOutlinedInput-input': { fontSize: typeScale.lead },
  '& .MuiOutlinedInput-input::placeholder': { opacity: 1, color: 'text.disabled' },
}

const actionButtonSx = {
  height: 40,
  minHeight: 40,
  borderRadius: `${radius.md}px`,
  fontSize: typeScale.body,
  fontWeight: 700,
  textTransform: 'none',
}

const fieldLabelSx = {
  display: 'block',
  mb: ESPACIO.label,
  fontSize: typeScale.body,
  lineHeight: 1.3,
  fontWeight: 500,
  color: 'text.primary',
  opacity: 0.72,
}

const sectionTitleSx = {
  mb: ESPACIO.tituloCampo,
  fontSize: typeScale.body,
  fontWeight: 700,
  color: 'text.primary',
  letterSpacing: 'normal',
}

function TituloSeccion({ text }: { text: string }) {
  return <Typography sx={sectionTitleSx}>{text}</Typography>
}

function FieldLabel({ text, htmlFor, id }: { text: string; htmlFor?: string; id?: string }) {
  const content = text
  return htmlFor ? (
    <Typography component="label" htmlFor={htmlFor} id={id} sx={fieldLabelSx}>{content}</Typography>
  ) : (
    <Typography id={id} sx={fieldLabelSx}>{content}</Typography>
  )
}

function FieldMessage({
  id,
  message,
  duracionError,
}: {
  id: string
  message: string | null
  duracionError: number
}) {
  const [lastMessage, setLastMessage] = useState(message)

  useEffect(() => {
    if (message) setLastMessage(message)
  }, [message])

  return (
    <Collapse in={Boolean(message)} timeout={duracionError} sx={{ mt: message ? ESPACIO.label : 0 }}>
      <Fade in={Boolean(message)} timeout={duracionError}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: ESPACIO.label }}>
          <ErrorOutline
            aria-hidden="true"
            sx={{ mt: '2px', fontSize: 16, color: 'error.main', flexShrink: 0 }}
          />
          <FormHelperText error id={id} sx={{ m: 0, fontSize: typeScale.caption }}>
            {lastMessage}
          </FormHelperText>
        </Box>
      </Fade>
    </Collapse>
  )
}

const toggleAcentoSx = {
  '& .MuiToggleButton-root': {
    height: 36,
    color: 'text.secondary',
    bgcolor: 'transparent',
    '&:hover': { bgcolor: 'action.hover' },
    '&.Mui-selected': {
      bgcolor: brand.orangeStrong,
      color: 'common.white',
      '&:hover': { bgcolor: brand.orangeInk },
    },
    '&.Mui-focusVisible': {
      outline: '2px solid',
      outlineColor: 'primary.main',
      outlineOffset: 2,
    },
  },
}

const PREGUNTA_NIVEL_CALLE = '¿Está a nivel de calle?'

const requierePisoYAscensor = (aNivelDeCalle: boolean | null) => aNivelDeCalle === false

const derivarPisoYAscensor = (
  aNivelDeCalle: boolean | null,
  piso: string,
  ascensor: 'Sí' | 'No' | null,
) => requierePisoYAscensor(aNivelDeCalle)
  ? { floor: piso, elevator: ascensor === 'Sí' }
  : { floor: '', elevator: false }

export function NuevaSolicitudPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const sinAnimacion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const duracionError = sinAnimacion ? 0 : 200
  const [step, setStep] = useState(0)
  const [validatedFields, setValidatedFields] = useState<Record<string, boolean>>({})

  const clientsState = useAsync(() => api.listClients(), [])
  const clients: Client[] = clientsState.data ?? []

  // client
  const [clientMode, setClientMode] = useState<'existente' | 'nuevo'>('existente')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')

  // service
  const [date, setDate] = useState('2026-09-26')
  const [arriveFrom, setArriveFrom] = useState('09:00')
  const [arriveTo, setArriveTo] = useState('11:00')
  const [originAddress, setOriginAddress] = useState('')
  const [originBarrio, setOriginBarrio] = useState('')
  const [originFloor, setOriginFloor] = useState('')
  const [originStreetLevel, setOriginStreetLevel] = useState<boolean | null>(null)
  const [originElevator, setOriginElevator] = useState<'Sí' | 'No' | null>(null)
  const [destAddress, setDestAddress] = useState('')
  const [destBarrio, setDestBarrio] = useState('')
  const [destFloor, setDestFloor] = useState('')
  const [destStreetLevel, setDestStreetLevel] = useState<boolean | null>(null)
  const [destElevator, setDestElevator] = useState<'Sí' | 'No' | null>(null)

  // Lugares elegidos en el autocompletado. Con placeId + coordenadas el backend
  // resuelve la direccion real y calcula el recorrido con Google Maps.
  const [originPlace, setOriginPlace] = useState<PlaceDetail | null>(null)
  const [destPlace, setDestPlace] = useState<PlaceDetail | null>(null)
  const [originGeoOk, setOriginGeoOk] = useState(false)
  const [destGeoOk, setDestGeoOk] = useState(false)

  // cargo
  const [cargoDesc, setCargoDesc] = useState('1 heladera, 1 sillón de 2 cuerpos desmontable y 10 cajas')
  const [cargoQty, setCargoQty] = useState('')
  const [fragile, setFragile] = useState<'Sí' | 'No'>('Sí')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (clientMode === 'existente' && !selectedClientId && clients.length > 0) {
      setSelectedClientId(String(clients[0].id))
    }
  }, [clientMode, selectedClientId, clients])

  const changeOriginAddress = (v: string) => {
    setOriginAddress(v)
    if (originPlace && v !== originPlace.address) setOriginPlace(null)
  }
  const changeDestAddress = (v: string) => {
    setDestAddress(v)
    if (destPlace && v !== destPlace.address) setDestPlace(null)
  }

  // El barrio solo se autocompleta si el usuario todavia no lo escribio.
  const pickOrigin = (place: PlaceDetail) => {
    setOriginPlace(place)
    setOriginAddress(place.address)
    setOriginBarrio((prev) => prev || place.locality || place.partido || '')
  }
  const pickDest = (place: PlaceDetail) => {
    setDestPlace(place)
    setDestAddress(place.address)
    setDestBarrio((prev) => prev || place.locality || place.partido || '')
  }

  const steps = ['Cliente', 'Servicio', 'Carga']

  const clearFieldError = (id: string) => {
    setValidatedFields((current) => ({ ...current, [id]: false }))
  }
  const validateFieldOnBlur = (id: string) => {
    setValidatedFields((current) => ({ ...current, [id]: true }))
  }

  const fieldErrors: Record<string, string | null> = {
    'existing-client': selectedClientId === '' ? 'Seleccioná un cliente.' : null,
    'new-client-name': newName.trim() === '' ? 'Ingresá el nombre y apellido.' : null,
    'new-client-phone': validarTelefono(newPhone),
    'service-date': date === '' ? 'Ingresá la fecha solicitada.' : null,
    'arrival-from': arriveFrom === '' ? 'Ingresá la hora de llegada desde.' : null,
    'arrival-until': arriveTo === '' ? 'Ingresá la hora de llegada hasta.' : null,
    'origin-address': originAddress.trim() === ''
      ? 'Ingresá la dirección.'
      : originGeoOk && !originPlace
        ? 'Elegí una sugerencia de la lista.'
        : null,
    'origin-street-level': originStreetLevel === null ? 'Elegí una opción.' : null,
    'origin-floor': requierePisoYAscensor(originStreetLevel) && originFloor.trim() === '' ? 'Ingresá el piso.' : null,
    'origin-elevator': requierePisoYAscensor(originStreetLevel) && originElevator === null ? 'Elegí una opción.' : null,
    'destination-address': destAddress.trim() === ''
      ? 'Ingresá la dirección.'
      : destGeoOk && !destPlace
        ? 'Elegí una sugerencia de la lista.'
        : null,
    'destination-street-level': destStreetLevel === null ? 'Elegí una opción.' : null,
    'destination-floor': requierePisoYAscensor(destStreetLevel) && destFloor.trim() === '' ? 'Ingresá el piso.' : null,
    'destination-elevator': requierePisoYAscensor(destStreetLevel) && destElevator === null ? 'Elegí una opción.' : null,
    'cargo-description': cargoDesc.trim() === '' ? 'Ingresá la descripción de la carga.' : null,
    'cargo-quantity': cargoQty.trim() === '' ? 'Ingresá la cantidad aproximada (bultos).' : null,
  }
  const visibleFieldErrors: Record<string, string | null> = {}
  Object.keys(fieldErrors).forEach((id) => {
    visibleFieldErrors[id] = validatedFields[id] ? fieldErrors[id] : null
  })

  const getStepErrors = (): Array<{ id: string; message: string }> => {
    const idsByStep = [
      clientMode === 'existente' ? ['existing-client'] : ['new-client-name', 'new-client-phone'],
      [
        'service-date', 'arrival-from', 'arrival-until',
        'origin-address', 'origin-street-level', 'origin-floor', 'origin-elevator',
        'destination-address', 'destination-street-level', 'destination-floor', 'destination-elevator',
      ],
      ['cargo-description', 'cargo-quantity'],
    ]
    return (idsByStep[step] ?? []).flatMap((id) => {
      const message = fieldErrors[id]
      return message ? [{ id, message }] : []
    })
  }

  const focusFirstInvalidField = (id: string) => {
    window.setTimeout(() => {
      const field = document.getElementById(id)
      const target = field?.matches('input, button, [role="combobox"], [tabindex]') ? field : field?.querySelector<HTMLElement>('input, button, [role="combobox"], [tabindex]')
      target?.scrollIntoView({ behavior: sinAnimacion ? 'auto' : 'smooth', block: 'center' })
      target?.focus({ preventScroll: true })
    }, 0)
  }

  const validateCurrentStep = () => {
    const errors = getStepErrors()
    if (errors.length === 0) return true
    setValidatedFields((current) => {
      const updated = { ...current }
      errors.forEach(({ id }) => { updated[id] = true })
      return updated
    })
    focusFirstInvalidField(errors[0].id)
    return false
  }

  const handleNext = () => {
    if (validateCurrentStep()) setStep((current) => current + 1)
  }
  const label = (txt: string, htmlFor?: string) => (
    <FieldLabel text={txt} htmlFor={htmlFor} />
  )

  const save = async () => {
    setSaving(true)
    try {
      let clientId: number | null = null
      let clientName = ''
      let phone = ''
      if (clientMode === 'existente') {
        clientId = Number(selectedClientId)
        const c = clients.find((x) => String(x.id) === selectedClientId)
        clientName = c?.name ?? ''
        phone = c?.phone ?? ''
      } else {
        const clientPhone = newPhone.trim()
        const created = await api.createClient({
          name: newName.trim(),
          phone: clientPhone.startsWith('+') ? clientPhone : `+54${clientPhone}`,
        })
        clientId = created.id
        clientName = created.name
        phone = created.phone
      }

      const created = await api.createRequest({
        client_id: clientId,
        client_name: clientName,
        phone,
        date,
        arrival_from: arriveFrom,
        arrival_to: arriveTo,
        service_from: arriveFrom,
        service_to: arriveTo,
        origin: {
          address: originAddress,
          barrio: originBarrio,
          ...derivarPisoYAscensor(originStreetLevel, originFloor, originElevator),
          placeId: originPlace?.placeId,
          lat: originPlace?.lat,
          lng: originPlace?.lng,
        },
        destination: {
          address: destAddress,
          barrio: destBarrio,
          ...derivarPisoYAscensor(destStreetLevel, destFloor, destElevator),
          placeId: destPlace?.placeId,
          lat: destPlace?.lat,
          lng: destPlace?.lng,
        },
        cargo: {
          items: [],
          approx_units: Number(cargoQty || 0),
          fragile: fragile === 'Sí',
          notes: cargoDesc + (notes ? ` · ${notes}` : ''),
        },
      })

      setToast({ message: `Solicitud guardada · ${created.id}`, tone: 'success' })
      setTimeout(() => {
        window.location.href = R.planificacion(created.id)
      }, 1400)
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'No pudimos guardar la solicitud.', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    if (validateCurrentStep()) void save()
  }

  return (
    <>
      <AppShell
        active="solicitudes"
        breadcrumb={[SECCION_BREADCRUMB, 'Solicitudes', 'Nueva solicitud']}
        kicker="Gestión de pedidos"
        title="Nueva solicitud"
        description="Completá los datos para revisar disponibilidad y condiciones."
      >
        <Box sx={{ width: '100%', maxWidth: ANCHO_FORMULARIO, mx: 'auto', mt: -ESPACIO.label }}>
          {isMobile ? (
            <Stepper activeStep={step} orientation="vertical" sx={{ mb: ESPACIO.grupo, width: '100%' }}>
              {steps.map((s) => (
                <Step key={s}>
                  <StepLabel>{s}</StepLabel>
                </Step>
              ))}
            </Stepper>
          ) : (
            <Stack direction="row" alignItems="center" spacing={ESPACIO.tituloCampo} sx={{ mb: ESPACIO.grupo }}>
              {steps.map((s, index) => (
                <Stack key={s} direction="row" alignItems="center" spacing={ESPACIO.tituloCampo}>
                  <Stack direction="row" alignItems="center" spacing={ESPACIO.tituloCampo}>
                    <Box
                      aria-current={index === step ? 'step' : undefined}
                      sx={{
                        width: 28,
                        height: 28,
                        flexShrink: 0,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: index <= step ? 'primary.main' : 'action.disabledBackground',
                        color: index <= step ? 'common.white' : 'text.disabled',
                        fontSize: typeScale.body,
                        fontWeight: 700,
                      }}
                    >
                      {index < step ? <Check sx={{ fontSize: 18 }} /> : index + 1}
                    </Box>
                    <Typography
                      sx={{
                        whiteSpace: 'nowrap',
                        fontWeight: index === step ? 700 : 400,
                        color: index === step ? 'text.primary' : 'text.secondary',
                      }}
                    >
                      {s}
                    </Typography>
                  </Stack>
                  {index < steps.length - 1 && (
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 56,
                        height: '1px',
                        bgcolor: index < step ? 'primary.main' : 'divider',
                      }}
                    />
                  )}
                </Stack>
              ))}
            </Stack>
          )}

          <Box sx={{ width: '100%' }}>
            <Box sx={{ width: '100%', bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, p: ESPACIO.card }}>
            {step === 0 && (
              <>
                <StepHeading n="01" title="Cliente" subtitle="Datos de contacto para coordinar el servicio." />
                <ToggleButtonGroup
                  value={clientMode}
                  exclusive
                  onChange={(_, v) => v && setClientMode(v)}
                  size="small"
                  fullWidth
                  sx={[toggleAcentoSx, { mb: ESPACIO.campo, '& .MuiToggleButton-root': { flex: 1 } }]}
                >
                  <ToggleButton value="existente">Cliente existente</ToggleButton>
                  <ToggleButton value="nuevo">Nuevo cliente</ToggleButton>
                </ToggleButtonGroup>

                {clientMode === 'existente' ? (
                  <Box>
                    <Box>
                      {label('Seleccionar cliente', 'existing-client')}
                      <Select
                        id="existing-client"
                        size="small"
                        value={selectedClientId}
                        error={Boolean(visibleFieldErrors['existing-client'])}
                        aria-describedby={visibleFieldErrors['existing-client'] ? 'existing-client-error' : undefined}
                        onBlur={() => validateFieldOnBlur('existing-client')}
                        onChange={(e) => {
                          setSelectedClientId(e.target.value)
                          clearFieldError('existing-client')
                        }}
                        sx={{ ...fieldSx, width: '100%' }}
                      >
                        {clients.map((c) => (
                          <MenuItem key={c.id} value={String(c.id)}>
                            {c.name} · {c.phone}
                          </MenuItem>
                        ))}
                      </Select>
                      <FieldMessage id="existing-client-error" message={visibleFieldErrors['existing-client']} duracionError={duracionError} />
                    </Box>
                  </Box>
                ) : (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={ESPACIO.campo} alignItems="flex-start">
                    <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                      {label('Nombre y apellido', 'new-client-name')}
                      <TextField
                        id="new-client-name"
                        value={newName}
                        onChange={(e) => {
                          setNewName(e.target.value)
                          clearFieldError('new-client-name')
                        }}
                        onBlur={() => validateFieldOnBlur('new-client-name')}
                        error={Boolean(visibleFieldErrors['new-client-name'])}
                        aria-describedby={visibleFieldErrors['new-client-name'] ? 'new-client-name-error' : undefined}
                        fullWidth
                        size="small"
                        placeholder="Ingresá el nombre del cliente."
                        sx={fieldSx}
                      />
                      <FieldMessage id="new-client-name-error" message={visibleFieldErrors['new-client-name']} duracionError={duracionError} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                      {label('Teléfono', 'new-client-phone')}
                      <TextField
                        id="new-client-phone"
                        value={newPhone}
                        onChange={(e) => {
                          setNewPhone(filtrarTelefono(e.target.value))
                          clearFieldError('new-client-phone')
                        }}
                        onBlur={() => validateFieldOnBlur('new-client-phone')}
                        error={Boolean(visibleFieldErrors['new-client-phone'])}
                        aria-describedby={visibleFieldErrors['new-client-phone'] ? 'new-client-phone-error' : undefined}
                        fullWidth
                        size="small"
                        placeholder="11 5555-0000"
                        sx={fieldSx}
                        inputProps={{ maxLength: 20, inputMode: 'tel' }}
                      />
                      <FieldMessage id="new-client-phone-error" message={visibleFieldErrors['new-client-phone']} duracionError={duracionError} />
                    </Box>
                  </Stack>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <StepHeading n="02" title="Servicio" subtitle="Fecha solicitada, horario aproximado y recorrido." compact />
                <Stack spacing={ESPACIO.seccion}>
                  <Stack spacing={0}>
                    <TituloSeccion text="Fecha y horario" />
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, columnGap: ESPACIO.grupo, rowGap: ESPACIO.campo }}>
                      <Box>
                        <FieldLabel text="Fecha solicitada" htmlFor="service-date" />
                        <TextField
                          id="service-date"
                          type="date"
                          value={date}
                          onChange={(e) => {
                            setDate(e.target.value)
                            clearFieldError('service-date')
                          }}
                          onBlur={() => validateFieldOnBlur('service-date')}
                          error={Boolean(visibleFieldErrors['service-date'])}
                          aria-describedby={visibleFieldErrors['service-date'] ? 'service-date-error' : undefined}
                          size="small"
                          fullWidth
                          sx={fieldSx}
                        />
                        <FieldMessage id="service-date-error" message={visibleFieldErrors['service-date']} duracionError={duracionError} />
                      </Box>
                      <Box>
                        <FieldLabel text="Llegada desde" htmlFor="arrival-from" />
                        <TextField
                          id="arrival-from"
                          type="time"
                          value={arriveFrom}
                          onChange={(e) => {
                            setArriveFrom(e.target.value)
                            clearFieldError('arrival-from')
                          }}
                          onBlur={() => validateFieldOnBlur('arrival-from')}
                          error={Boolean(visibleFieldErrors['arrival-from'])}
                          aria-describedby={visibleFieldErrors['arrival-from'] ? 'arrival-from-error' : undefined}
                          size="small"
                          fullWidth
                          sx={fieldSx}
                        />
                        <FieldMessage id="arrival-from-error" message={visibleFieldErrors['arrival-from']} duracionError={duracionError} />
                      </Box>
                      <Box>
                        <FieldLabel text="Llegada hasta" htmlFor="arrival-until" />
                        <TextField
                          id="arrival-until"
                          type="time"
                          value={arriveTo}
                          onChange={(e) => {
                            setArriveTo(e.target.value)
                            clearFieldError('arrival-until')
                          }}
                          onBlur={() => validateFieldOnBlur('arrival-until')}
                          error={Boolean(visibleFieldErrors['arrival-until'])}
                          aria-describedby={visibleFieldErrors['arrival-until'] ? 'arrival-until-error' : undefined}
                          size="small"
                          fullWidth
                          sx={fieldSx}
                        />
                        <FieldMessage id="arrival-until-error" message={visibleFieldErrors['arrival-until']} duracionError={duracionError} />
                      </Box>
                    </Box>
                  </Stack>

                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
                    columnGap: { xs: 0, md: ESPACIO.grupo },
                    rowGap: ESPACIO.campo,
                    alignItems: 'start',
                    '& > :nth-of-type(2)': { borderLeft: { xs: 'none', md: '1px solid' }, borderColor: { md: 'divider' }, pl: { xs: 0, md: ESPACIO.grupo } },
                  }}>
                    <StepLocation
                      title="Origen · Retiro"
                      idPrefix="origin"
                      address={originAddress}
                      onAddress={changeOriginAddress}
                      onSelect={pickOrigin}
                      onGeoStatus={setOriginGeoOk}
                      geoOk={originGeoOk}
                      selected={originPlace !== null}
                      errors={visibleFieldErrors}
                      onFieldChange={clearFieldError}
                      onFieldBlur={validateFieldOnBlur}
                      duracionError={duracionError}
                      barrio={originBarrio}
                      onBarrio={setOriginBarrio}
                      floor={originFloor}
                      onFloor={setOriginFloor}
                      aNivelDeCalle={originStreetLevel}
                      onNivelDeCalle={(value) => {
                        setOriginStreetLevel(value)
                        if (value) {
                          setOriginFloor('')
                          setOriginElevator(null)
                        }
                      }}
                      elevator={originElevator}
                      onElevator={setOriginElevator}
                    />
                    <StepLocation
                      title="Destino · Entrega"
                      idPrefix="destination"
                      address={destAddress}
                      onAddress={changeDestAddress}
                      onSelect={pickDest}
                      onGeoStatus={setDestGeoOk}
                      geoOk={destGeoOk}
                      selected={destPlace !== null}
                      errors={visibleFieldErrors}
                      onFieldChange={clearFieldError}
                      onFieldBlur={validateFieldOnBlur}
                      duracionError={duracionError}
                      barrio={destBarrio}
                      onBarrio={setDestBarrio}
                      floor={destFloor}
                      onFloor={setDestFloor}
                      aNivelDeCalle={destStreetLevel}
                      onNivelDeCalle={(value) => {
                        setDestStreetLevel(value)
                        if (value) {
                          setDestFloor('')
                          setDestElevator(null)
                        }
                      }}
                      elevator={destElevator}
                      onElevator={setDestElevator}
                    />
                  </Box>
                </Stack>
              </>
            )}

            {step === 2 && (
              <>
                <StepHeading n="03" title="Carga" subtitle="Contanos qué hay que trasladar para elegir el vehículo adecuado." />
                <Stack spacing={ESPACIO.seccion}>
                  <Stack spacing={0}>
                    <TituloSeccion text="Detalles de la carga" />
                    <Stack spacing={ESPACIO.campo}>
                    <Box>
                      <FieldLabel text="Descripción de la carga" htmlFor="cargo-description" />
                      <TextField
                        id="cargo-description"
                        value={cargoDesc}
                        onChange={(e) => {
                          setCargoDesc(e.target.value)
                          clearFieldError('cargo-description')
                        }}
                        onBlur={() => validateFieldOnBlur('cargo-description')}
                        error={Boolean(visibleFieldErrors['cargo-description'])}
                        aria-describedby={visibleFieldErrors['cargo-description'] ? 'cargo-description-error' : undefined}
                        multiline
                        minRows={3}
                        fullWidth
                        size="small"
                        sx={fieldSx}
                      />
                      <FieldMessage id="cargo-description-error" message={visibleFieldErrors['cargo-description']} duracionError={duracionError} />
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, columnGap: ESPACIO.grupo, rowGap: ESPACIO.campo }}>
                      <Box>
                        <FieldLabel text="Cantidad aproximada (bultos)" htmlFor="cargo-quantity" />
                        <TextField
                          id="cargo-quantity"
                          value={cargoQty}
                          onChange={(e) => {
                            setCargoQty(e.target.value.replace(/[^\d]/g, ''))
                            clearFieldError('cargo-quantity')
                          }}
                          onBlur={() => validateFieldOnBlur('cargo-quantity')}
                          error={Boolean(visibleFieldErrors['cargo-quantity'])}
                          aria-describedby={visibleFieldErrors['cargo-quantity'] ? 'cargo-quantity-error' : undefined}
                          type="number"
                          inputProps={{ inputMode: 'numeric', min: 1 }}
                          size="small"
                          fullWidth
                          sx={fieldSx}
                        />
                        <FieldMessage id="cargo-quantity-error" message={visibleFieldErrors['cargo-quantity']} duracionError={duracionError} />
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        {label('¿Hay objetos frágiles?')}
                        <Box sx={{ height: 48, display: 'flex', alignItems: 'flex-end' }}>
                        <ToggleButtonGroup value={fragile} exclusive onChange={(_, v) => v && setFragile(v)} size="small" fullWidth sx={toggleAcentoSx}>
                          <ToggleButton value="Sí">Sí</ToggleButton>
                          <ToggleButton value="No">No</ToggleButton>
                        </ToggleButtonGroup>
                        </Box>
                      </Box>
                    </Box>
                    <Box>
                      <FieldLabel text="Observaciones (opcional)" htmlFor="cargo-notes" />
                      <TextField id="cargo-notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} fullWidth size="small" sx={fieldSx} />
                    </Box>
                    </Stack>
                  </Stack>

                  <Box sx={{ p: ESPACIO.campo, borderRadius: 2, bgcolor: '#F7F5F0', border: '1px solid #EDEAE3' }}>
                    <Stack direction="row" spacing={ESPACIO.tituloCampo} alignItems="flex-start">
                      <InfoOutlined sx={{ fontSize: 16, color: brand.navy, mt: ESPACIO.label }} />
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Importante</Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#5C6B7A', mt: ESPACIO.label }}>
                          La solicitud se confirmará cuando se acuerden las condiciones y se registre la seña. No se solicitará ningún pago en este paso.
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Stack>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: ESPACIO.grupo, width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: ESPACIO.grupo }}>
              {step === 0 ? (
                <Button
                  href={R.solicitudes}
                  variant="outlined"
                  startIcon={<ArrowBack />}
                  sx={[actionButtonSx, { color: brand.navy, borderColor: '#D9D4C9' }]}
                >
                  Volver a solicitudes
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<ArrowBack />}
                  onClick={() => setStep((s) => s - 1)}
                  sx={[actionButtonSx, { color: brand.navy, borderColor: '#D9D4C9' }]}
                >
                  Volver
                </Button>
              )}
              {step === 2 && (
                <Typography sx={{ m: 0, fontSize: typeScale.body, color: 'text.secondary', lineHeight: 1.4 }}>
                  Revisá los datos antes de guardar.
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: ESPACIO.campo }}>
              {step < 2 ? (
                <Button
                  variant="contained"
                  endIcon={<ArrowForward />}
                  onClick={handleNext}
                  sx={actionButtonSx}
                >
                  Siguiente
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<Check />}
                  disabled={saving}
                  onClick={handleSave}
                  sx={[actionButtonSx, { bgcolor: brand.orangeStrong, '&:hover': { bgcolor: brand.orangeInk } }]}
                >
                  {saving ? 'Guardando...' : 'Guardar solicitud'}
                </Button>
              )}
            </Box>
          </Box>
          </Box>
        </Box>
      </AppShell>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}

function StepHeading({ n, title, subtitle, compact = false }: { n: string; title: string; subtitle: string; compact?: boolean }) {
  return (
    <Stack direction="row" alignItems="center" spacing={ESPACIO.campo} sx={{ mb: ESPACIO.grupo }}>
      <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: brand.navy, color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Manrope', sans-serif" }}>
        {n}
      </Box>
      <Box>
        <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 16 }}>{title}</Typography>
        <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>{subtitle}</Typography>
      </Box>
    </Stack>
  )
}

function StepLocation({
  title,
  idPrefix,
  address,
  onAddress,
  onSelect,
  onGeoStatus,
  geoOk,
  selected,
  barrio,
  onBarrio,
  floor,
  onFloor,
  aNivelDeCalle,
  onNivelDeCalle,
  elevator,
  onElevator,
  errors,
  onFieldChange,
  onFieldBlur,
  duracionError,
}: {
  title: string
  idPrefix: string
  address: string
  onAddress: (v: string) => void
  onSelect: (place: PlaceDetail) => void
  onGeoStatus: (available: boolean) => void
  geoOk: boolean
  selected: boolean
  barrio: string
  onBarrio: (v: string) => void
  floor: string
  onFloor: (v: string) => void
  aNivelDeCalle: boolean | null
  onNivelDeCalle: (v: boolean) => void
  elevator: 'Sí' | 'No' | null
  onElevator: (v: 'Sí' | 'No') => void
  errors: Record<string, string | null>
  onFieldChange: (id: string) => void
  onFieldBlur: (id: string) => void
  duracionError: number
}) {
  const needsSelection = geoOk && !selected && address.trim() !== ''
  const addressId = `${idPrefix}-address`
  const streetLevelId = `${idPrefix}-street-level`
  const elevatorId = `${idPrefix}-elevator`
  const floorId = `${idPrefix}-floor`
  const handleContainerBlur = (id: string) => (event: FocusEvent<HTMLDivElement>) => {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
      onFieldBlur(id)
    }
  }
  return (
    <Box sx={fieldSx}>
      <TituloSeccion text={title} />
      <Stack spacing={ESPACIO.campo}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.85fr) minmax(0, 1fr)' }, columnGap: ESPACIO.grupo, rowGap: ESPACIO.campo }}>
          <Box>
            <FieldLabel text="Dirección" />
            <Box
              id={addressId}
              onBlur={handleContainerBlur(addressId)}
              sx={{
                '& .MuiFormHelperText-root': {
                  mt: ESPACIO.label,
                  ...(errors[addressId] && { display: 'none' }),
                },
                ...(errors[addressId] && {
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'error.main', borderWidth: '1px' },
                }),
              }}
            >
              <PlaceAutocomplete
                label="Dirección"
                showLabel={false}
                value={address}
                onValueChange={(value) => {
                  onAddress(value)
                  onFieldChange(addressId)
                }}
                onSelect={onSelect}
                onGeoStatus={onGeoStatus}
                selected={selected}
                placeholder="Buscá calle y número…"
                required
                helperText={errors[addressId] ? undefined : needsSelection
                  ? 'Elegí una dirección del listado para calcular el recorrido.'
                  : 'Escribí al menos 3 letras y elegí una sugerencia.'}
              />
            </Box>
            <FieldMessage id={`${addressId}-error`} message={errors[addressId]} duracionError={duracionError} />
          </Box>
        <Box>
          <FieldLabel text="Barrio" htmlFor={`${idPrefix}-neighborhood`} />
          <TextField id={`${idPrefix}-neighborhood`} size="small" fullWidth value={barrio} onChange={(e) => onBarrio(e.target.value)} placeholder="Ej: Villa Crespo" sx={fieldSx} />
        </Box>
        </Box>
        <Box>
          <FieldLabel text={PREGUNTA_NIVEL_CALLE} id={`${idPrefix}-street-level-label`} />
          <Box
            id={streetLevelId}
            onBlur={handleContainerBlur(streetLevelId)}
            sx={errors[streetLevelId] ? { border: '1px solid', borderColor: 'error.main', borderRadius: 1 } : undefined}
          >
            <ToggleButtonGroup
              value={aNivelDeCalle === null ? null : aNivelDeCalle ? 'Sí' : 'No'}
              exclusive
              onChange={(_, value: 'Sí' | 'No' | null) => {
                if (!value) return
                onNivelDeCalle(value === 'Sí')
                onFieldChange(streetLevelId)
                onFieldChange(floorId)
                onFieldChange(elevatorId)
              }}
              size="small"
              fullWidth
              aria-labelledby={`${idPrefix}-street-level-label`}
              aria-describedby={errors[streetLevelId] ? `${streetLevelId}-error` : undefined}
              sx={toggleAcentoSx}
            >
              <ToggleButton value="Sí" sx={{ flexGrow: 1 }}>Sí</ToggleButton>
              <ToggleButton value="No" sx={{ flexGrow: 1 }}>No</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <FieldMessage id={`${streetLevelId}-error`} message={errors[streetLevelId]} duracionError={duracionError} />
          <Collapse
            in={requierePisoYAscensor(aNivelDeCalle)}
            timeout={duracionError}
            unmountOnExit
          >
            <Box sx={{ pt: ESPACIO.campo }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={ESPACIO.campo} alignItems="flex-start">
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <FieldLabel text="¿Hay ascensor?" id={`${idPrefix}-elevator-label`} />
                  <Box sx={{ height: 48, display: 'flex', alignItems: 'flex-end' }}>
                    <Box
                      id={elevatorId}
                      onBlur={handleContainerBlur(elevatorId)}
                      sx={{ width: '100%', ...(errors[elevatorId] ? { border: '1px solid', borderColor: 'error.main', borderRadius: 1 } : {}) }}
                    >
                      <ToggleButtonGroup
                        value={elevator}
                        exclusive
                        onChange={(_, value: 'Sí' | 'No' | null) => {
                          if (!value) return
                          onElevator(value)
                          onFieldChange(elevatorId)
                        }}
                        size="small"
                        fullWidth
                        aria-labelledby={`${idPrefix}-elevator-label`}
                        aria-describedby={errors[elevatorId] ? `${elevatorId}-error` : undefined}
                        sx={toggleAcentoSx}
                      >
                        <ToggleButton value="Sí" sx={{ flexGrow: 1 }}>Sí</ToggleButton>
                        <ToggleButton value="No" sx={{ flexGrow: 1 }}>No</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  </Box>
                  <FieldMessage id={`${elevatorId}-error`} message={errors[elevatorId]} duracionError={duracionError} />
                </Box>
                <Box sx={{ width: { xs: '100%', md: 140 }, flexShrink: 0 }}>
                  <FieldLabel text="Piso" htmlFor={floorId} />
                  <TextField
                    id={floorId}
                    size="small"
                    fullWidth
                    value={floor}
                    onChange={(e) => {
                      onFloor(e.target.value)
                      onFieldChange(floorId)
                    }}
                    onBlur={() => onFieldBlur(floorId)}
                    error={Boolean(errors[floorId])}
                    aria-describedby={errors[floorId] ? `${floorId}-error` : undefined}
                    placeholder="Ej: 3"
                    sx={fieldSx}
                  />
                  <FieldMessage id={`${floorId}-error`} message={errors[floorId]} duracionError={duracionError} />
                </Box>
              </Stack>
            </Box>
          </Collapse>
        </Box>
      </Stack>
    </Box>
  )
}
