import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ArrowBack, LockReset, LocalShipping, MailOutline, Visibility, VisibilityOff } from '@mui/icons-material'
import { R } from '../routes'
import { brand, theme } from '../theme'
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
    <Box sx={{ minHeight: '100vh', bgcolor: theme.palette.background.default, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2.5, py: 5 }}>
        <Box sx={{ width: '100%', maxWidth: 430 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
            <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: brand.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LocalShipping fontSize="small" />
            </Box>
            <Box>
              <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 18, lineHeight: 1.1 }}>Fletes Express</Typography>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#64707C' }}>Acceso del equipo</Typography>
            </Box>
          </Stack>

          <Box component="form" onSubmit={isUpdate ? updatePassword : requestReset} sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 4, p: { xs: 3, md: 4 }, boxShadow: '0 2px 6px rgba(19,43,74,0.03)' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: brand.orangeInk }}>
              {isUpdate ? 'NUEVA CONTRASEÑA' : 'RECUPERACIÓN'}
            </Typography>
            <Typography sx={{ mt: 0.5, fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 24 }}>{title}</Typography>
            <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: 13.5 }}>{description}</Typography>

            {mode === 'request' && <TextField
              fullWidth
              label="Correo electrónico"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              margin="normal"
              sx={{ mt: 3 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><MailOutline sx={{ fontSize: 18, color: '#64707C' }} /></InputAdornment> }}
            />}

            {mode === 'sent' && (
              <Alert severity="success" sx={{ mt: 3, borderRadius: 2 }}>
                Revisá también la carpeta de spam. El enlace vence según la configuración de Supabase.
              </Alert>
            )}

            {isUpdate && <>
              <TextField
                fullWidth
                label="Nueva contraseña"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                margin="normal"
                sx={{ mt: 3 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><LockReset sx={{ fontSize: 18, color: '#64707C' }} /></InputAdornment>,
                  endAdornment: <InputAdornment position="end"><IconButton aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((value) => !value)} edge="end">{showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment>,
                }}
              />
              <TextField fullWidth label="Repetí la nueva contraseña" type="password" required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} margin="normal" />
            </>}

            {error && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{error}</Alert>}

            {mode === 'request' && <Button type="submit" fullWidth variant="contained" size="large" disabled={submitting} sx={{ mt: 2.5, py: 1.3 }} endIcon={<LockReset />}>
              {submitting ? 'Enviando enlace…' : 'Enviar enlace de recuperación'}
            </Button>}
            {isUpdate && <Button type="submit" fullWidth variant="contained" size="large" disabled={submitting} sx={{ mt: 2.5, py: 1.3 }} endIcon={<LockReset />}>
              {submitting ? 'Actualizando…' : 'Actualizar contraseña'}
            </Button>}
            {mode === 'sent' && <Button type="button" fullWidth variant="outlined" onClick={resetToRequest} sx={{ mt: 2.5 }}>Volver a solicitar</Button>}

            <Button type="button" variant="text" onClick={() => { window.location.href = R.ingreso }} sx={{ mt: 1, width: '100%', color: brand.navy }} startIcon={<ArrowBack />}>
              Volver al ingreso
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
