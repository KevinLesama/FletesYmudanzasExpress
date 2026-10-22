import { Box, Stack, Typography } from '@mui/material'
import { Schedule } from '@mui/icons-material'
import { brand } from '../theme'
import type { ShiftRequest } from '../types'

const HOUR_START = 8
const HOUR_END = 16
const MIN_START = HOUR_START * 60
const MIN_END = HOUR_END * 60
const GUTTER = 62
const HEADER_H = 46
const ROW_H = 78 // alto en px de 1 hora
const GAP_X = 8 // separación horizontal total entre tarjetas
const GAP_Y = 8 // separación vertical total entre tarjetas
const CONTENT_H = (HOUR_END - HOUR_START) * ROW_H
const GRID_H = HEADER_H + CONTENT_H

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

interface Placed {
  trip: ShiftRequest
  lane: number
  cols: number
}

function computeLanes(trips: ShiftRequest[]): Placed[] {
  const sorted = [...trips].sort((a, b) => toMin(a.serviceRange[0]) - toMin(b.serviceRange[0]))
  const clusters: ShiftRequest[][] = []
  let cur: ShiftRequest[] = []
  let barrier = -1
  for (const t of sorted) {
    const start = toMin(t.serviceRange[0])
    if (cur.length > 0 && start >= barrier) {
      clusters.push(cur)
      cur = []
    }
    cur.push(t)
    barrier = Math.max(barrier, toMin(t.serviceRange[1]))
  }
  if (cur.length) clusters.push(cur)

  const placed: Placed[] = []
  for (const cl of clusters) {
    const lanes: ShiftRequest[][] = []
    const assigns: { t: ShiftRequest; lane: number }[] = []
    for (const t of cl) {
      const start = toMin(t.serviceRange[0])
      let ln = lanes.findIndex((l) => l.length === 0 || toMin(l[l.length - 1].serviceRange[1]) <= start)
      if (ln === -1) {
        ln = lanes.length
        lanes.push([])
      }
      lanes[ln].push(t)
      assigns.push({ t, lane: ln })
    }
    const clusterCols = Math.max(1, lanes.length)
    for (const a of assigns) placed.push({ trip: a.t, lane: a.lane, cols: clusterCols })
  }
  return placed
}

