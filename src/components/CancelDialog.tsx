import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import { Block, Close } from '@mui/icons-material'
import { color } from '../design/tokens'

/**
 * Confirmacion de cancelacion de un viaje.
 *
 * El estado `cancelada` es terminal en la base (`fn_validar_transicion_estado`)
 * y el DELETE fisico esta prohibido: cancelar es la unica baja posible. La
 * solicitud cancelada se oculta del listado y vuelve con "Mostrar canceladas".
 */
export function CancelDialog({
  open,
  onClose,
  onConfirm,
  requestId,
  busy = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  requestId: string
  busy?: boolean
}) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ px: 3, pt: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: color.redSoft, color: color.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Block sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 17 }}>Cancelar viaje</Typography>
            <Typography sx={{ fontSize: 12.5, color: color.muted }}>{requestId}</Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={onClose} aria-label="Cerrar" disabled={busy}>
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 2 }}>
        <Typography sx={{ fontSize: 13.5, color: color.inkStrong }}>
          ¿Estás seguro de cancelar el viaje {requestId}? El cliente dejará de verlo, se liberará la asignación de chofer y vehículo, y la solicitud se ocultará del listado.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Button onClick={onClose} disabled={busy} sx={{ color: color.ink }}>
          Volver
        </Button>
        <Button
          variant="contained"
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Block />}
          sx={{ bgcolor: color.red, '&:hover': { bgcolor: color.red } }}
          onClick={onConfirm}
        >
          Sí, cancelar viaje
        </Button>
      </DialogActions>
    </Dialog>
  )
}
