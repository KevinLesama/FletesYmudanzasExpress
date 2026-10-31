import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Box, CircularProgress, InputAdornment, Paper, Popper, TextField, Typography } from '@mui/material'
import { LocationOn } from '@mui/icons-material'
import { api, ApiError } from '../api'
import { brand } from '../theme'
import type { PlaceDetail, PlaceSuggestion } from '../types'

const MIN_CHARS = 3
const DEBOUNCE_MS = 300

interface PlaceAutocompleteProps {
  label: string
  value: string
  onValueChange: (value: string) => void
  /** Se dispara solo cuando el usuario elige una sugerencia del listado. */
  onSelect: (place: PlaceDetail) => void
  placeholder?: string
  required?: boolean
  /** Si es false, el campo no dibuja label propio y usa `label` solo como nombre accesible. */
  showLabel?: boolean
  helperText?: string
  /** Avisa si Google Maps esta disponible, para exigir o no la seleccion. */
  onGeoStatus?: (available: boolean) => void
  selected?: boolean
}

type Status = 'idle' | 'loading' | 'empty' | 'error' | 'unavailable'

export function PlaceAutocomplete({
  label,
  value,
  onValueChange,
  onSelect,
  placeholder,
  required = false,
  showLabel = true,
  helperText,
  onGeoStatus,
  selected = false,
}: PlaceAutocompleteProps) {
  const listId = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  const geoStatusRef = useRef(onGeoStatus)
  geoStatusRef.current = onGeoStatus

  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [highlighted, setHighlighted] = useState(-1)
  const [status, setStatus] = useState<Status>('idle')
  const [announce, setAnnounce] = useState('')

  // Debounce + cancelacion: si el usuario sigue tipeando, la busqueda anterior
  // se aborta y nunca pisa el resultado de la ultima.
  useEffect(() => {
    const query = value.trim()
    if (selected) {
      setSuggestions([])
      setStatus('idle')
      setOpen(false)
      setAnnounce('Ubicación seleccionada')
      return
    }
    if (query.length < MIN_CHARS) {
      setSuggestions([])
      setStatus('idle')
      setOpen(false)
      return
    }

    const controller = new AbortController()
    setStatus('loading')
    const timer = window.setTimeout(async () => {
      try {
        const rows = await api.searchPlaces(query, controller.signal)
        if (controller.signal.aborted) return
        setSuggestions(rows)
        setHighlighted(rows.length > 0 ? 0 : -1)
        setOpen(rows.length > 0)
        setStatus(rows.length > 0 ? 'idle' : 'empty')
        setAnnounce(rows.length > 0 ? `${rows.length} direcciones encontradas` : 'Sin resultados')
        // Sin resultados no debe bloquear la carga manual de la dirección.
        geoStatusRef.current?.(rows.length > 0)
      } catch (err) {
        if (controller.signal.aborted) return
        setSuggestions([])
        setOpen(false)
        // 503 = el backend no tiene GOOGLE_MAPS_API_KEY. El campo sigue
        // funcionando como texto libre para no bloquear la carga.
        const unavailable = err instanceof ApiError && err.status === 503
        setStatus(unavailable ? 'unavailable' : 'error')
        setAnnounce(unavailable ? 'Geolocalización no disponible' : 'No pudimos buscar direcciones')
        geoStatusRef.current?.(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [value])

  const select = async (suggestion: PlaceSuggestion) => {
    setOpen(false)
    setStatus('loading')
    onValueChange(suggestion.secondary || suggestion.primary)
    if (suggestion.lat != null && suggestion.lng != null) {
      onSelect({
        placeId: suggestion.placeId,
        address: suggestion.secondary || suggestion.primary,
        lat: suggestion.lat,
        lng: suggestion.lng,
      })
      setStatus('idle')
      return
    }
    try {
      const place = await api.getPlace(suggestion.placeId)
      onValueChange(place.address || suggestion.primary)
      onSelect(place)
      setStatus('idle')
    } catch {
      setStatus('error')
      setAnnounce('No pudimos obtener los datos de la dirección')
      geoStatusRef.current?.(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault()
      setOpen(true)
      setHighlighted((i) => (i + 1) % suggestions.length)
      return
    }
    if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault()
      setOpen(true)
      setHighlighted((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
      return
    }
    if (event.key === 'Enter' && open && highlighted >= 0 && suggestions[highlighted]) {
      event.preventDefault()
      void select(suggestions[highlighted])
      return
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
    }
  }

  const showList = open && suggestions.length > 0
  const helper =
    status === 'unavailable'
      ? 'Geolocalización no disponible: escribí la dirección completa a mano.'
      : status === 'error'
        ? 'No pudimos consultar la geolocalización. Escribí la dirección completa a mano.'
        : status === 'empty'
          ? 'Sin coincidencias. Probá con calle, número y localidad.'
          : helperText

  return (
    <Box ref={anchorRef}>
      <TextField
        size="small"
        fullWidth
        label={showLabel ? label : undefined}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        error={status === 'error'}
        helperText={helper}
        color={selected ? 'success' : undefined}
        focused={selected}
        sx={
          selected
            ? {
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#2F7D55',
                  borderWidth: 2,
                },
                '& .MuiInputLabel-root.Mui-focused': { color: '#2F7D55' },
                '& .MuiFormHelperText-root': { color: '#2F7D55' },
              }
            : undefined
        }
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <LocationOn sx={{ fontSize: 18, color: '#8A8577' }} />
            </InputAdornment>
          ),
          endAdornment:
            status === 'loading' ? (
              <InputAdornment position="end">
                <CircularProgress size={14} />
              </InputAdornment>
            ) : undefined,
        }}
        inputProps={{
          role: 'combobox',
          'aria-label': showLabel ? undefined : label,
          'aria-expanded': showList,
          'aria-controls': listId,
          'aria-autocomplete': 'list',
          'aria-activedescendant': showList && highlighted >= 0 ? `${listId}-opt-${highlighted}` : undefined,
          autoComplete: 'off',
        }}
      />

      <Popper
        open={showList}
        anchorEl={anchorRef.current}
        placement="bottom-start"
        sx={{ zIndex: 1500, width: anchorRef.current?.clientWidth }}
      >
        <Paper
          id={listId}
          role="listbox"
          aria-label={`Sugerencias para ${label}`}
          elevation={8}
          sx={{ mt: 0.5, maxHeight: 280, overflowY: 'auto', border: '1px solid #E9E6DF', borderRadius: 2 }}
        >
          {suggestions.map((s, index) => (
            <Box
              key={s.placeId}
              id={`${listId}-opt-${index}`}
              role="option"
              aria-selected={index === highlighted}
              onMouseDown={(e) => {
                e.preventDefault()
                void select(s)
              }}
              onMouseEnter={() => setHighlighted(index)}
              sx={{
                px: 1.6,
                py: 1.1,
                cursor: 'pointer',
                bgcolor: index === highlighted ? '#F5F1E8' : 'transparent',
                borderBottom: index < suggestions.length - 1 ? '1px solid #F1EEE7' : 'none',
              }}
            >
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: brand.navy }}>{s.primary}</Typography>
              {s.secondary && <Typography sx={{ fontSize: 12, color: '#64707C' }}>{s.secondary}</Typography>}
            </Box>
          ))}
        </Paper>
      </Popper>

      <Box aria-live="polite" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
        {announce}
      </Box>
    </Box>
  )
}
