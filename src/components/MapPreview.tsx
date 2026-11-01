import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import L, { type LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Box,
  Button,
  Chip,
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
import TripOriginIcon from '@mui/icons-material/TripOrigin'
import PlaceIcon from '@mui/icons-material/Place'
import { alpha } from '@mui/material/styles'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import { color, motion, shadow } from '../design/tokens'
import { api } from '../api'
import { fmtDate } from '../format'
import type { TripForMapReason } from '../tripForMap'
import type { ShiftRequest } from '../types'
import { StatusChip } from './StatusChip'

export interface MapPreviewProps {
  trip?: ShiftRequest | null
  reason?: TripForMapReason | null
  onClear?: () => void
  onOpenDetail?: () => void
}

const BUENOS_AIRES: LatLngTuple = [-34.6037, -58.3816]
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ROUTE_CACHE_LIMIT = 128

type RouteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'approximate'; geometry: null; km?: number; minutes?: number }
  | { status: 'ready'; geometry: LatLngTuple[]; km: number; minutes: number }

const REASON_LABEL: Record<TripForMapReason, string> = {
  seleccionado: 'Seleccionado',
  'en-curso': 'En curso',
  proximo: 'Próximo viaje',
  ultimo: 'Último viaje',
}

function isCoordinate(lat: number | undefined, lng: number | undefined): lat is number {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
}

function addressFor(place: ShiftRequest['origin']): string {
  if (place.address && place.barrio) return `${place.address} · ${place.barrio}`
  return place.address || place.barrio || 'Dirección no disponible'
}

function formatDistance(km: number): string {
  return `${km.toLocaleString('es-AR', { maximumFractionDigits: 1 })} km`
}

type MarkerKind = 'origin' | 'destination'

function markerColor(kind: MarkerKind): string {
  return kind === 'origin' ? color.navy : color.orangeStrong
}

function MarkerGlyph({ kind, size }: { kind: MarkerKind; size: number }) {
  const Icon = kind === 'origin' ? TripOriginIcon : PlaceIcon

  return (
    <Box
      aria-hidden="true"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: kind === 'origin' ? '50%' : '50% 50% 50% 0',
        bgcolor: markerColor(kind),
        border: '2px solid',
        borderColor: color.paper,
        boxShadow: shadow.raised,
        transform: kind === 'destination' ? 'rotate(-45deg)' : 'none',
        '& svg': {
          color: color.paper,
          fontSize: kind === 'origin' ? size * 0.55 : size * 0.58,
          transform: kind === 'destination' ? 'rotate(45deg)' : 'none',
        },
      }}
    >
      <Icon />
    </Box>
  )
}

