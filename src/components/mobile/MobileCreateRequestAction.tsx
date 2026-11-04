import { Fab } from '@mui/material'
import { Add } from '@mui/icons-material'
import { color, shadow, space } from '../../design/tokens'
import { brand } from '../../theme'
import { R } from '../../routes'
import { MOBILE_FOCUS_RING, MOBILE_SAFE_BOTTOM } from './mobileSx'

/** Fixed mobile action used where request creation is available. */
export function MobileCreateRequestAction() {
  return (
    <Fab
      component="a"
      href={R.nuevaSolicitud}
      aria-label="Nueva solicitud"
      title="Nueva solicitud"
      sx={{
        position: 'fixed',
        right: space.lg,
        bottom: `calc(${MOBILE_SAFE_BOTTOM} + ${space.lg}px)`,
        zIndex: (theme) => theme.zIndex.fab,
        width: 56,
        height: 56,
        p: 0,
        borderRadius: '50%',
        bgcolor: brand.orangeStrong,
        color: color.paper,
        boxShadow: shadow.raised,
        '&:hover': { bgcolor: brand.orangeInk, boxShadow: shadow.raised },
        '&:active': { bgcolor: brand.orangeInk },
        ...MOBILE_FOCUS_RING,
      }}
    >
      <Add />
    </Fab>
  )
}
