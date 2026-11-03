import { Box } from '@mui/material'
import { color } from '../design/tokens'

type TruckLoaderSize = 'sm' | 'md' | 'lg'

const SIZES: Record<TruckLoaderSize, { truck: number; track: number }> = {
  sm: { truck: 96, track: 156 },
  md: { truck: 132, track: 212 },
  lg: { truck: 176, track: 276 },
}

/**
 * Decorative truck loader used across every loading surface. An empty box truck
 * drives left to right fading in and out over a dashed road, with speed lines
 * and spinning wheels. Motion is disabled under prefers-reduced-motion.
 */
export function TruckLoader({ size = 'md' }: { size?: TruckLoaderSize }) {
  const { truck, track } = SIZES[size]
  const height = Math.round(truck / 2)

  return (
    <Box
      aria-hidden="true"
      sx={{
        position: 'relative',
        width: track,
        maxWidth: '100%',
        height,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          insetInline: 0,
          bottom: '11%',
          height: 2,
          borderRadius: 999,
          backgroundImage: `repeating-linear-gradient(90deg, ${color.mutedSoft} 0 9px, transparent 9px 20px)`,
          opacity: 0.55,
          '@keyframes truckRoadScroll': {
            from: { backgroundPositionX: '0px' },
            to: { backgroundPositionX: '-20px' },
          },
          animation: 'truckRoadScroll 700ms linear infinite',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: truck,
          opacity: 0,
          '@keyframes truckDrive': {
            '0%': { left: '-70%', opacity: 0 },
            '12%': { opacity: 1 },
            '80%': { opacity: 1 },
            '97%': { left: '100%', opacity: 0 },
            '100%': { left: '100%', opacity: 0 },
          },
          animation: 'truckDrive 3.2s ease-in-out infinite',
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: 1,
          },
        }}
      >
        <Box
          component="svg"
          viewBox="0 0 200 100"
          width="100%"
          focusable="false"
          sx={{
            display: 'block',
            '@keyframes truckWheelSpin': {
              from: { transform: 'rotate(0deg)' },
              to: { transform: 'rotate(360deg)' },
            },
            '@keyframes truckBob': {
              from: { transform: 'translateY(0)' },
              to: { transform: 'translateY(-1.4px)' },
            },
            animation: 'truckBob 700ms ease-in-out infinite alternate',
            '& .truck-wheel': {
              transformBox: 'fill-box',
              transformOrigin: 'center',
              animation: 'truckWheelSpin 800ms linear infinite',
            },
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
              '& .truck-wheel': { animation: 'none' },
            },
          }}
        >
          <rect x="0" y="42" width="10" height="3" rx="1.5" fill={color.mutedSoft} opacity="0.45" />
          <rect x="0" y="52" width="14" height="3" rx="1.5" fill={color.mutedSoft} opacity="0.35" />
          <rect x="0" y="62" width="7" height="3" rx="1.5" fill={color.mutedSoft} opacity="0.45" />

          <rect x="14" y="70" width="172" height="8" rx="3" fill={color.navyDeep} />

          <rect x="14" y="24" width="104" height="46" rx="6" fill={color.navy} />
          <rect x="22" y="31" width="88" height="32" rx="3" fill={color.navySoft} />
          <rect x="22" y="48" width="88" height="6" rx="2" fill={color.orange} />
          <rect x="22" y="31" width="88" height="32" rx="3" fill="none" stroke={color.navyDeep} strokeWidth="1.2" opacity="0.45" />

          <rect x="122" y="34" width="64" height="38" rx="10" fill={color.navy} />
          <rect x="136" y="39" width="28" height="17" rx="4" fill={color.blueSoft} />
          <rect x="149.5" y="39" width="1.6" height="17" fill={color.navy} />
          <rect x="128" y="54" width="8" height="2.5" rx="1.25" fill={color.blueSoft} opacity="0.65" />
          <rect x="180" y="51" width="5" height="8" rx="2" fill={color.orange} />
          <rect x="177" y="67" width="11" height="7" rx="2" fill={color.navyDeep} />

          <g className="truck-wheel">
            <circle cx="42" cy="77" r="11" fill={color.navyDeep} />
            <circle cx="42" cy="77" r="5.5" fill={color.paper} />
            <circle cx="42" cy="77" r="2" fill={color.navyDeep} />
            <path d="M42 72v10M37 77h10" stroke={color.navyDeep} strokeWidth="1.6" strokeLinecap="round" />
          </g>
          <g className="truck-wheel">
            <circle cx="156" cy="77" r="11" fill={color.navyDeep} />
            <circle cx="156" cy="77" r="5.5" fill={color.paper} />
            <circle cx="156" cy="77" r="2" fill={color.navyDeep} />
            <path d="M156 72v10M151 77h10" stroke={color.navyDeep} strokeWidth="1.6" strokeLinecap="round" />
          </g>
        </Box>
      </Box>
    </Box>
  )
}
