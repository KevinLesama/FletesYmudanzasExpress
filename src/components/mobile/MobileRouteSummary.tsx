import { ArrowDownward } from '@mui/icons-material'
import { Chip, Stack, Typography } from '@mui/material'
import { color } from '../../design/tokens'
import { wrapAnywhere } from './mobileSx'

interface MobileRouteSummaryProps {
  origin: string
  destination: string
  crew?: string
  plate?: string
}

const addressSx = {
  fontSize: 12.5,
  lineHeight: 1.35,
  color: color.inkStrong,
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
  ...wrapAnywhere,
}

/** Two-line-clamped mobile route with an optional crew label and unbroken plate chip. */
export function MobileRouteSummary({ origin, destination, crew, plate }: MobileRouteSummaryProps) {
  return (
    <Stack spacing={0.5} sx={{ mt: 0.75, minWidth: 0 }}>
      <Typography sx={addressSx}>{origin}</Typography>
      <ArrowDownward aria-hidden="true" sx={{ fontSize: 14, color: color.mutedSoft, ml: 0.25 }} />
      <Typography sx={addressSx}>{destination}</Typography>
      {(crew || plate) && (
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0, mt: 0.25 }}>
          {crew && (
            <Typography sx={{ flex: 1, fontSize: 12.5, color: color.inkStrong, ...wrapAnywhere }}>
              {crew}
            </Typography>
          )}
          {plate && (
            <Chip
              label={plate}
              size="small"
              variant="outlined"
              sx={{
                flexShrink: 0,
                whiteSpace: 'nowrap',
                color: color.inkStrong,
                borderColor: color.border,
                '& .MuiChip-label': { whiteSpace: 'nowrap', fontSize: 12 },
              }}
            />
          )}
        </Stack>
      )}
    </Stack>
  )
}
