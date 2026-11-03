import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L, { type LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import { Box, Button, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { MyLocation, OpenInNew, Refresh } from '@mui/icons-material'
import { color, radius, shadow, type as typeScale } from '../design/tokens'
import type { Place } from '../types'

type LocationState = 'requesting' | 'granted' | 'denied' | 'unavailable'
type RouteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; geometry: LatLngTuple[]; km: number; minutes: number }

const TILE_URL =
  (import.meta.env.VITE_OSM_TILE_URL as string | undefined)?.trim() ||
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
const ROUTER_URL = 'https://router.project-osrm.org/route/v1/driving'

function pointOf(place?: Place | null): LatLngTuple | null {
  if (place?.lat == null || place?.lng == null) return null
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return null
  return [place.lat, place.lng]
}

function kmBetween(a: LatLngTuple, b: LatLngTuple): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthKm = 6371
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)))
}

function targetIcon(kind: 'origin' | 'destination') {
  const tone = kind === 'origin' ? color.navy : color.orangeInk
  return L.divIcon({
    className: '',
    html: `<svg aria-hidden="true" width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.24))"><path d="M15 37C13 34 2 22 2 15C2 7.82 7.82 2 15 2C22.18 2 28 7.82 28 15C28 22 17 34 15 37Z" fill="${tone}" stroke="${color.paper}" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="${color.paper}"/></svg>`,
    iconSize: [30, 38],
    iconAnchor: [15, 37],
  })
}

