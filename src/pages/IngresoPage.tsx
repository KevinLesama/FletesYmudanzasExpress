import { useState } from 'react'
import {
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  ArrowForward,
  LocalShipping,
  Lock,
  MailOutline,
  Person,
  Shield,
  Visibility,
  VisibilityOff,
  MyLocation,
  LocationOn,
  Route,
} from '@mui/icons-material'
import { R } from '../routes'
import { Brand } from '../components/Brand'
import { brand } from '../theme'

export function IngresoPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const go = (href: string) => {
    window.location.href = href
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: theme.palette.background.default,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          flexGrow: 1,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
          maxWidth: 1200,
          mx: 'auto',
          width: '100%',
          px: { xs: 2.5, md: 6 },
          py: { xs: 3, md: 6 },
          gap: { md: 6 },
        }}
      >
        {/* ---- Brand / hero ---- */}
        <Box sx={{ display: 'flex', flexDirection: 'column', py: { md: 2 } }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                bgcolor: brand.navy,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LocalShipping fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 18, lineHeight: 1.1 }}>
                Fletes Express
              </Typography>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#8A939E' }}>Gestión de viajes</Typography>
            </Box>
          </Stack>

          <Box sx={{ mt: { xs: 4, md: 7 } }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box sx={{ width: 34, height: 2, borderRadius: 4, bgcolor: brand.orange }} />
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.16em',
                  color: brand.orange,
                }}
              >
                ORGANIZACIÓN PARA TODO EL EQUIPO
              </Typography>
            </Stack>
            <Typography
              component="h1"
              sx={{
                mt: 1.5,
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 800,
                fontSize: { xs: 30, md: 40 },
                lineHeight: 1.12,
                letterSpacing: '-0.03em',
                color: brand.navy,
              }}
            >
              La coordinación de tus viajes, en orden
            </Typography>
            <Typography sx={{ mt: 1.5, color: 'text.secondary', fontSize: { xs: 14, md: 15.5 }, maxWidth: 470 }}>
              Planificá cada servicio y mantené choferes, vehículos y horarios en sintonía.
            </Typography>
          </Box>

          {/* Illustration card */}
          <Box
            sx={{
              mt: 4,
              display: { xs: 'none', md: 'block' },
              position: 'relative',
              bgcolor: '#FFFFFF',
              border: '1px solid #E9E6DF',
              borderRadius: 4,
              p: 3,
              maxWidth: 520,
              overflow: 'hidden',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#8A939E', letterSpacing: '0.1em' }}>
                RUTA COORDINADA
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.7}>
                <Box sx={{ width: 8, height: 8, borderRadius: 50, bgcolor: '#4E9A6C' }} />
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#5C6B7A' }}>Listo para planificar</Typography>
              </Stack>
            </Stack>

            <Box sx={{ position: 'relative', my: 4, ml: 2, mr: 2 }}>
              <Box
                sx={{
                  position: 'absolute',
                  left: 20,
                  right: 20,
                  top: -58,
                  borderTop: '2px dashed #D8D3C8',
                }}
              />
              <Stack direction="row" spacing={5} sx={{ position: 'relative' }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ bgcolor: '#FFFFFF' }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: brand.navy,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MyLocation sx={{ fontSize: 17 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#8A939E' }}>PUNTO DE ORIGEN</Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Palermo</Typography>
                  </Box>
                </Stack>

                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    border: '2px solid #E9E6DF',
                    bgcolor: brand.navy,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'center',
                  }}
                >
                  <LocalShipping sx={{ fontSize: 19 }} />
                </Box>

                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: '#F0F2F5',
                      color: brand.navy,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <LocationOn sx={{ fontSize: 17 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#8A939E' }}>PUNTO DE DESTINO</Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Saavedra</Typography>
                  </Box>
                </Stack>
              </Stack>
            </Box>

            <Stack direction="row" alignItems="center" spacing={1}>
              <Shield sx={{ fontSize: 15, color: '#8A939E' }} />
              <Typography sx={{ fontSize: 12.5, color: '#8A939E' }}>Acceso exclusivo para el equipo</Typography>
            </Stack>
          </Box>
        </Box>

        {/* ---- Login form ---- */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault()
              go(R.agenda)
            }}
            sx={{
              width: '100%',
              maxWidth: 420,
              bgcolor: '#FFFFFF',
              border: '1px solid #E9E6DF',
              borderRadius: 4,
              p: { xs: 3, md: 4 },
              boxShadow: '0 2px 6px rgba(19,43,74,0.03)',
            }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: brand.orange }}>
              BIENVENIDO
            </Typography>
            <Typography sx={{ mt: 0.5, fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 24 }}>
              Ingresá a tu cuenta
            </Typography>
            <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: 13.5 }}>
              Usá tus datos de acceso para continuar.
            </Typography>

            <TextField
              fullWidth
              label="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              variant="outlined"
              placeholder="nombre@fletesexpress.com.ar"
              sx={{ mt: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MailOutline sx={{ fontSize: 18, color: '#8A939E' }} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ fontSize: 18, color: '#8A939E' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      onClick={() => setShowPassword((s) => !s)}
                      edge="end"
                      sx={{ color: '#8A939E' }}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 2.5, py: 1.3 }}
              endIcon={<ArrowForward />}
            >
              Ingresar
            </Button>
            <Typography sx={{ mt: 1.5, textAlign: 'center', fontSize: 12.5, color: brand.navy, fontWeight: 600 }}>
              Recuperar contraseña
            </Typography>

            <Divider sx={{ my: 2.5 }}>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#8A939E', px: 1 }}>
                VISTA DE DEMOSTRACIÓN
              </Typography>
            </Divider>

            <Stack spacing={1.2}>
              <Button
                variant="outlined"
                fullWidth
                sx={{ justifyContent: 'flex-start', py: 1.2, color: brand.navy, borderColor: '#D9D4C9' }}
                startIcon={<Person />}
                onClick={() => go(R.agenda)}
              >
                Entrar como administrador
              </Button>
              <Button
                variant="outlined"
                fullWidth
                sx={{ justifyContent: 'flex-start', py: 1.2, color: brand.navy, borderColor: '#D9D4C9' }}
                startIcon={<Person />}
                onClick={() => go(R.chofer)}
              >
                Entrar como chofer
              </Button>
            </Stack>

            <Typography sx={{ mt: 2, textAlign: 'center', fontSize: 11.5, color: '#8A939E' }}>
              Accesos de muestra; no se inicia una sesión real.
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ textAlign: 'center', py: 2.5 }}>
        <Typography sx={{ fontSize: 12, color: '#8A939E' }}>
          Fletes Express <span style={{ opacity: 0.5 }}>•</span> Acceso privado
        </Typography>
      </Box>
    </Box>
  )
}