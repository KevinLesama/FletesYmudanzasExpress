import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import L, { type LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker?url'
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet'
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import CloseIcon from '@mui/icons-material/Close'
import { alpha } from '@mui/material/styles'
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet'
import { color, motion, shadow, type as typeScale } from '../design/tokens'
import { api } from '../api'
import { fmtDate } from '../format'
import type { TripForMapReason } from '../tripForMap'
import type { ShiftRequest } from '../types'
import { StatusChip } from './StatusChip'

export interface MapPreviewProps {
  trip?: ShiftRequest | null
  trips?: ShiftRequest[]
  reason?: TripForMapReason | null
  onClear?: () => void
  onOpenDetail?: (trip: ShiftRequest) => void
}

function isTripInProgress(trip: ShiftRequest): boolean {
  return String(trip.status) === 'En viaje' || (
    trip.status === 'Confirmada' &&
    Boolean(trip.arrivedAt) &&
    !trip.finishedAt
  )
}

const BUENOS_AIRES: LatLngTuple = [-34.6037, -58.3816]
const MAP_TILES_KEY = (import.meta.env.VITE_MAP_TILES_KEY as string | undefined)?.trim() ?? ''
const MAP_STYLE_ID = (import.meta.env.VITE_MAP_STYLE_ID as string | undefined)?.trim()
const MAP_STYLE_URL =
  MAP_TILES_KEY && MAP_STYLE_ID
    ? `https://api.maptiler.com/maps/${MAP_STYLE_ID}/style.json?key=${MAP_TILES_KEY}`
    : ''
const MAP_ATTRIBUTION = '© MapTiler © OpenStreetMap contributors'
const COLORS = {
  origin: '#1E2A4A',
  route: '#1E2A4A',
  destination: '#C2410C',
} as const
const WINDOW_DAYS = 7
const ROUTE_CACHE_LIMIT = 128

maplibregl.setWorkerUrl(maplibreWorkerUrl)

type RouteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'approximate'; geometry: null; km?: number; minutes?: number }
  | { status: 'ready'; geometry: LatLngTuple[]; km: number; minutes: number }

function isCoordinate(lat: number | undefined, lng: number | undefined): lat is number {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
}

function addressFor(place: ShiftRequest['origin']): string {
  if (place.address && place.barrio) return `${place.address} · ${place.barrio}`
  return place.address || place.barrio || 'Dirección no disponible'
}

type TripMapLabelTone = 'live' | 'muted' | 'warning' | 'neutral'

function getTripMapLabel(trip: ShiftRequest, now: Date): { text: string; tone: TripMapLabelTone } {
  if (trip.arrivedAt && !trip.finishedAt) return { text: 'En curso', tone: 'live' }
  if (trip.finishedAt) return { text: 'Finalizado', tone: 'muted' }

  const end = new Date(`${trip.date}T${trip.serviceRange[1]}:00`)
  if (!Number.isNaN(end.getTime()) && end < now) return { text: 'Sin finalizar', tone: 'warning' }
  return { text: 'Programado', tone: 'neutral' }
}

function formatDistance(km: number): string {
  return `${km.toLocaleString('es-AR', { maximumFractionDigits: 1 })} km`
}

function MapLibreLayer() {
  const map = useMap()

  useEffect(() => {
    if (!MAP_STYLE_URL) {
      console.error('No se pudo cargar el mapa: faltan VITE_MAP_TILES_KEY o VITE_MAP_STYLE_ID.')
      return
    }

    const layer = maplibreGL({
      style: MAP_STYLE_URL,
      interactive: false,
      attributionControl: false,
    })
    map.attributionControl.addAttribution(MAP_ATTRIBUTION)
    map.addLayer(layer)
    const resizeFrame = window.requestAnimationFrame(() => map.invalidateSize({ pan: false }))

    return () => {
      window.cancelAnimationFrame(resizeFrame)
      map.attributionControl.removeAttribution(MAP_ATTRIBUTION)
      if (map.hasLayer(layer)) map.removeLayer(layer)
    }
  }, [map])

  return null
}

type MarkerKind = 'origin' | 'destination'