const MY_LOCATION_ICON = L.divIcon({
  className: '',
  html: `<span aria-hidden="true" style="display:block;width:20px;height:20px;box-sizing:border-box;border-radius:50%;background:${color.blue};border:4px solid ${color.paper};box-shadow:${shadow.raised}"></span>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

function FitBounds({ points, fitKey }: { points: LatLngTuple[]; fitKey: string }) {
  const map = useMap()
  const lastFitKey = useRef<string | null>(null)

  useEffect(() => {
    if (points.length === 0 || lastFitKey.current === fitKey) return
    lastFitKey.current = fitKey
    if (points.length === 1) {
      map.setView(points[0], 15)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 })
  }, [map, points, fitKey])

  return null
}

function RecenterButton({ point }: { point: LatLngTuple }) {
  const map = useMap()

  return (
    <Tooltip title="Centrar en mi ubicación">
      <IconButton
        aria-label="Centrar en mi ubicación"
        onClick={() => map.setView(point, Math.max(map.getZoom(), 16))}
        sx={{
          position: 'absolute',
          right: 10,
          bottom: 24,
          zIndex: 500,
          width: 36,
          height: 36,
          bgcolor: 'rgba(255,255,255,0.94)',
          border: `1px solid ${color.border}`,
          boxShadow: shadow.card,
          color: color.navy,
          '&:hover': { bgcolor: color.paper },
        }}
      >
        <MyLocation sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  )
}

export function DriverRouteMap({
  target,
  fallbackFrom,
  targetKind,
  height = 300,
}: {
  target: Place
  fallbackFrom?: Place
  targetKind: 'origin' | 'destination'
  height?: number
}) {
  const targetPoint = useMemo(() => pointOf(target), [target])
  const fallbackPoint = useMemo(() => pointOf(fallbackFrom), [fallbackFrom])
  const [myPoint, setMyPoint] = useState<LatLngTuple | null>(null)
  const [locationState, setLocationState] = useState<LocationState>('requesting')
  const [attempt, setAttempt] = useState(0)
  const [route, setRoute] = useState<RouteState>({ status: 'idle' })

  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator

  useEffect(() => {
    if (!supported) {
      setLocationState('unavailable')
      return
    }

    setLocationState('requesting')
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setMyPoint([position.coords.latitude, position.coords.longitude])
        setLocationState('granted')
      },
      (error) => setLocationState(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 12_000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [attempt, supported])

  const currentPoint = myPoint ?? fallbackPoint
  const [routedFrom, setRoutedFrom] = useState<LatLngTuple | null>(null)

  // Recalcular el camino solo cuando el chofer se movio lo suficiente: el
  // GPS del celular actualiza varias veces por minuto y el router publico de
  // OSRM no debe recibir una request por cada lectura.
  useEffect(() => {
    if (!currentPoint) {
      setRoutedFrom(null)
      return
    }
    if (!routedFrom || kmBetween(routedFrom, currentPoint) > 0.1) {
      setRoutedFrom(currentPoint)
    }
  }, [currentPoint, routedFrom])

  useEffect(() => {
    if (!routedFrom || !targetPoint) {
      setRoute({ status: 'idle' })
      return
    }

    const controller = new AbortController()
    let cancelled = false
    setRoute({ status: 'loading' })

    const url = `${ROUTER_URL}/${routedFrom[1]},${routedFrom[0]};${targetPoint[1]},${targetPoint[0]}?overview=full&geometries=geojson`

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('route')
        return response.json()
      })
      .then((data) => {
        const first = data?.routes?.[0]
        const coordinates = first?.geometry?.coordinates
        if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error('route')
        const geometry = coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as LatLngTuple)
        if (!cancelled) {
          setRoute({
            status: 'ready',
            geometry,
            km: Number(first.distance ?? 0) / 1000,
            minutes: Math.max(1, Math.round(Number(first.duration ?? 0) / 60)),
          })
        }
      })
      .catch((error) => {
        if (!cancelled && error?.name !== 'AbortError') setRoute({ status: 'error' })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [routedFrom, targetPoint])

  const osmHref = useMemo(() => {
    if (currentPoint && targetPoint) {
      return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${currentPoint[0]}%2C${currentPoint[1]}%3B${targetPoint[0]}%2C${targetPoint[1]}`
    }
    const query = [target.address, target.barrio].filter(Boolean).join(', ')
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`
  }, [currentPoint, targetPoint, target.address, target.barrio])

  const bounds = useMemo(() => {
    const points: LatLngTuple[] = []
    if (targetPoint) points.push(targetPoint)
    if (myPoint) points.push(myPoint)
    if (fallbackPoint && !myPoint) points.push(fallbackPoint)
    return points
  }, [targetPoint, myPoint, fallbackPoint])

  const fitKey = `${targetPoint?.join(',') ?? ''}|${fallbackPoint?.join(',') ?? ''}|${myPoint ? 'located' : 'unlocated'}`

  const requestLocation = useCallback(() => setAttempt((value) => value + 1), [])

  const locationCopy =
    locationState === 'requesting'
      ? 'Pidiendo permiso para usar tu ubicación…'
      : locationState === 'granted'
        ? 'Ubicación activa: el mapa sigue tu recorrido.'
        : locationState === 'denied'
          ? 'No diste permiso de ubicación. Habilitalo en el navegador para ver tu recorrido.'
          : 'No pudimos obtener tu ubicación en este momento.'

  const routeCopy =
    route.status === 'ready'
      ? `${route.km.toLocaleString('es-AR', { maximumFractionDigits: 1 })} km · ${route.minutes} min`
      : route.status === 'error' && routedFrom && targetPoint
        ? `${kmBetween(routedFrom, targetPoint).toLocaleString('es-AR', { maximumFractionDigits: 1 })} km en línea recta`
        : null

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography sx={{ flexGrow: 1, fontSize: typeScale.caption, color: color.muted }}>
          {targetKind === 'origin' ? 'Camino al punto de carga' : 'Camino al destino'}
        </Typography>
        <Button
          size="small"
          endIcon={<OpenInNew sx={{ fontSize: 15 }} />}
          href={osmHref}
          target="_blank"
          rel="noreferrer"
          sx={{ color: color.navy, fontSize: typeScale.caption, minHeight: 36 }}
        >
          Abrir en OpenStreetMap
        </Button>
      </Stack>

      <Box
        role="status"
        aria-live="polite"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor:
            locationState === 'granted'
              ? color.greenSoft
              : locationState === 'denied' || locationState === 'unavailable'
                ? color.amberSoft
                : color.sand,
          border: `1px solid ${locationState === 'granted' ? color.green : color.border}`,
        }}
      >
        {locationState === 'requesting' ? (
          <CircularProgress size={15} sx={{ color: color.navy }} />
        ) : (
          <MyLocation sx={{ fontSize: 17, color: locationState === 'granted' ? color.green : color.amberInk }} />
        )}
        <Typography sx={{ flexGrow: 1, fontSize: typeScale.caption, color: color.inkStrong }}>
          {locationCopy}
        </Typography>
        {locationState !== 'granted' && locationState !== 'requesting' && (
          <Button
            size="small"
            startIcon={<Refresh sx={{ fontSize: 15 }} />}
            onClick={requestLocation}
            sx={{ minHeight: 34, color: color.navy }}
          >
            Reintentar
          </Button>
        )}
      </Box>

      <Box
        sx={{
          position: 'relative',
          height,
          borderRadius: `${radius.md}px`,
          overflow: 'hidden',
          border: `1px solid ${color.border}`,
          bgcolor: color.sandDeep,
        }}
      >
        {targetPoint ? (
          <MapContainer
            center={targetPoint}
            zoom={14}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer url={TILE_URL} attribution={OSM_ATTRIBUTION} />
            <FitBounds points={bounds} fitKey={fitKey} />
            <Marker position={targetPoint} icon={targetIcon(targetKind)} />
            {myPoint && <Marker position={myPoint} icon={MY_LOCATION_ICON} />}
            {route.status === 'ready' && (
              <Polyline
                positions={route.geometry}
                pathOptions={{ color: color.navy, weight: 5, opacity: 0.88 }}
              />
            )}
            {myPoint && <RecenterButton point={myPoint} />}
          </MapContainer>
        ) : (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              px: 3,
              textAlign: 'center',
            }}
          >
            <MyLocation sx={{ fontSize: 26, color: color.mutedSoft }} />
            <Typography sx={{ fontSize: typeScale.body, fontWeight: 700, color: color.navy }}>
              Este lugar no tiene coordenadas
            </Typography>
            <Typography sx={{ fontSize: typeScale.caption, color: color.muted, maxWidth: 360 }}>
              {[target.address, target.barrio].filter(Boolean).join(', ') || 'Abrí el mapa y buscá la dirección.'}
            </Typography>
            <Button size="small" href={osmHref} target="_blank" rel="noreferrer" sx={{ color: color.navy }}>
              Buscar en OpenStreetMap
            </Button>
          </Box>
        )}

        {(routeCopy || route.status === 'loading') && (
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.75,
              borderRadius: 999,
              bgcolor: 'rgba(255,255,255,0.94)',
              border: `1px solid ${color.border}`,
              boxShadow: shadow.card,
              pointerEvents: 'none',
            }}
          >
            {route.status === 'loading' ? (
              <CircularProgress size={13} sx={{ color: color.navy }} />
            ) : (
              <Typography sx={{ fontSize: typeScale.micro, fontWeight: 700, color: color.navy }}>
                {routeCopy}
              </Typography>
            )}
          </Box>
        )}

      </Box>
    </Stack>
  )
}
