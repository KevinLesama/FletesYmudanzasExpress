import { Box } from '@mui/material'
import { STATUS_STYLES } from '../theme'

export function StatusChip({ label, dot = true, active }: { label: string; dot?: boolean; active?: boolean }) {
  const s = STATUS_STYLES[label] ?? { bg: '#F1F2F4', text: '#6F7780', dot: '#8A929B' }
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        borderRadius: 999,
        px: 1.25,
        py: 0.5,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        bgcolor: label === 'Confirmar desconocido' ? undefined : s.bg,
        color: s.text,
        opacity: active === false ? 0.55 : 1,
      }}
    >
      {dot && <Box component="span" sx={{ width: 6, height: 6, borderRadius: 999, bgcolor: s.dot, flexShrink: 0 }} />}
      {label}
    </Box>
  )
}