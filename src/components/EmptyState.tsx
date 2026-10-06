import { Box, Typography } from '@mui/material'
import { SearchOff } from '@mui/icons-material'

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
          color: '#8A939E',
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