import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Collapse,
  Fade,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  ArrowBack,
  ArrowForward,
  ErrorOutline,
  LockOutlined,
  LockReset,
  MailOutline,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material'
import { R } from '../routes'
import { api } from '../api'
import { Brand } from '../components/Brand'
import { EtiquetaCampo, MensajeCampo } from '../components/FormFields'
import { motion, radius, space, type } from '../design/tokens'
import { supabase } from '../supabase'

type AuthMode = 'login' | 'request' | 'update'
type LoginField = 'email' | 'password'
type LoginFieldFeedback = Partial<Record<LoginField, string | true>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const AUTH_MODE_COPY: Record<AuthMode, { kicker: string; title: string; description: string; submitting: string; submit: string }> = {
  login: {
    kicker: 'BIENVENIDO',
    title: 'Ingresá a tu cuenta',
    description: 'Usá tus datos de acceso para continuar.',
    submitting: 'Ingresando…',
    submit: 'Ingresar',
  },
  request: {
    kicker: 'RECUPERACIÓN',
    title: 'Recuperá tu acceso',
    description: 'Te enviaremos un enlace seguro al correo de tu cuenta.',
    submitting: 'Enviando…',
    submit: 'Enviar enlace',
  },
  update: {
    kicker: 'NUEVA CONTRASEÑA',
    title: 'Elegí una contraseña nueva',
    description: 'Usá al menos 8 caracteres para proteger tu cuenta.',
    submitting: 'Actualizando…',
    submit: 'Actualizar contraseña',
  },
}

function AnimatedAlert({
  message,
  severity,
  duracionError,
}: {
  message: string | null
  severity: 'error' | 'success'
  duracionError: number
}) {
  const [lastMessage, setLastMessage] = useState(message)

  useEffect(() => {
    if (message) setLastMessage(message)
  }, [message])

  return (
    <Collapse
      in={Boolean(message)}
      timeout={duracionError}
      sx={{ mt: 2, '&.MuiCollapse-hidden': { mt: 0 } }}
    >
      <Fade in={Boolean(message)} timeout={duracionError}>
        <Alert
          severity={severity}
          icon={severity === 'error' ? <ErrorOutline /> : undefined}
          role={severity === 'error' ? 'alert' : 'status'}
          sx={{
            bgcolor: severity === 'error' ? 'error.light' : 'success.light',
            border: 1,
            borderColor: severity === 'error' ? 'error.main' : 'success.main',
            color: severity === 'error' ? 'error.dark' : 'success.dark',
            '& .MuiAlert-icon': { color: severity === 'error' ? 'error.main' : 'success.main' },
          }}
        >
          {lastMessage}
        </Alert>
      </Fade>
    </Collapse>
  )
}

