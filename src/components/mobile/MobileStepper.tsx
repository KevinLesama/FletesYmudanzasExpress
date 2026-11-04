import { Box, Typography } from '@mui/material'
import { color, motion } from '../../design/tokens'

export interface MobileStepperProps {
  steps: string[]
  /** Zero-based index of the current step. */
  active: number
}

/**
 * Compact stepper for the mobile multi-step forms: "Paso 2 de 3 · Servicio"
 * plus a segmented progress bar. Replaces the tall vertical `Stepper`.
 *
 * Mobile-only: render it inside an `isMobile` branch.
 */
export function MobileStepper({ steps, active }: MobileStepperProps) {
  const total = steps.length
  const current = Math.min(Math.max(active, 0), Math.max(total - 1, 0))
  const label = steps[current] ?? ''

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: color.orangeInk,
          }}
        >
          Paso {current + 1} de {total}
        </Typography>
        <Typography sx={{ fontSize: 15, fontWeight: 800, color: color.navy }}>{label}</Typography>
      </Box>

      <Box
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current + 1}
        aria-label={`Paso ${current + 1} de ${total}: ${label}`}
        sx={{ display: 'flex', gap: 0.75 }}
      >
        {steps.map((step, index) => (
          <Box
            key={step}
            sx={{
              flex: 1,
              height: 4,
              borderRadius: '999px',
              bgcolor: index <= current ? color.orangeStrong : color.border,
              transition: `background-color ${motion.base}`,
            }}
          />
        ))}
      </Box>
    </Box>
  )
}