function markerColor(kind: MarkerKind): string {
  return kind === 'origin' ? COLORS.origin : COLORS.destination
}

function MarkerGlyph({ kind, size }: { kind: MarkerKind; size: number }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: kind === 'origin' ? size : size * 0.9,
        height: kind === 'origin' ? size : size * 1.15,
        flexShrink: 0,
        borderRadius: kind === 'origin' ? '50%' : '50% 50% 50% 0',
        bgcolor: kind === 'origin' ? color.paper : markerColor(kind),
        border: kind === 'origin' ? `${Math.max(2, size * 0.22)}px solid` : 'none',
        borderColor: COLORS.origin,
        boxShadow: shadow.raised,
        transform: kind === 'destination' ? 'rotate(-45deg)' : 'none',
      }}
    >
      {kind === 'destination' && (
        <Box sx={{ width: size * 0.35, height: size * 0.35, borderRadius: '50%', bgcolor: color.paper }} />
      )}
    </Box>
  )
}

function MarkerIcon(kind: MarkerKind) {
  if (kind === 'destination') {
    return L.divIcon({
      className: '',
      html: `<svg aria-hidden="true" width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.24))"><path d="M15 37C13 34 2 22 2 15C2 7.82 7.82 2 15 2C22.18 2 28 7.82 28 15C28 22 17 34 15 37Z" fill="${COLORS.destination}" stroke="${color.paper}" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="${color.paper}"/></svg>`,
      iconSize: [30, 38],
      iconAnchor: [15, 37],
    })
  }

  const size = 18
  return L.divIcon({
    className: '',
    html: `<span aria-hidden="true" style="display:block;width:${size}px;height:${size}px;box-sizing:border-box;border-radius:50%;background:${color.paper};border:4px solid ${COLORS.origin};box-shadow:${shadow.raised}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function MapButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Tooltip title={label} placement="left">
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <IconButton
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          size="small"
          sx={{
            width: 28,
            height: 28,
            bgcolor: alpha(color.paper, 0.92),
            border: `1px solid ${color.border}`,
            borderRadius: 1.5,
            color: color.navy,
            boxShadow: shadow.card,
            transition: `background-color ${motion.fast}`,
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            '&:hover': { bgcolor: color.paper },
            '&.Mui-disabled': { bgcolor: alpha(color.paper, 0.7), color: color.mutedSoft },
            '& svg': { fontSize: 17 },
          }}
        >
          {children}
        </IconButton>
      </Box>
    </Tooltip>
  )
}

function ZoomControls({
  onExpand,
}: {
  onExpand?: () => void
}) {
  const map = useMap()

  return (
    <Stack spacing={0.5} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1100 }}>
      <MapButton label="Acercar" onClick={() => map.zoomIn()}>
        <ZoomInIcon />
      </MapButton>
      <MapButton label="Alejar" onClick={() => map.zoomOut()}>
        <ZoomOutIcon />
      </MapButton>
      {onExpand && (
        <MapButton label="Agrandar el mapa" onClick={onExpand}>
          <OpenInFullIcon />
        </MapButton>
      )}
    </Stack>
  )
}

function TripReasonBadge({
  trip,
  selectedMode,
  now,
  onClear,
  index,
  total,
  onNavigate,
}: {
  trip: ShiftRequest
  selectedMode: boolean
  now: Date
  onClear?: () => void
  index: number
  total: number
  onNavigate: (direction: -1 | 1) => void
}) {
  const selectedLabel = selectedMode ? getTripMapLabel(trip, now) : null
  const isLive = isTripInProgress(trip)
  const text = selectedLabel?.text
    ?? (isLive ? 'En curso' : total > 1 ? 'Próximos viajes' : 'Próximo viaje')
  const tone = selectedLabel?.tone ?? (isTripInProgress(trip) ? 'live' : 'neutral')
  const dotColor = tone === 'live' ? color.green : tone === 'warning' ? color.amber : tone === 'muted' ? color.mutedSoft : null
  const showNavigation = !selectedMode && total > 1

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 1100,
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 32,
        px: 1.25,
        borderRadius: 2,
        bgcolor: color.paper,
        color: color.navy,
        fontSize: typeScale.micro,
        fontWeight: 700,
        boxShadow: shadow.card,
      }}
    >
      {dotColor && (
        <Box
          aria-hidden="true"
          sx={{
            width: 8,
            height: 8,
            mr: 0.75,
            flexShrink: 0,
            borderRadius: '50%',
            bgcolor: dotColor,
            ...(tone === 'live' && {
              animation: 'map-pulse 1.6s ease-in-out infinite',
              '@keyframes map-pulse': {
                '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(color.green, 0.35)}` },
                '50%': { boxShadow: `0 0 0 4px ${alpha(color.green, 0)}` },
              },
            }),
          }}
        />
      )}
      <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', lineHeight: 1, whiteSpace: 'nowrap' }}>
        {showNavigation && isLive ? `${text} · ${index + 1}/${total}` : showNavigation ? (
          <>
            <Box component="span" sx={{ '@media (max-width: 360px)': { display: 'none' } }}>Próximos viajes · </Box>
            <Box component="span" sx={{ display: 'none', '@media (max-width: 360px)': { display: 'inline' } }}>Próximos · </Box>
            {index + 1}/{total}
          </>
        ) : text}
      </Typography>
      {showNavigation && (
        <>
          <IconButton
            aria-label="Viaje anterior"
            disabled={index === 0}
            onClick={() => onNavigate(-1)}
            sx={{
              order: -1,
              width: 28,
              height: 28,
              mr: 0.25,
              p: 0,
              color: color.navy,
              borderRadius: '50%',
              '&:hover': { bgcolor: color.sandDeep },
              '&.Mui-disabled': { color: color.mutedSoft, opacity: 0.55 },
              '& svg': { fontSize: 14 },
            }}
          >
            ‹
          </IconButton>
          <IconButton
            aria-label="Viaje siguiente"
            disabled={index === total - 1}
            onClick={() => onNavigate(1)}
            sx={{
              width: 28,
              height: 28,
              ml: 0.25,
              p: 0,
              color: color.navy,
              borderRadius: '50%',
              '&:hover': { bgcolor: color.sandDeep },
              '&.Mui-disabled': { color: color.mutedSoft, opacity: 0.55 },
              '& svg': { fontSize: 14 },
            }}
          >
            ›
          </IconButton>
        </>
      )}
      {selectedMode && onClear && (
        <IconButton
          aria-label="Volver a próximos viajes"
          onClick={onClear}
          sx={{
            width: 24,
            height: 24,
            ml: 0.5,
            p: 0,
            color: color.muted,
            borderRadius: '50%',
            '&:hover': { bgcolor: color.sandDeep },
            '& svg': { fontSize: 14 },
          }}
        >
          <CloseIcon />
        </IconButton>
      )}
    </Box>
  )
}