export function AgendaGrid({ trips, onOpenTrip }: { trips: ShiftRequest[]; onOpenTrip: (t: ShiftRequest) => void }) {
  const placed = computeLanes(trips)

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ mb: 1.2 }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.8,
            px: 1.2,
            py: 0.6,
            borderRadius: 999,
            bgcolor: '#F0F2F5',
            color: '#5C6B7A',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Schedule sx={{ fontSize: 13 }} />
          Horario de servicio 08:00 – 16:00
        </Box>
      </Stack>

      <Box sx={{ overflowX: 'auto', borderRadius: 2.5, border: '1px solid #E9E6DF', bgcolor: '#FFFFFF' }}>
        <Box sx={{ position: 'relative', height: GRID_H, minWidth: 560 }}>
          {/* Cabecera */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: HEADER_H,
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
              bgcolor: '#FBF9F6',
              borderBottom: '1px solid #E9E6DF',
              px: { xs: 1.5, sm: 2 },
            }}
          >
            <Stack direction="row" alignItems="center" spacing={{ xs: 1.5, sm: 2 }} sx={{ ml: 'auto', flexWrap: 'wrap' }}>
              <Stack direction="row" alignItems="center" spacing={0.8}>
                <Box sx={{ width: 14, height: 11, borderRadius: 0.8, border: '1.5px solid #C9E3D2', bgcolor: '#EFF8F2' }} />
                <Typography sx={{ fontSize: 12.5, color: '#5C6B7A' }}>
                  Confirmada · <strong style={{ color: '#397A55' }}>CONFIRMADA</strong>
                </Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={0.8}>
                <Box sx={{ width: 14, height: 11, borderRadius: 0.8, border: '1.5px dashed #E0B45F', bgcolor: '#FFF8EC' }} />
                <Typography sx={{ fontSize: 12.5, color: '#5C6B7A' }}>
                  Tentativa · <strong style={{ color: '#8A6116' }}>Pendiente de seña</strong>
                </Typography>
              </Stack>
            </Stack>
          </Box>

          {/* Eje vertical */}
          <Box sx={{ position: 'absolute', left: GUTTER, top: HEADER_H, bottom: 0, width: 1, bgcolor: '#E9E6DF' }} />

          {/* Líneas de hora */}
          {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) =>
            i === 0 ? null : (
              <Box
                key={`hr-${i}`}
                sx={{ position: 'absolute', left: GUTTER, right: 0, top: HEADER_H + i * ROW_H - 1, height: 1, bgcolor: '#F2EFE9' }}
              />
            ),
          )}

          {/* Etiquetas 08:00 .. 16:00 */}
          {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => (
            <Typography
              key={`h-${i}`}
              sx={{
                position: 'absolute',
                left: 0,
                top: HEADER_H + i * ROW_H,
                width: GUTTER,
                textAlign: 'center',
                fontSize: 11,
                color: '#64707C',
                fontWeight: 600,
                transform: 'translateY(-50%)',
                zIndex: 4,
              }}
            >
              {String(HOUR_START + i).padStart(2, '0')}:00
            </Typography>
          ))}

          {/* Viajes */}
          {placed.map(({ trip: t, lane, cols }) => {
            const startMin = Math.max(MIN_START, Math.min(MIN_END, toMin(t.serviceRange[0])))
            const endMin = Math.max(MIN_START, Math.min(MIN_END, toMin(t.serviceRange[1])))
            const segTop = ((startMin - MIN_START) / 60) * ROW_H
            const segLen = ((endMin - startMin) / 60) * ROW_H
            const confirmed = t.status === 'Confirmada'
            return (
              <Box
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenTrip(t)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault()
                    onOpenTrip(t)
                  }
                }}
                aria-label={`${t.id} · ${t.client} · ${t.serviceRange.join(' a ')}`}
                sx={{
                  position: 'absolute',
                  left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${lane / cols} + ${GAP_X / 2}px)`,
                  top: HEADER_H + segTop + GAP_Y / 2,
                  height: Math.max(ROW_H * 0.6, segLen - GAP_Y),
                  width: `calc((100% - ${GUTTER}px) / ${cols} - ${GAP_X}px)`,
                  borderRadius: 2,
                  p: 1.4,
                  cursor: 'pointer',
                  outline: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: confirmed ? '#EFF8F2' : '#FFF8EC',
                  border: confirmed ? '1.5px solid #C9E3D2' : '1.5px dashed #E0B45F',
                  boxShadow: '0 1px 2px rgba(19,43,74,0.05)',
                  transition: 'transform 120ms, box-shadow 120ms',
                  '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 10px rgba(19,43,74,0.09)' },
                  overflow: 'hidden',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: brand.navy, whiteSpace: 'nowrap' }}>{t.id}</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Box
                    sx={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.03em',
                      px: 0.8,
                      py: 0.3,
                      borderRadius: 999,
                      bgcolor: confirmed ? '#DCEFE4' : '#F6E3B8',
                      color: confirmed ? '#26734B' : '#7A5713',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {confirmed ? 'CONFIRMADA' : 'Pendiente de seña'}
                  </Box>
                </Stack>
                <Typography sx={{ fontSize: 13, fontWeight: 700, mt: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.client}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#5C6B7A', mt: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.serviceRange.join(' – ')} · Llega {t.arrivalRange[0]}
                </Typography>
                {segLen >= 2 * ROW_H - GAP_Y && (
                  <Typography sx={{ fontSize: 11, color: '#5C6B7A', mt: 0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.origin.barrio} → {t.destination.barrio}
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}