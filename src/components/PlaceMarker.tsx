import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { color } from '../design/tokens'

export type PlaceMarkerKind = 'origin' | 'destination'

/** Sólo para los puntos del Recorrido, que son círculos macizos. */
export type PlaceMarkerVariant = 'glyph' | 'dot'

/**
 * Desplazamiento vertical que centra el marcador en la primera línea de un
 * texto cuyo alto de línea es `lineHeight` px. Sin valores mágicos: sale del
 * line-height que ya usa el texto vecino.
 */
export function markerTopOffset(size: number, lineHeight: number): number {
  return Math.max(0, (lineHeight - size) / 2)
}

/**
 * Marcador único de Origen/Destino.
 *
 * El SVG vive en un caja de tamaño fijo y 1:1: no se estira por flex ni por
 * width/height en porcentaje, y el viewBox 24x24 contiene el pin completo.
 * `lineHeight` alinea el centro del marcador con la primera línea del texto
 * vecino; el llamador es responsable del `align-items: flex-start` de la fila.
 *
 * El desplazamiento se aplica con `top` + `position: relative` y NO con
 * margin: los `Stack` de MUI con `spacing` resetean el margen de sus hijos
 * directos (`& > :not(style):not(style) { margin: 0 }`), así que un margen acá
 * se perdería en las tarjetas de ruta.
 */
export function PlaceMarker({
  kind,
  size = 16,
  variant = 'glyph',
  lineHeight,
  sx,
}: {
  kind: PlaceMarkerKind
  size?: number
  variant?: PlaceMarkerVariant
  /** Alto de línea (px) del texto vecino, para alinear a su primera línea. */
  lineHeight?: number
  sx?: SxProps<Theme>
}) {
  const tone = kind === 'origin' ? color.navy : color.orangeInk

  return (
    <Box
      component="span"
      aria-hidden="true"
      data-place-marker={`${kind}-${variant}`}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        flexShrink: 0,
        alignSelf: 'flex-start',
        aspectRatio: '1 / 1',
        lineHeight: 0,
        overflow: 'visible',
        position: 'relative',
        top: lineHeight == null ? 0 : `${markerTopOffset(size, lineHeight)}px`,
        ...sx,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {variant === 'dot' ? (
          <circle cx="12" cy="12" r="11.5" fill={tone} />
        ) : kind === 'origin' ? (
          <circle cx="12" cy="12" r="8.5" fill={color.paper} stroke={tone} strokeWidth="5" />
        ) : (
          <>
            <path
              d="M12 22.5C10.4 20 4 13.2 4 9a8 8 0 0 1 16 0c0 4.2-6.4 11-8 13.5Z"
              fill={tone}
              stroke={color.paper}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="9" r="3" fill={color.paper} />
          </>
        )}
      </svg>
    </Box>
  )
}
