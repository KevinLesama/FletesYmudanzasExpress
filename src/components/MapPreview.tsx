import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import PlaceIcon from '@mui/icons-material/Place'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import CloseIcon from '@mui/icons-material/Close'
import { color, motion, shadow } from '../design/tokens'

const MIN_ZOOM = 1
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.5

const GRID_COLS = 8
const GRID_ROWS = 10
const GRID_CELL = 48
const BLOCK_SIZE = 42

/** Rounded blocks, drawn as subpaths of one compound path instead of 80 nodes. */
function blockSubpath(x: number, y: number, size: number) {
  return `M${x} ${y}h${size}v${size}h${-size}Z`
}

function buildCityBlocks() {
  const blocks: string[] = []
  const gardens: string[] = []
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      // Two low blocks leave room for the diagonal avenue and a small plaza.
      if ((row === 4 && col === 4) || (row === 5 && col === 3)) continue
      const x = 8 + col * GRID_CELL
      const y = 8 + row * GRID_CELL
      const jitter = (row * 3 + col * 5) % 3
      const size = BLOCK_SIZE - jitter
      const isGarden = (row === 2 && col === 2) || (row === 2 && col === 3) || (row === 7 && col === 5)
      const subpath = blockSubpath(x, y, size)
      if (isGarden) gardens.push(subpath)
      else blocks.push(subpath)
    }
  }
  return { blocks: blocks.join(''), gardens: gardens.join('') }
}

const CITY = buildCityBlocks()

function roundZoom(value: number) {
  return Math.round(value * 10) / 10
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
            bgcolor: 'rgba(255,255,255,0.92)',
            border: `1px solid ${color.border}`,
            borderRadius: 1.5,
            color: color.navy,
            boxShadow: shadow.card,
            transition: `background-color ${motion.fast}`,
            '&:hover': { bgcolor: color.paper },
            '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.7)', color: color.mutedSoft },
            '& svg': { fontSize: 17 },
          }}
        >
          {children}
        </IconButton>
      </Box>
    </Tooltip>
  )
}

function MapCanvas({ zoom, label }: { zoom: number; label: string }) {
  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', bgcolor: color.sand }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          transition: `transform ${motion.base}`,
          transform: `scale(${zoom})`,
          transformOrigin: '50% 50%',
        }}
      >
        <Box
          component="svg"
          viewBox="0 0 392 488"
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label={label}
          sx={{ display: 'block', width: '100%', height: '100%' }}
        >
          <rect width="392" height="488" fill={color.sand} />

          {/* Río de la Plata */}
          <path
            d="M352 0 C338 80 360 160 346 250 C334 340 358 420 344 488 L392 488 L392 0 Z"
            fill={color.blueSoft}
          />

          {/* Manzanas y espacios verdes */}
          <path d={CITY.blocks} fill={color.borderSoft} />
          <path d={CITY.gardens} fill={color.greenSoft} />

          {/* Avenidas */}
          <path d="M-20 400 L420 260" stroke={color.paper} strokeWidth="12" />
          <path
            d="M-20 400 L420 260"
            stroke={color.border}
            strokeWidth="1"
            strokeDasharray="7 6"
          />
          <path d="M244 0 L244 488" stroke={color.paper} strokeWidth="9" />

          {/* Recorrido */}
          <path
            d="M150 340 L150 300 L196 300 L196 244"
            fill="none"
            stroke={color.orangeStrong}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="7 5"
          />
          <circle
            cx="150"
            cy="340"
            r="4.5"
            fill={color.paper}
            stroke={color.orangeStrong}
            strokeWidth="2.5"
          />
        </Box>
      </Box>

      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -100%)',
          width: 26,
          height: 26,
          borderRadius: '50%',
          bgcolor: color.paper,
          boxShadow: shadow.raised,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PlaceIcon sx={{ fontSize: 16, color: color.orangeStrong }} />
      </Box>
    </Box>
  )
}

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onExpand,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onExpand?: () => void
}) {
  return (
    <Stack spacing={0.5} sx={{ position: 'absolute', top: 8, right: 8 }}>
      <MapButton label="Acercar" onClick={onZoomIn} disabled={zoom >= MAX_ZOOM}>
        <ZoomInIcon />
      </MapButton>
      <MapButton label="Alejar" onClick={onZoomOut} disabled={zoom <= MIN_ZOOM}>
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

/**
 * Sidebar map placeholder. It fills its parent, so the sidebar controls the
 * height. The controls are real (zoom scales the preview, expand opens a
 * dialog); the geography is illustrative until a map provider is connected.
 */
export function MapPreview() {
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [expanded, setExpanded] = useState(false)

  const zoomIn = () => setZoom((z) => roundZoom(Math.min(MAX_ZOOM, z + ZOOM_STEP)))
  const zoomOut = () => setZoom((z) => roundZoom(Math.max(MIN_ZOOM, z - ZOOM_STEP)))

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
        }}
      >
        <MapCanvas zoom={zoom} label="Vista previa del mapa de Buenos Aires" />
        <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onExpand={() => setExpanded(true)} />
        <Box
          sx={{
            position: 'absolute',
            left: 8,
            bottom: 8,
            px: 0.8,
            py: 0.1,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.9)',
            border: `1px solid ${color.border}`,
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: color.muted, lineHeight: 1.7 }}>
            Vista previa
          </Typography>
        </Box>
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
          Mapa de la ciudad
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
              borderRadius: 2,
              border: `1px solid ${color.border}`,
              overflow: 'hidden',
            }}
          >
            <MapCanvas zoom={zoom} label="Mapa de Buenos Aires" />
            <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} />
          </Box>
        </DialogContent>
      </Dialog>
    </>
  )
}
