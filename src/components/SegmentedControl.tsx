import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { color, motion, radius, type as typeScale } from '../design/tokens'

type SegmentedValue = string | number

export interface SegmentedOption<T extends SegmentedValue> {
  value: T
  label: ReactNode
}

interface SegmentedControlProps<T extends SegmentedValue> {
  value: T | null
  options: ReadonlyArray<SegmentedOption<T>>
  onChange: (value: T) => void
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  id?: string
  fullWidth?: boolean
  disabled?: boolean
  sx?: SxProps<Theme>
}

/**
 * Selector segmentado único de la aplicación.
 *
 * La opción activa usa el naranja de acción (color.orangeStrong, el mismo del
 * botón "Nueva solicitud") con texto blanco y peso 700. Las inactivas quedan
 * blancas con borde suave, y todo el grupo comparte el mismo radio exterior.
 */
export function SegmentedControl<T extends SegmentedValue>({
  value,
  options,
  onChange,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  id,
  fullWidth = false,
  disabled = false,
  sx,
}: SegmentedControlProps<T>) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = options.findIndex((option) => option.value === value)

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const { key } = event
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(key)) return

    event.preventDefault()
    const lastIndex = options.length - 1
    const nextIndex =
      key === 'Home'
        ? 0
        : key === 'End'
          ? lastIndex
          : key === 'ArrowRight' || key === 'ArrowDown'
            ? (index === lastIndex ? 0 : index + 1)
            : (index === 0 ? lastIndex : index - 1)

    const nextOption = options[nextIndex]
    if (!nextOption) return

    onChange(nextOption.value)
    optionRefs.current[nextIndex]?.focus()
  }

  return (
    <Box
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-disabled={disabled || undefined}
      sx={[
        {
          display: 'inline-flex',
          alignItems: 'stretch',
          width: fullWidth ? '100%' : 'fit-content',
          maxWidth: '100%',
          bgcolor: color.paper,
          border: `1px solid ${color.border}`,
          borderRadius: `${radius.md}px`,
          overflow: 'hidden',
          verticalAlign: 'middle',
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        const isTabStop = selected || (selectedIndex < 0 && index === 0)

        return (
          <Box
            key={option.value}
            ref={(node: HTMLButtonElement | null) => {
              optionRefs.current[index] = node
            }}
            component="button"
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            tabIndex={isTabStop ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => moveFocus(event, index)}
            sx={{
              flex: fullWidth ? 1 : '0 0 auto',
              minWidth: 0,
              // Mobile touch target; desktop keeps the compact 36px height.
              minHeight: { xs: 44, md: 36 },
              px: 1.6,
              py: 0.65,
              border: 0,
              borderRight: index < options.length - 1 ? `1px solid ${color.border}` : 0,
              bgcolor: color.paper,
              color: color.inkStrong,
              fontFamily: 'inherit',
              fontSize: typeScale.caption,
              fontWeight: 700,
              lineHeight: 1.3,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: `background-color ${motion.fast}, color ${motion.fast}`,
              '&:hover': { bgcolor: disabled ? color.paper : color.sandDeep },
              '&[aria-checked="true"]': {
                bgcolor: disabled ? color.mutedSoft : color.orangeStrong,
                color: color.paper,
              },
              '&[aria-checked="true"]:hover': {
                bgcolor: disabled ? color.mutedSoft : color.orangeInk,
              },
              '&:focus-visible': {
                position: 'relative',
                zIndex: 1,
                outline: `2px solid ${color.navy}`,
                outlineOffset: -3,
              },
              '&:disabled': { cursor: 'not-allowed' },
            }}
          >
            {option.label}
          </Box>
        )
      })}
    </Box>
  )
}