function MarkerIcon(kind: MarkerKind, label: string) {
  const iconPath = kind === 'origin'
    ? 'M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12m10 6c3.31 0 6-2.69 6-6s-2.69-6-6-6-6 2.69-6 6 2.69 6 6 6'
    : 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7m0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5'
  const shape = kind === 'origin' ? '50%' : '50% 50% 50% 0'
  const transform = kind === 'destination' ? 'rotate(-45deg)' : 'none'
  const iconTransform = kind === 'destination' ? 'rotate(45deg)' : 'none'

  return L.divIcon({
    className: '',
    html: `<span role="img" aria-label="${label}" title="${label}" style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;box-sizing:border-box;border-radius:${shape};background:${markerColor(kind)};border:2px solid ${color.paper};box-shadow:${shadow.raised};transform:${transform}"><svg aria-hidden="true" viewBox="0 0 24 24" style="width:21px;height:21px;fill:${color.paper};transform:${iconTransform}"><path d="${iconPath}"/></svg></span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
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
  reason,
  onClear,
}: {
  reason?: TripForMapReason | null
  onClear?: () => void
}) {
  return (
    <Stack direction="row" spacing={0.25} alignItems="center" sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1100 }}>
      <Chip
        size="small"
        label={reason ? REASON_LABEL[reason] : 'Viaje'}
        sx={{ bgcolor: color.paper, color: color.navy, fontWeight: 700, boxShadow: shadow.card }}
      />
      {reason === 'seleccionado' && onClear && (
        <IconButton
          size="small"
          aria-label="Limpiar selección del mapa"
          onClick={onClear}
          sx={{ bgcolor: color.paper, color: color.navy, boxShadow: shadow.card, '&:hover': { bgcolor: color.sand } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </Stack>
  )
}

function FitMap({
  tripId,
  positions,
  reducedMotion,
}: {
  tripId?: string
  positions: LatLngTuple[]
  reducedMotion: boolean
}) {
  const map = useMap()

  useEffect(() => {
    map.invalidateSize({ pan: false })
    if (positions.length === 0) {
      map.setView(BUENOS_AIRES, 11, { animate: false })
      return
    }

    const height = map.getSize().y
    const bounds = L.latLngBounds(positions)
    map.fitBounds(bounds, {
      paddingTopLeft: [20, Math.min(64, height * 0.2)],
      paddingBottomRight: [20, Math.min(180, height * 0.62)],
      maxZoom: positions.length === 1 ? 14 : 16,
      animate: !reducedMotion,
    })
  }, [map, positions, reducedMotion, tripId])

  return null
}

function MapContents({
  trip,
  geometry,
  routeStatus,
  reducedMotion,
  onExpand,
}: {
  trip?: ShiftRequest | null
  geometry: LatLngTuple[] | null
  routeStatus: RouteState['status']
  reducedMotion: boolean
  onExpand?: () => void
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
  const markerA = useMemo(() => MarkerIcon('origin', 'Origen'), [])
  const markerB = useMemo(() => MarkerIcon('destination', 'Destino'), [])

  return (
    <>
      <TileLayer
        url={TILE_URL}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {trip && origin && (
        <Marker position={origin} icon={markerA} title="Origen" alt="Origen" />
      )}
      {trip && destination && (
        <Marker position={destination} icon={markerB} title="Destino" alt="Destino" />
      )}
      {bothCoordinates && (
        <Polyline
          positions={geometry?.length ? geometry : [origin, destination]}
          pathOptions={{
            color: color.orangeStrong,
            weight: 4,
            opacity: 0.9,
            ...(approximate ? { dashArray: '6 8' } : {}),
          }}
        />
      )}
      <FitMap
        tripId={trip?.id}
        positions={positions}
        reducedMotion={reducedMotion}
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
          Sin viajes para mostrar
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
}: {
  trip: ShiftRequest
  routeState: RouteState
  onOpenDetail?: () => void
}) {
  const km = routeState.status === 'ready' || routeState.status === 'approximate'
    ? routeState.km ?? trip.estimatedKm
    : trip.estimatedKm
  const minutes = routeState.status === 'ready' || routeState.status === 'approximate'
    ? routeState.minutes ?? trip.etaMinutes
    : trip.etaMinutes

  return (
    <Box
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
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: color.navy }}>
          {trip.client}
        </Typography>
        <Typography sx={{ fontSize: 11, color: color.muted }}>{trip.id}</Typography>
        <StatusChip label={trip.status} />
      </Stack>
      <Typography sx={{ mt: 0.25, fontSize: 11, color: color.muted }}>
        {fmtDate(trip.date)} · {trip.serviceRange[0]}–{trip.serviceRange[1]}
      </Typography>
      <Stack spacing={0.25} sx={{ mt: 0.5 }}>
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
      </Stack>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.35 }}>
        {routeState.status === 'loading' ? (
          <Skeleton width={102} height={18} />
        ) : (
          <Typography sx={{ flex: 1, fontSize: 11, fontWeight: 700, color: color.navy }}>
            {km != null && minutes != null
              ? `${formatDistance(km)} · ${Math.round(minutes)} min`
              : routeState.status === 'approximate'
                ? 'Ruta aproximada'
                : 'Distancia y duración no disponibles'}
            {routeState.status === 'approximate' && km != null && minutes != null ? ' · Ruta aproximada' : ''}
          </Typography>
        )}
        {onOpenDetail && (
          <Button size="small" onClick={onOpenDetail} sx={{ minWidth: 0, px: 0.5, py: 0, fontSize: 11, whiteSpace: 'nowrap' }}>
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
}: {
  trip?: ShiftRequest | null
  routeState: RouteState
  reducedMotion: boolean
  onExpand?: () => void
}) {
  const geometry = routeState.status === 'ready' ? routeState.geometry : null
  const center = trip && isCoordinate(trip.origin.lat, trip.origin.lng)
    ? [trip.origin.lat, trip.origin.lng] as LatLngTuple
    : trip && isCoordinate(trip.destination.lat, trip.destination.lng)
      ? [trip.destination.lat, trip.destination.lng] as LatLngTuple
      : BUENOS_AIRES

  return (
    <MapContainer
      key={trip?.id ?? 'empty'}
      center={center}
      zoom={11}
      minZoom={4}
      maxZoom={19}
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
      />
    </MapContainer>
  )
}

export function MapPreview({ trip, reason, onClear, onOpenDetail }: MapPreviewProps) {
  const [expanded, setExpanded] = useState(false)
  const [routeSnapshot, setRouteSnapshot] = useState<{
    routeKey: string | null
    state: RouteState
  }>({ routeKey: null, state: { status: 'idle' } })
  const routeCache = useRef(new Map<string, Exclude<RouteState, { status: 'idle' } | { status: 'loading' }>>())
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const hasCoordinates =
    Boolean(trip) &&
    isCoordinate(trip?.origin.lat, trip?.origin.lng) &&
    isCoordinate(trip?.destination.lat, trip?.destination.lng)

  const routeKey = trip
    ? `${trip.id}:${trip.origin.lat},${trip.origin.lng}:${trip.destination.lat},${trip.destination.lng}`
    : null
  const routeState = routeSnapshot.routeKey === routeKey
    ? routeSnapshot.state
    : trip
      ? { status: 'loading' as const }
      : { status: 'idle' as const }

  useEffect(() => {
    if (!trip || !hasCoordinates) {
      setRouteSnapshot({ routeKey, state: { status: 'idle' } })
      return
    }

    const cached = routeCache.current.get(trip.id)
    if (cached) {
      setRouteSnapshot({ routeKey, state: cached })
      return
    }

    const controller = new AbortController()
    setRouteSnapshot({ routeKey, state: { status: 'loading' } })
    void api.route(
      { lat: trip.origin.lat!, lng: trip.origin.lng! },
      { lat: trip.destination.lat!, lng: trip.destination.lng! },
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
      routeCache.current.set(trip.id, state)
      setRouteSnapshot({ routeKey, state })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      console.warn('No se pudo obtener la geometría de la ruta.', error)
      const state: Exclude<RouteState, { status: 'idle' } | { status: 'loading' }> = {
        status: 'approximate',
        geometry: null,
      }
      routeCache.current.set(trip.id, state)
      setRouteSnapshot({ routeKey, state })
    })

    return () => controller.abort()
  }, [trip?.id, trip?.origin.lat, trip?.origin.lng, trip?.destination.lat, trip?.destination.lng, hasCoordinates, routeKey])

  return (
    <>
      <Box
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
        <MapCanvas trip={trip} routeState={routeState} reducedMotion={reducedMotion} onExpand={() => setExpanded(true)} />
        {trip && (
          <TripReasonBadge reason={reason} onClear={onClear} />
        )}
        {trip && <TripCard trip={trip} routeState={routeState} onOpenDetail={onOpenDetail} />}
      </Box>

      <Dialog
        open={expanded}
        onClose={() => setExpanded(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="map-preview-title"
      >
        <DialogTitle
          id="map-preview-title"
          sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1, fontSize: 16, fontWeight: 800 }}
        >
          {trip ? `Ruta de ${trip.client}` : 'Mapa de Buenos Aires'}
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
            <MapCanvas trip={trip} routeState={routeState} reducedMotion={reducedMotion} />
            {trip && <TripReasonBadge reason={reason} onClear={onClear} />}
            {trip && <TripCard trip={trip} routeState={routeState} onOpenDetail={onOpenDetail} />}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  )
}