function FitMap({
  tripId,
  positions,
  reducedMotion,
  cardHeight,
}: {
  tripId?: string
  positions: LatLngTuple[]
  reducedMotion: boolean
  cardHeight: number
}) {
  const map = useMap()

  useEffect(() => {
    map.invalidateSize({ pan: false })
    if (positions.length === 0) {
      map.setView(BUENOS_AIRES, 11, { animate: false })
      return
    }

    const bounds = L.latLngBounds(positions)
    map.fitBounds(bounds, {
      paddingTopLeft: [40, 48],
      paddingBottomRight: [40, cardHeight + 16],
      maxZoom: positions.length === 1 ? 14 : 16,
      animate: !reducedMotion,
    })
  }, [cardHeight, map, positions, reducedMotion, tripId])

  return null
}

function MapContents({
  trip,
  geometry,
  routeStatus,
  reducedMotion,
  onExpand,
  large,
  index,
  total,
  selectedMode,
  cardHeight,
}: {
  trip?: ShiftRequest | null
  geometry: LatLngTuple[] | null
  routeStatus: RouteState['status']
  reducedMotion: boolean
  onExpand?: () => void
  large?: boolean
  index: number
  total: number
  selectedMode: boolean
  cardHeight: number
}) {
  const origin = trip && isCoordinate(trip.origin.lat, trip.origin.lng)
    ? [trip.origin.lat, trip.origin.lng] as LatLngTuple
    : null
  const destination = trip && isCoordinate(trip.destination.lat, trip.destination.lng)
    ? [trip.destination.lat, trip.destination.lng] as LatLngTuple
    : null
  const positions = useMemo(
    () => [...(origin ? [origin] : []), ...(destination ? [destination] : []), ...(geometry ?? [])],
    [origin?.[0], origin?.[1], destination?.[0], destination?.[1], geometry],
  )
  const bothCoordinates = origin !== null && destination !== null
  const approximate = bothCoordinates && routeStatus === 'approximate'
  const markerA = useMemo(() => MarkerIcon('origin'), [])
  const markerB = useMemo(() => MarkerIcon('destination'), [])
  const routePositions = geometry?.length ? geometry : bothCoordinates ? [origin, destination] : []

  return (
    <>
      <MapLibreLayer />
      {trip && origin && (
        <Marker position={origin} icon={markerA} alt={`Origen: ${addressFor(trip.origin)}`} zIndexOffset={1000} />
      )}
      {trip && destination && (
        <Marker position={destination} icon={markerB} alt={`Destino: ${addressFor(trip.destination)}`} zIndexOffset={1000} />
      )}
      {bothCoordinates && (
        approximate ? (
          <Polyline
            positions={routePositions}
            pathOptions={{ color: COLORS.route, weight: 5, opacity: 0.5, dashArray: '6 8', lineCap: 'round', lineJoin: 'round' }}
          />
        ) : (
          <>
            <Polyline
              positions={routePositions}
              pathOptions={{ color: COLORS.route, weight: 5, opacity: 0.5, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{ color: COLORS.route, weight: 5, opacity: 0.5, lineCap: 'round', lineJoin: 'round' }}
            />
          </>
        )
      )}
      <FitMap
        tripId={`${trip?.id ?? 'empty'}:${selectedMode ? 'selected' : 'upcoming'}`}
        positions={positions}
        reducedMotion={reducedMotion}
        cardHeight={cardHeight}
      />
      <ZoomControls onExpand={onExpand} />
      {routeStatus === 'loading' && (
        <Box
          role="status"
          aria-label="Cargando ruta"
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            p: 0.75,
            borderRadius: 2,
            bgcolor: alpha(color.paper, 0.92),
          }}
        >
          <Skeleton width={88} height={16} />
        </Box>
      )}
      {!trip && (
        <Typography
          role="status"
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            p: 1,
            borderRadius: 2,
            bgcolor: alpha(color.paper, 0.92),
            color: color.navy,
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          Sin viajes en los próximos {WINDOW_DAYS} días
        </Typography>
      )}
      {trip && !bothCoordinates && (
        <Typography
          role="status"
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            p: 1,
            borderRadius: 2,
            bgcolor: alpha(color.paper, 0.92),
            color: color.red,
            fontSize: 12,
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          No pudimos ubicar este viaje
        </Typography>
      )}
    </>
  )
}

