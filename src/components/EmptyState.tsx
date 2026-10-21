import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { ErrorOutline, SearchOff } from '@mui/icons-material'

export function EmptyState({ title, subtext }: { title: string; subtext: string }) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 6,
        px: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          bgcolor: '#F0F2F5',
          color: '#6E7A87',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1,
        }}
      >
        <SearchOff />
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{title}</Typography>
      <Typography sx={{ fontSize: 13.5, color: 'text.secondary', maxWidth: 380 }}>{subtext}</Typography>
    </Box>
  )
}

export function LoadingState({ label = 'Cargando...' }: { label?: string }) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      <CircularProgress size={26} sx={{ color: '#132B4A' }} />
      <Typography sx={{ fontSize: 13.5, color: '#6E7A87' }}>{label}</Typography>
    </Box>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          bgcolor: '#FFF3EF',
          color: '#9C493A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1,
        }}
      >
        <ErrorOutline />
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: 15 }}>No pudimos cargar los datos</Typography>
      <Typography sx={{ fontSize: 13.5, color: 'text.secondary', maxWidth: 420 }}>{message}</Typography>
      {onRetry && (
        <Button variant="outlined" size="small" onClick={onRetry} sx={{ mt: 1, color: '#132B4A', borderColor: '#D9D4C9' }}>
          Reintentar
        </Button>
      )}
    </Box>
  )
}