export function IngresoPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [mode, setMode] = useState<AuthMode>(() => (
    new URLSearchParams(window.location.search).get('modo') === 'restablecer' ? 'update' : 'login'
  ))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [fieldFeedback, setFieldFeedback] = useState<LoginFieldFeedback>({})
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const sinAnimacion = isMobile || prefersReducedMotion
  const duracionError = sinAnimacion ? 0 : 200

  const go = (href: string) => {
    window.location.href = href
  }

  useEffect(() => {
    if (!supabase) return undefined

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update')
        setError(null)
        setMessage(null)
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const resetForm = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError(null)
    setMessage(null)
    setSubmitting(false)
  }

  const clearLoginFeedback = (field: LoginField) => {
    setError(null)
    setFieldFeedback((prev) => {
      const next = { ...prev }
      if (field === 'email' || prev.email === true) delete next.email
      if (field === 'password' || prev.password === true) delete next.password
      return next
    })
  }

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextFeedback: LoginFieldFeedback = {}
    if (!email.trim()) nextFeedback.email = 'Ingresá tu correo electrónico.'
    else if (!EMAIL_PATTERN.test(email.trim())) nextFeedback.email = 'El formato del correo no es válido.'
    if (!password) nextFeedback.password = 'Ingresá tu contraseña.'

    if (Object.keys(nextFeedback).length > 0) {
      setFieldFeedback(nextFeedback)
      setError(null)
      return
    }

    setFieldFeedback({})
    setSubmitting(true)
    setError(null)
    if (!supabase) {
      setError('El acceso no está configurado. Faltan las variables de Supabase.')
      setSubmitting(false)
      return
    }
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      // No se muestra el mensaje de GoTrue para no filtrar si el email existe.
      setFieldFeedback({ email: true, password: true })
      setError('No pudimos iniciar sesión. Revisá el email y la contraseña.')
      setSubmitting(false)
      return
    }
    // La sesión de Auth no alcanza: el rol sale de `usuarios` vía /api/me.
    try {
      const user = await api.me()
      go(user.role === 'chofer' ? R.chofer : R.agenda)
    } catch {
      // Cuenta de Auth sin perfil habilitado como personal de la empresa.
      await supabase.auth.signOut()
      setError('Esta cuenta no está habilitada. Hablá con administración.')
      setSubmitting(false)
    }
  }

  const requestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage(null)
    if (!supabase) {
      setError('El acceso no está configurado. Faltan las variables de Supabase.')
      setSubmitting(false)
      return
    }

    const redirectTo = `${window.location.origin}${R.ingreso}?modo=restablecer`
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (authError) {
      setError('No pudimos enviar el enlace. Revisá el correo e intentá nuevamente.')
      setSubmitting(false)
      return
    }

    setMessage('Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.')
    setSubmitting(false)
  }

  const validateRequestEmail = (e: React.FormEvent) => {
    e.preventDefault()
    const nextFeedback: LoginFieldFeedback = {}
    if (!email.trim()) nextFeedback.email = 'Ingresá tu correo.'
    else if (!EMAIL_PATTERN.test(email.trim())) nextFeedback.email = 'El formato del correo no es válido.'

    if (Object.keys(nextFeedback).length > 0) {
      setFieldFeedback(nextFeedback)
      setError(null)
      return
    }

    setFieldFeedback({})
    void requestPasswordReset(e)
  }

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage(null)
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.')
      setSubmitting(false)
      return
    }
    if (newPassword !== passwordConfirmation) {
      setError('Las contraseñas no coinciden.')
      setSubmitting(false)
      return
    }
    if (!supabase) {
      setError('El acceso no está configurado. Faltan las variables de Supabase.')
      setSubmitting(false)
      return
    }

    const { error: authError } = await supabase.auth.updateUser({ password: newPassword })
    if (authError) {
      setError('No pudimos actualizar la contraseña. Volvé a solicitar un enlace.')
      setSubmitting(false)
      return
    }

    await supabase.auth.signOut()
    setNewPassword('')
    setPasswordConfirmation('')
    setMode('login')
    setMessage('Tu contraseña fue actualizada. Ya podés ingresar con la nueva contraseña.')
    setSubmitting(false)
  }

  const formSubmit = { login: signIn, request: validateRequestEmail, update: updatePassword }[mode]
  const modeCopy = AUTH_MODE_COPY[mode]
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
      <Box
        sx={{
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
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
          <Box
            sx={{
              mt: `${space.xl}px`,
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              gap: `${space.lg}px`,
              flexShrink: 0,
            }}
          >
            <Box aria-hidden="true" sx={{ height: '1px', flex: 1, bgcolor: 'divider' }} />
            <Typography
              component="p"
              sx={{
                m: 0,
                fontSize: type.body,
                fontWeight: 500,
                lineHeight: 1.4,
                color: 'text.secondary',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              Gestión de viajes
            </Typography>
            <Box aria-hidden="true" sx={{ height: '1px', flex: 1, bgcolor: 'divider' }} />
          </Box>
        </Box>

        <Card
          component="main"
          sx={{
            width: '100%',
            p: { xs: 2.5, sm: 4 },
            borderRadius: `${radius.lg}px`,
            flexShrink: 0,
          }}
        >
          <Box component="form" onSubmit={formSubmit} noValidate>
            <Typography
              variant="overline"
              sx={{
                display: 'block',
                fontWeight: 800,
                lineHeight: 1.4,
                letterSpacing: '0.14em',
                color: 'secondary.dark',
              }}
            >
              {modeCopy.kicker}
            </Typography>
            <Typography
              component="h1"
              variant="h4"
              sx={{ mt: 0.5, color: 'text.primary', fontSize: type.display }}
            >
              {modeCopy.title}
            </Typography>
            <Typography sx={{ mt: 1, fontSize: type.body, lineHeight: 1.5, color: 'text.secondary' }}>
              {modeCopy.description}
            </Typography>

            <AnimatedAlert
              message={error}
              severity="error"
              duracionError={duracionError}
            />
            <AnimatedAlert
              message={message}
              severity="success"
              duracionError={duracionError}
            />

            {mode !== 'update' && (
              <Box sx={{ mt: error || message ? 1.5 : 2.5 }}>
                <EtiquetaCampo text="Correo electrónico" htmlFor="login-email" />
                <TextField
                  id="login-email"
                  fullWidth
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    clearLoginFeedback('email')
                  }}
                  placeholder="nombre@fletesexpress.com.ar"
                  error={Boolean(fieldFeedback.email)}
                  inputProps={{
                    'aria-describedby': typeof fieldFeedback.email === 'string' ? 'login-email-helper' : undefined,
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ ml: 0, mr: 0.75, width: 20, flexShrink: 0 }}>
                        <MailOutline sx={{ fontSize: 20, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <MensajeCampo
                  id="login-email-helper"
                  mensaje={typeof fieldFeedback.email === 'string' ? fieldFeedback.email : null}
                  sinAnimacion={sinAnimacion}
                />
              </Box>
            )}

            {mode === 'login' && (
              <Box sx={{ mt: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <EtiquetaCampo text="Contraseña" htmlFor="login-password" />
                  <Button
                    type="button"
                    onClick={() => resetForm('request')}
                    sx={{
                      position: 'relative',
                      minWidth: 0,
                      minHeight: 20,
                      mr: 0,
                      px: 0,
                      py: 0,
                      fontSize: type.caption,
                      lineHeight: '20px',
                      color: 'secondary.dark',
                      transition: `color ${motion.fast}`,
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        left: '-8px',
                        right: '-8px',
                        top: '-12px',
                        bottom: '-12px',
                      },
                      '&:hover': { color: 'secondary.main', bgcolor: 'transparent' },
                    }}
                  >
                    Recuperar contraseña
                  </Button>
                </Box>
                <TextField
                  id="login-password"
                  fullWidth
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    clearLoginFeedback('password')
                  }}
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                  error={Boolean(fieldFeedback.password)}
                  inputProps={{
                    'aria-describedby': typeof fieldFeedback.password === 'string' ? 'login-password-helper' : undefined,
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ ml: 0, mr: 0.75, width: 20, flexShrink: 0 }}>
                        <LockOutlined sx={{ fontSize: 20, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          onClick={() => setShowPassword((s) => !s)}
                          edge="end"
                          sx={{ p: 1.5, color: 'text.secondary' }}
                        >
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <MensajeCampo
                  id="login-password-helper"
                  mensaje={typeof fieldFeedback.password === 'string' ? fieldFeedback.password : null}
                  sinAnimacion={sinAnimacion}
                />
              </Box>
            )}

            {mode === 'update' && (
              <>
                <Box sx={{ mt: error || message ? 1.5 : 2.5 }}>
                  <EtiquetaCampo text="Nueva contraseña" htmlFor="new-password" />
                  <TextField
                    id="new-password"
                    fullWidth
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type={showNewPassword ? 'text' : 'password'}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start" sx={{ ml: 0, mr: 0.75, width: 20, flexShrink: 0 }}>
                          <LockReset sx={{ fontSize: 20, color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showNewPassword ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'}
                            onClick={() => setShowNewPassword((s) => !s)}
                            edge="end"
                            sx={{ p: 1.5, color: 'text.secondary' }}
                          >
                            {showNewPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>
                <Box sx={{ mt: 1.5 }}>
                  <EtiquetaCampo text="Repetí la nueva contraseña" htmlFor="password-confirmation" />
                  <TextField
                    id="password-confirmation"
                    fullWidth
                    required
                    autoComplete="new-password"
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    type="password"
                  />
                </Box>
              </>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={submitting}
              sx={{
                ...botonAccionSx,
                mt: 2,
              }}
              endIcon={<ArrowForward />}
            >
              {submitting ? modeCopy.submitting : modeCopy.submit}
            </Button>
            {mode !== 'login' && (
              <Button
                type="button"
                onClick={() => resetForm('login')}
                fullWidth
                variant="outlined"
                startIcon={<ArrowBack />}
                sx={{
                  ...botonAccionSx,
                  mt: 1,
                  color: 'primary.main',
                  borderColor: 'divider',
                  borderWidth: '1px',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    borderColor: 'divider',
                    borderWidth: '1px',
                  },
                }}
              >
                Volver al ingreso
              </Button>
            )}
          </Box>
        </Card>

        <Typography
          sx={{
            mt: { xs: 'clamp(14px, 2.5vh, 26px)', sm: 2 },
            textAlign: 'center',
            fontSize: type.caption,
            color: 'text.secondary',
          }}
        >
          Fletes Express <span style={{ opacity: 0.5 }}>•</span> Acceso privado
        </Typography>
      </Box>
    </Box>
  )
}