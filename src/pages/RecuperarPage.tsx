import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import { ArrowBack, LockReset, MailOutline, Visibility, VisibilityOff } from '@mui/icons-material'
import { R } from '../routes'
import { Brand } from '../components/Brand'
import { EtiquetaCampo } from '../components/FormFields'
import { radius, space, type } from '../design/tokens'
import { supabase } from '../supabase'

type RecoveryMode = 'request' | 'sent' | 'update'

const RECOVERY_COPY: Record<RecoveryMode, { title: string; description: string }> = {
  request: {
    title: 'Recuperá tu acceso',
    description: 'Te enviaremos un enlace seguro al correo de tu cuenta.',
  },
  sent: {
    title: 'Revisá tu correo',
    description: 'Si el correo está registrado, recibirás un enlace para continuar.',
  },
  update: {
    title: 'Elegí una contraseña nueva',
    description: 'Usá al menos 8 caracteres para proteger tu cuenta.',
  },
}

export function RecuperarPage() {
  const [mode, setMode] = useState<RecoveryMode>(() => (
    new URLSearchParams(window.location.search).get('modo') === 'restablecer' ? 'update' : 'request'
  ))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const botonAccionSx = {
    height: 56,
    minHeight: 56,
    boxSizing: 'border-box',
    py: 1.5,
    borderRadius: `${radius.md}px`,
    fontSize: type.lead,
    fontWeight: 700,
    '& .MuiButton-startIcon svg, & .MuiButton-endIcon svg': {
      width: 20,
      height: 20,
    },
  }

  useEffect(() => {
    if (!supabase) return undefined

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update')
        setError(null)
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const requestReset = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    if (!supabase) {
      setError('El acceso no está configurado. Faltan las variables de Supabase.')
      setSubmitting(false)
      return
    }

    const redirectTo = `${window.location.origin}${R.recuperar}?modo=restablecer`
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (authError) {
      setError('No pudimos enviar el enlace. Revisá el correo e intentá nuevamente.')
    } else {
      setMode('sent')
    }
    setSubmitting(false)
  }

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    if (password.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.')
      setSubmitting(false)
      return
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      setSubmitting(false)
      return
    }
    if (!supabase) {
      setError('El acceso no está configurado. Faltan las variables de Supabase.')
      setSubmitting(false)
      return
    }

    const { error: authError } = await supabase.auth.updateUser({ password })
    if (authError) {
      setError('No pudimos actualizar la contraseña. Volvé a solicitar un enlace.')
      setSubmitting(false)
      return
    }

    await supabase.auth.signOut()
    window.location.href = `${R.ingreso}?password=actualizada`
  }

  const resetToRequest = () => {
    setMode('request')
    setError(null)
  }

  const isUpdate = mode === 'update'
  const { title, description } = RECOVERY_COPY[mode]

  return (
    <Box
      sx={{
        minHeight: '100vh',
        '@supports (min-height: 100dvh)': { minHeight: '100dvh' },
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        pt: { xs: 10, sm: 12 },
        pb: 4,
        px: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <Box
          component="header"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            mb: `${space.xxl}px`,
            flexShrink: 0,
          }}
        >
          <Box sx={{ flexShrink: 0 }}>
            <Brand subtitle="" size="login" />
          </Box>
          <Box sx={{ mt: `${space.xl}px`, display: 'flex', alignItems: 'center', width: '100%', gap: `${space.lg}px`, flexShrink: 0 }}>
            <Box aria-hidden="true" sx={{ height: '1px', flex: 1, bgcolor: 'divider' }} />
            <Typography component="p" sx={{ m: 0, fontSize: type.body, fontWeight: 500, lineHeight: 1.4, color: 'text.secondary', textAlign: 'center', whiteSpace: 'nowrap' }}>
              Gestión de viajes
            </Typography>
            <Box aria-hidden="true" sx={{ height: '1px', flex: 1, bgcolor: 'divider' }} />
          </Box>
        </Box>

        <Card component="main" sx={{ width: '100%', p: { xs: 2.5, sm: 4 }, borderRadius: `${radius.lg}px`, flexShrink: 0 }}>
          <Box component="form" onSubmit={isUpdate ? updatePassword : requestReset} noValidate>
            <Typography variant="overline" sx={{ display: 'block', fontWeight: 800, lineHeight: 1.4, letterSpacing: '0.14em', color: 'secondary.dark' }}>
              {isUpdate ? 'NUEVA CONTRASEÑA' : 'RECUPERACIÓN'}
            </Typography>
            <Typography component="h1" variant="h4" sx={{ mt: 0.5, color: 'text.primary', fontSize: type.display }}>
              {title}
            </Typography>
            <Typography sx={{ mt: 1, fontSize: type.body, lineHeight: 1.5, color: 'text.secondary' }}>{description}</Typography>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

            {mode === 'request' && (
              <Box sx={{ mt: error ? 1.5 : 2.5 }}>
                <EtiquetaCampo text="Correo electrónico" htmlFor="recovery-email" />
                <TextField
                  id="recovery-email"
                  fullWidth
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@fletesexpress.com.ar"
                  InputProps={{ startAdornment: <InputAdornment position="start"><MailOutline sx={{ fontSize: 20, color: 'text.secondary' }} /></InputAdornment> }}
                />
              </Box>
            )}

            {mode === 'sent' && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Revisá también la carpeta de spam. El enlace vence según la configuración de Supabase.
              </Alert>
            )}

            {isUpdate && (
              <>
                <Box sx={{ mt: error ? 1.5 : 2.5 }}>
                  <EtiquetaCampo text="Nueva contraseña" htmlFor="recovery-password" />
                  <TextField
                    id="recovery-password"
                    fullWidth
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><LockReset sx={{ fontSize: 20, color: 'text.secondary' }} /></InputAdornment>,
                      endAdornment: <InputAdornment position="end"><IconButton aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((value) => !value)} edge="end" sx={{ p: 1.5, color: 'text.secondary' }}>{showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment>,
                    }}
                  />
                </Box>
                <Box sx={{ mt: 1.5 }}>
                  <EtiquetaCampo text="Repetí la nueva contraseña" htmlFor="recovery-confirmation" />
                  <TextField id="recovery-confirmation" fullWidth required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type="password" />
                </Box>
              </>
            )}

            {mode === 'request' && (
              <Button type="submit" fullWidth variant="contained" disabled={submitting} sx={{ ...botonAccionSx, mt: 2 }} endIcon={<LockReset />}>
                {submitting ? 'Enviando enlace…' : 'Enviar enlace de recuperación'}
              </Button>
            )}
            {isUpdate && (
              <Button type="submit" fullWidth variant="contained" disabled={submitting} sx={{ ...botonAccionSx, mt: 2 }} endIcon={<LockReset />}>
                {submitting ? 'Actualizando…' : 'Actualizar contraseña'}
              </Button>
            )}
            {mode === 'sent' && (
              <Button type="button" fullWidth variant="outlined" onClick={resetToRequest} sx={{ ...botonAccionSx, mt: 2 }}>
                Volver a solicitar
              </Button>
            )}
            <Button type="button" fullWidth variant="outlined" onClick={() => { window.location.href = R.ingreso }} startIcon={<ArrowBack />} sx={{ ...botonAccionSx, mt: 1, color: 'primary.main', borderColor: 'divider' }}>
              Volver al ingreso
            </Button>
          </Box>
        </Card>

        <Typography sx={{ mt: { xs: 'clamp(14px, 2.5vh, 26px)', sm: 2 }, textAlign: 'center', fontSize: type.caption, color: 'text.secondary' }}>
          Fletes Express <span style={{ opacity: 0.5 }}>•</span> Acceso privado
        </Typography>
      </Box>
    </Box>
  )
}