function TripCard({
  trip,
  routeState,
  onOpenDetail,
  showAddresses,
  onHeightChange,
}: {
  trip: ShiftRequest
  routeState: RouteState
  onOpenDetail?: (trip: ShiftRequest) => void
  showAddresses?: boolean
  onHeightChange: (height: number) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const km = routeState.status === 'ready' || routeState.status === 'approximate'
    ? routeState.km ?? trip.estimatedKm
    : trip.estimatedKm
  const minutes = routeState.status === 'ready' || routeState.status === 'approximate'
    ? routeState.minutes ?? trip.etaMinutes
    : trip.etaMinutes

  useEffect(() => {
    const element = cardRef.current
    if (!element) return
    const reportHeight = () => onHeightChange(element.getBoundingClientRect().height)
    reportHeight()
    const observer = new ResizeObserver(reportHeight)
    observer.observe(element)
    return () => observer.disconnect()
  }, [onHeightChange])

  return (
    <Box
      ref={cardRef}
      sx={{
        position: 'absolute',
        left: 8,
        right: 8,
        bottom: 28,
        zIndex: 1100,
        p: 1,
        borderRadius: 2,
        bgcolor: color.paper,
        border: `1px solid ${color.border}`,
        boxShadow: shadow.card,
        transition: 'none',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Tooltip title={trip.client} placement="top">
        <Typography noWrap sx={{ minWidth: 0, fontSize: typeScale.caption, fontWeight: 700, color: color.navy }}>
          {trip.client}
        </Typography>
      </Tooltip>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0, mt: 0.25 }}>
        <Typography sx={{ minWidth: 0, fontSize: typeScale.micro, color: color.muted }}>{trip.id}</Typography>
        <StatusChip label={trip.status} />
      </Stack>
      <Typography sx={{ mt: 0.25, fontSize: typeScale.micro, color: color.muted }}>
        {fmtDate(trip.date)} · {trip.serviceRange[0]}–{trip.serviceRange[1]}
      </Typography>
      {showAddresses && <Stack spacing={0.25} sx={{ mt: 0.5 }}>
        {([
          ['Origen', trip.origin],
          ['Destino', trip.destination],
        ] as const).map(([label, place]) => (
          <Stack key={label} direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
            <MarkerGlyph kind={label === 'Origen' ? 'origin' : 'destination'} size={18} />
            <Typography sx={{ width: 42, flexShrink: 0, fontSize: 11, fontWeight: 800, color: label === 'Origen' ? color.navy : color.orangeStrong }}>
              {label}
            </Typography>
            <Tooltip title={addressFor(place)} placement="top">
              <Typography noWrap sx={{ minWidth: 0, fontSize: 11, color: color.ink }}>
                {addressFor(place)}
              </Typography>
            </Tooltip>
          </Stack>
        ))}
      </Stack>}
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: showAddresses ? 0.35 : 0.5, minWidth: 0 }}>
        {routeState.status === 'loading' ? (
          <Skeleton width={102} height={18} />
        ) : (
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: typeScale.micro, fontWeight: 700, color: color.navy }}>
            {km != null && minutes != null
              ? `${formatDistance(km)} · ${Math.round(minutes)} min`
              : routeState.status === 'approximate'
                ? 'Ruta aproximada'
                : 'Sin datos de ruta'}
            {routeState.status === 'approximate' && km != null && minutes != null ? ' · Ruta aproximada' : ''}
          </Typography>
        )}
        {onOpenDetail && (
          <Button size="small" onClick={() => onOpenDetail(trip)} sx={{ flexShrink: 0, minWidth: 0, px: 0.5, py: 0, fontSize: typeScale.micro, whiteSpace: 'nowrap' }}>
            Ver detalle
          </Button>
        )}
      </Stack>
    </Box>
  )
}

