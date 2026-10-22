import { Alert, Snackbar } from '@mui/material'
import { shadow } from '../design/tokens'

export type ToastTone = 'success' | 'error'

export interface ToastState {
  message: string
  tone: ToastTone
}

interface ToastProps {
  toast: ToastState | null
  onClose: () => void
}

/**
 * Single feedback surface for the app.
 * The tone is explicit so an error can never look like a success.
 */
export function Toast({ toast, onClose }: ToastProps) {
  return (
    <Snackbar
      open={!!toast}
      autoHideDuration={toast?.tone === 'error' ? 5000 : 3200}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity={toast?.tone ?? 'success'}
        variant="filled"
        onClose={onClose}
        sx={{ boxShadow: shadow.raised }}
      >
        {toast?.message}
      </Alert>
    </Snackbar>
  )
}