function MapCanvas({
  trip,
  routeState,
  reducedMotion,
  onExpand,
  large,
  index,
  total,
  selectedMode,
  cardHeight,
}: {
  trip?: ShiftRequest | null
  routeState: RouteState
  reducedMotion: boolean
  onExpand?: () => void
  large?: boolean
  index: number
  total: number
  selectedMode: boolean
  cardHeight: number
}) {
  const geometry = routeState.status === 'ready' ? routeState.geometry : null
  const center = trip && isCoordinate(trip.origin.lat, trip.origin.lng)
    ? [trip.origin.lat, trip.origin.lng] as LatLngTuple
    : trip && isCoordinate(trip.destination.lat, trip.destination.lng)
      ? [trip.destination.lat, trip.destination.lng] as LatLngTuple
      : BUENOS_AIRES

  return (
    <MapContainer
      key={`${trip?.id ?? 'empty'}:${selectedMode ? 'selected' : 'upcoming'}`}
      center={center}
      zoom={11}
      minZoom={4}
      maxZoom={19}
      zoomControl={false}
      scrollWheelZoom={false}
      zoomAnimation={!reducedMotion}
      markerZoomAnimation={!reducedMotion}
      fadeAnimation={!reducedMotion}
      style={{ height: '100%', width: '100%' }}
    >
      <MapContents
        trip={trip}
        geometry={geometry}
        routeStatus={routeState.status}
        reducedMotion={reducedMotion}
        onExpand={onExpand}
        large={large}
        index={index}
        total={total}
        selectedMode={selectedMode}
        cardHeight={cardHeight}
      />
    </MapContainer>
  )
}

export function MapPreview({ trip, trips, reason, onClear, onOpenDetail }: MapPreviewProps) {
  const [expanded, setExpanded] = useState(false)
  const [index, setIndex] = useState(0)
  const [cardHeight, setCardHeight] = useState(0)
  const now = new Date()
  const [routeSnapshot, setRouteSnapshot] = useState<{
    routeKey: string | null
    state: RouteState
  }>({ routeKey: null, state: { status: 'idle' } })
  const routeCache = useRef(new Map<string, Exclude<RouteState, { status: 'idle' } | { status: 'loading' }>>())
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const selectedMode = reason === 'seleccionado'
  const orderedTrips = useMemo(
    () => (selectedMode ? (trip ? [trip] : []) : (trips !== undefined ? trips : trip ? [trip] : []))
      .filter((candidate, candidateIndex, all) => all.findIndex((item) => item.id === candidate.id) === candidateIndex)
      .filter((candidate) => selectedMode || candidate.status === 'Confirmada' || isTripInProgress(candidate))
      .sort((a, b) => Number(isTripInProgress(b)) - Number(isTripInProgress(a)) || a.date.localeCompare(b.date) || a.serviceRange[0].localeCompare(b.serviceRange[0])),
    [selectedMode, trip, trips],
  )
  const currentIndex = orderedTrips.length > 0 ? Math.min(index, orderedTrips.length - 1) : 0
  const currentTrip = orderedTrips[currentIndex] ?? trip ?? null
  const totalTrips = orderedTrips.length
  const tripListKey = `${selectedMode ? 'selected' : 'upcoming'}:${orderedTrips.map((candidate) => candidate.id).join('|')}`
  const hasCoordinates =
    Boolean(currentTrip) &&
    isCoordinate(currentTrip?.origin.lat, currentTrip?.origin.lng) &&
    isCoordinate(currentTrip?.destination.lat, currentTrip?.destination.lng)

  const routeKey = currentTrip
    ? `${currentTrip.id}:${currentTrip.origin.lat},${currentTrip.origin.lng}:${currentTrip.destination.lat},${currentTrip.destination.lng}`
    : null
  const routeState = routeSnapshot.routeKey === routeKey
    ? routeSnapshot.state
    : currentTrip
      ? { status: 'loading' as const }
      : { status: 'idle' as const }

  useEffect(() => {
    const lastIndex = orderedTrips.length - 1
    if (index > lastIndex) setIndex(Math.max(0, lastIndex))
  }, [index, orderedTrips.length])

  useEffect(() => {
    setIndex(0)
  }, [tripListKey])

  useEffect(() => {
    if (!trip?.id) return
    const selectedIndex = orderedTrips.findIndex((candidate) => candidate.id === trip.id)
    if (selectedIndex >= 0) setIndex(selectedIndex)
  }, [trip?.id])

  useEffect(() => {
    if (!currentTrip || !hasCoordinates) {
      setRouteSnapshot({ routeKey, state: { status: 'idle' } })
      return
    }

    const cached = routeCache.current.get(currentTrip.id)
    if (cached) {
      setRouteSnapshot({ routeKey, state: cached })
      return
    }

    const controller = new AbortController()
    setRouteSnapshot({ routeKey, state: { status: 'loading' } })
    void api.route(
      { lat: currentTrip.origin.lat!, lng: currentTrip.origin.lng! },
      { lat: currentTrip.destination.lat!, lng: currentTrip.destination.lng! },
    ).then((result) => {
      if (controller.signal.aborted) return
      const state: Exclude<RouteState, { status: 'idle' } | { status: 'loading' }> =
        result.geometry?.length
          ? {
              status: 'ready',
              geometry: result.geometry.map(([lng, lat]) => [lat, lng]),
              km: result.kmIda,
              minutes: result.etaMinutes,
            }
          : {
              status: 'approximate',
              geometry: null,
              km: result.kmIda,
              minutes: result.etaMinutes,
            }
      if (routeCache.current.size >= ROUTE_CACHE_LIMIT) {
        const oldest = routeCache.current.keys().next().value
        if (oldest) routeCache.current.delete(oldest)
      }
      routeCache.current.set(currentTrip.id, state)
      setRouteSnapshot({ routeKey, state })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      console.warn('No se pudo obtener la geometría de la ruta.', error)
      const state: Exclude<RouteState, { status: 'idle' } | { status: 'loading' }> = {
        status: 'approximate',
        geometry: null,
      }
      routeCache.current.set(currentTrip.id, state)
      setRouteSnapshot({ routeKey, state })
    })

    return () => controller.abort()
  }, [currentTrip?.id, currentTrip?.origin.lat, currentTrip?.origin.lng, currentTrip?.destination.lat, currentTrip?.destination.lng, hasCoordinates, routeKey])

  const navigate = (direction: -1 | 1) => {
    setIndex((current) => Math.max(0, Math.min(totalTrips - 1, current + direction)))
  }
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    navigate(event.key === 'ArrowLeft' ? -1 : 1)
  }

  return (
    <>
      <Box
        tabIndex={0}
        onKeyDown={handleKeyDown}
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          height: '100%',
          borderRadius: 2.5,
          border: `1px solid ${color.border}`,
          overflow: 'hidden',
          bgcolor: color.sand,
          '& .leaflet-container': {
            height: '100%',
            width: '100%',
            fontFamily: 'inherit',
            zIndex: 0,
          },
          '& .leaflet-control-attribution': {
            backgroundColor: alpha(color.paper, 0.9),
            color: color.ink,
            fontSize: 10,
          },
          '& .leaflet-control-attribution a': { color: color.navy },
          '& .leaflet-div-icon': { background: 'transparent', border: 'none' },
          '& .leaflet-zoom-animated': { transition: reducedMotion ? 'none' : undefined },
        }}
      >
        <MapCanvas trip={currentTrip} routeState={routeState} reducedMotion={reducedMotion} onExpand={() => setExpanded(true)} index={currentIndex} total={totalTrips} selectedMode={selectedMode} cardHeight={cardHeight} />
        {currentTrip && (
          <TripReasonBadge trip={currentTrip} selectedMode={selectedMode} now={now} onClear={onClear} index={currentIndex} total={totalTrips} onNavigate={navigate} />
        )}
        {currentTrip && <TripCard trip={currentTrip} routeState={routeState} onOpenDetail={onOpenDetail} onHeightChange={setCardHeight} />}
      </Box>

      <Dialog
        open={expanded}
        onKeyDown={handleKeyDown}
        onClose={() => setExpanded(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="map-preview-title"
      >
        <DialogTitle
          id="map-preview-title"
          sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1, fontSize: 16, fontWeight: 800 }}
        >
          {currentTrip ? `Ruta de ${currentTrip.client}` : 'Mapa de Buenos Aires'}
          <Box sx={{ flexGrow: 1 }} />
          <IconButton aria-label="Cerrar" onClick={() => setExpanded(false)} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2, pt: 0 }}>
          <Box
            sx={{
              position: 'relative',
              height: '58vh',
              minHeight: 280,
              borderRadius: 2,
              border: `1px solid ${color.border}`,
              overflow: 'hidden',
              '& .leaflet-container': {
                height: '100%',
                width: '100%',
                fontFamily: 'inherit',
                zIndex: 0,
              },
              '& .leaflet-control-attribution': {
                backgroundColor: alpha(color.paper, 0.9),
                color: color.ink,
                fontSize: 10,
              },
              '& .leaflet-control-attribution a': { color: color.navy },
              '& .leaflet-div-icon': { background: 'transparent', border: 'none' },
              '& .leaflet-zoom-animated': { transition: reducedMotion ? 'none' : undefined },
            }}
          >
            <MapCanvas trip={currentTrip} routeState={routeState} reducedMotion={reducedMotion} large index={currentIndex} total={totalTrips} selectedMode={selectedMode} cardHeight={cardHeight} />
            {currentTrip && <TripReasonBadge trip={currentTrip} selectedMode={selectedMode} now={now} onClear={onClear} index={currentIndex} total={totalTrips} onNavigate={navigate} />}
            {currentTrip && <TripCard trip={currentTrip} routeState={routeState} onOpenDetail={onOpenDetail} showAddresses onHeightChange={setCardHeight} />}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  )
}
