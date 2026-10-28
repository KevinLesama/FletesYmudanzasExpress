import { useRef, useState, type ComponentType, type ReactNode } from 'react'
import {
  Avatar,
  Box,
  Button,
  Divider,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import type { SvgIconProps } from '@mui/material/SvgIcon'
import {
  CameraAlt,
  Computer,
  CreditCard,
  LaptopMac,
  LockOutlined,
  NotificationsNone,
  PersonOutline,
  PhoneIphone,
  TabletMac,
} from '@mui/icons-material'
import { AppShell } from '../components/AppShell'
import { Toast, type ToastState } from '../components/Toast'
import { color, radius, type } from '../design/tokens'
import { ars } from '../format'
import {
  loadSettings,
  saveSettings,
  type IdleTimeout,
  type NotificationKey,
  type SettingsState,
} from '../settingsStore'

type SectionKey = 'perfil' | 'notificaciones' | 'seguridad' | 'facturacion'

const SECTIONS: { key: SectionKey; label: string; icon: ComponentType<SvgIconProps> }[] = [
  { key: 'perfil', label: 'Perfil', icon: PersonOutline },
  { key: 'notificaciones', label: 'Notificaciones', icon: NotificationsNone },
  { key: 'seguridad', label: 'Seguridad', icon: LockOutlined },
  { key: 'facturacion', label: 'Facturación', icon: CreditCard },
]

const TIME_ZONES = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { value: 'America/Montevideo', label: 'Montevideo (GMT-3)' },
  { value: 'America/Santiago', label: 'Santiago (GMT-3)' },
  { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
]

const IDLE_TIMEOUTS: { value: IdleTimeout; label: string }[] = [
  { value: 'never', label: 'Nunca' },
  { value: '1h', label: 'Después de 1 hora' },
  { value: '8h', label: 'Después de 8 horas' },
  { value: '24h', label: 'Después de 24 horas' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_PHOTO_BYTES = 400_000

interface Session {
  id: string
  icon: ComponentType<SvgIconProps>
  name: string
  detail: string
  current?: boolean
}

const SESSIONS: Session[] = [
  { id: 'mac', icon: LaptopMac, name: 'MacBook Pro · Safari', detail: 'Buenos Aires · activo ahora', current: true },
  { id: 'iphone', icon: PhoneIphone, name: 'iPhone 16 · Safari', detail: 'Buenos Aires · hace 2 horas' },
  { id: 'ipad', icon: TabletMac, name: 'iPad Air · Safari', detail: 'Rosario · ayer' },
  { id: 'pc', icon: Computer, name: 'Windows · Chrome', detail: 'Córdoba · hace 12 días' },
]

const INVOICES = [
  { id: 'SEP', month: 'Septiembre 2026', amount: 92500, state: 'Pagada' },
  { id: 'AGO', month: 'Agosto 2026', amount: 92500, state: 'Pagada' },
  { id: 'JUL', month: 'Julio 2026', amount: 88000, state: 'Pagada' },
]

function PanelHead({ title, description }: { title: string; description: string }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        component="h2"
        sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 18, color: color.navy }}
      >
        {title}
      </Typography>
      <Typography sx={{ fontSize: type.caption, color: color.muted, mt: '3px' }}>{description}</Typography>
    </Box>
  )
}

function GroupLabel({ children }: { children: string }) {
  return (
    <Typography sx={{ fontSize: type.caption, fontWeight: 700, color: color.inkStrong, pt: 1.5, pb: 0.5 }}>
      {children}
    </Typography>
  )
}

function SettingRow({
  title,
  description,
  control,
  divided = true,
}: {
  title: string
  description: string
  control: ReactNode
  divided?: boolean
}) {
  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      spacing={2}
      sx={{ py: 1.7, borderTop: divided ? `1px solid ${color.borderSoft}` : 'none' }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: type.body, fontWeight: 700, color: color.navy }}>{title}</Typography>
        <Typography sx={{ fontSize: type.caption, color: color.muted, mt: '2px' }}>{description}</Typography>
      </Box>
      <Box sx={{ flexShrink: 0, mt: '1px' }}>{control}</Box>
    </Stack>
  )
}

export function AjustesPage() {
  const [section, setSection] = useState<SectionKey>('perfil')
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings())
  const [toast, setToast] = useState<ToastState | null>(null)
  const [nameDraft, setNameDraft] = useState(settings.profile.name)
  const [emailDraft, setEmailDraft] = useState(settings.profile.email)
  const [emailError, setEmailError] = useState('')
  const [sessions, setSessions] = useState(SESSIONS)
  const fileRef = useRef<HTMLInputElement>(null)

  const persist = (patch: Partial<SettingsState>) => setSettings(saveSettings(patch))
  const ok = (message: string) => setToast({ message, tone: 'success' })
  const fail = (message: string) => setToast({ message, tone: 'error' })

  const commitName = () => {
    const name = nameDraft.trim()
    if (!name) {
      setNameDraft(settings.profile.name)
      fail('El nombre no puede quedar vacío.')
      return
    }
    if (name === settings.profile.name) return
    persist({ profile: { ...settings.profile, name } })
    ok('Nombre actualizado.')
  }

  const commitEmail = () => {
    const email = emailDraft.trim()
    if (!EMAIL_RE.test(email)) {
      setEmailError('Ingresá un email válido.')
      return
    }
    setEmailError('')
    if (email === settings.profile.email) return
    persist({ profile: { ...settings.profile, email } })
    ok('Email actualizado.')
  }

  const setPhoto = (file: File) => {
    if (file.size > MAX_PHOTO_BYTES) {
      fail('La foto tiene que pesar menos de 400 KB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      persist({ profile: { ...settings.profile, photo: String(reader.result) } })
      ok('Foto actualizada.')
    }
    reader.onerror = () => fail('No pudimos leer la imagen.')
    reader.readAsDataURL(file)
  }

  const removePhoto = () => {
    persist({ profile: { ...settings.profile, photo: undefined } })
    ok('Volvimos a las iniciales.')
  }

  const toggleNotification = (key: NotificationKey, value: boolean) =>
    persist({ notifications: { ...settings.notifications, [key]: value } })

  const notificationRow = (key: NotificationKey, title: string, description: string, divided = true) => (
    <SettingRow
      title={title}
      description={description}
      divided={divided}
      control={
        <Switch
          checked={settings.notifications[key]}
          onChange={(event) => toggleNotification(key, event.target.checked)}
          inputProps={{ 'aria-label': title }}
        />
      }
    />
  )

  const signOutSession = (session: Session) => {
    setSessions((list) => list.filter((item) => item.id !== session.id))
    ok(`Cerramos la sesión de ${session.name}.`)
  }

  const panel = {
    perfil: (
      <>
        <PanelHead title="Perfil" description="Así te ve el resto del equipo en la agenda y en los viajes." />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Avatar
            src={settings.profile.photo ?? '/avatar-nievasys.jpg'}
            alt={settings.profile.name}
            sx={{ width: 64, height: 64, border: `1px solid ${color.border}` }}
          >
            {settings.profile.name.slice(0, 1)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: color.navy }}>
              {settings.profile.name}
            </Typography>
            <Typography sx={{ fontSize: type.caption, color: color.muted }}>
              {settings.profile.role} · Fletes Express
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CameraAlt sx={{ fontSize: 18 }} />}
                onClick={() => fileRef.current?.click()}
                sx={{ borderColor: color.border, color: color.navy, '&:hover': { borderColor: color.mutedSoft } }}
              >
                Cambiar foto
              </Button>
              <Button
                size="small"
                onClick={removePhoto}
                disabled={!settings.profile.photo}
                sx={{ color: color.ink }}
              >
                Quitar
              </Button>
            </Stack>
          </Box>
        </Stack>

        <Divider sx={{ my: 3, borderColor: color.borderSoft }} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <TextField
            label="Nombre y apellido"
            size="small"
            fullWidth
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={commitName}
          />
          <TextField
            label="Cargo"
            size="small"
            fullWidth
            value={settings.profile.role}
            onChange={(event) => persist({ profile: { ...settings.profile, role: event.target.value } })}
          />
          <TextField
            label="Email"
            size="small"
            fullWidth
            type="email"
            value={emailDraft}
            error={Boolean(emailError)}
            helperText={emailError || 'Se usa para ingresar y para las notificaciones.'}
            onChange={(event) => setEmailDraft(event.target.value)}
            onBlur={commitEmail}
          />
          <TextField
            select
            label="Zona horaria"
            size="small"
            fullWidth
            value={settings.profile.timezone}
            onChange={(event) => {
              persist({ profile: { ...settings.profile, timezone: event.target.value } })
              ok('Zona horaria actualizada.')
            }}
          >
            {TIME_ZONES.map((zone) => (
              <MenuItem key={zone.value} value={zone.value}>
                {zone.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </>
    ),
    notificaciones: (
      <>
        <PanelHead title="Notificaciones" description="Elegí qué querés recibir y cuándo." />

        <GroupLabel>Email</GroupLabel>
        {notificationRow('emailRequests', 'Solicitudes nuevas', 'Cuando entra una solicitud o alguien te menciona.', false)}
        {notificationRow('emailWeekly', 'Resumen semanal', 'Un repaso de los viajes de la semana, los lunes.')}
        {notificationRow('emailProduct', 'Novedades del producto', 'Funciones nuevas y cambios, una vez por mes.')}

        <Box sx={{ mt: 2.5 }}>
          <GroupLabel>En el dispositivo</GroupLabel>
          {notificationRow('deviceMessages', 'Mensajes del equipo', 'Mensajes que te mandan a vos o a un grupo donde estás.', false)}
          {notificationRow('deviceReminders', 'Recordatorios de viajes', 'Servicios y llegadas, 15 minutos antes.')}
          {notificationRow('quietOvernight', 'Silenciar de noche', 'Guardamos las notificaciones y te las damos juntas a la mañana.')}
        </Box>
      </>
    ),
    seguridad: (
      <>
        <PanelHead title="Seguridad" description="Protegé tu cuenta y revisá dónde iniciaste sesión." />

        <GroupLabel>Ingreso</GroupLabel>
        <SettingRow
          title="Verificación en dos pasos"
          description="Pedimos un código de tu aplicación de autenticación en dispositivos nuevos."
          divided={false}
          control={
            <Switch
              checked={settings.security.twoFactor}
              onChange={(event) => {
                persist({ security: { ...settings.security, twoFactor: event.target.checked } })
                ok(event.target.checked ? 'Verificación en dos pasos activada.' : 'Verificación en dos pasos desactivada.')
              }}
              inputProps={{ 'aria-label': 'Verificación en dos pasos' }}
            />
          }
        />
        <SettingRow
          title="Avisos de ingreso"
          description="Te avisamos por email cuando entra un dispositivo nuevo."
          control={
            <Switch
              checked={settings.security.signInAlerts}
              onChange={(event) => {
                persist({ security: { ...settings.security, signInAlerts: event.target.checked } })
                ok(event.target.checked ? 'Avisos de ingreso activados.' : 'Avisos de ingreso desactivados.')
              }}
              inputProps={{ 'aria-label': 'Avisos de ingreso' }}
            />
          }
        />

        <Box sx={{ mt: 2.5, maxWidth: 340 }}>
          <TextField
            select
            label="Cerrar sesión por inactividad"
            size="small"
            fullWidth
            value={settings.security.idleTimeout}
            helperText="Aplica a todos los dispositivos menos a este."
            onChange={(event) => {
              persist({ security: { ...settings.security, idleTimeout: event.target.value as IdleTimeout } })
              ok('Cierre por inactividad actualizado.')
            }}
          >
            {IDLE_TIMEOUTS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Box sx={{ mt: 3 }}>
          <GroupLabel>Dónde iniciaste sesión</GroupLabel>
          {sessions.map((session, index) => {
            const Icon = session.icon
            return (
              <Stack
                key={session.id}
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{ py: 1.5, borderTop: index === 0 ? 'none' : `1px solid ${color.borderSoft}` }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: 2,
                    bgcolor: color.sand,
                    border: `1px solid ${color.borderSoft}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: color.ink,
                  }}
                >
                  <Icon sx={{ fontSize: 18 }} />
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: type.body, fontWeight: 600, color: color.navy }}>
                    {session.name}
                  </Typography>
                  <Typography sx={{ fontSize: type.caption, color: color.muted }}>{session.detail}</Typography>
                </Box>
                {session.current ? (
                  <Typography sx={{ fontSize: type.caption, color: color.muted, flexShrink: 0 }}>
                    Este dispositivo
                  </Typography>
                ) : (
                  <Button size="small" onClick={() => signOutSession(session)} sx={{ color: color.ink, flexShrink: 0 }}>
                    Cerrar sesión
                  </Button>
                )}
              </Stack>
            )
          })}
          {sessions.length <= 1 && (
            <Typography sx={{ fontSize: type.caption, color: color.muted, pt: 1.5 }}>
              No hay otras sesiones abiertas.
            </Typography>
          )}
        </Box>
      </>
    ),
    facturacion: (
      <>
        <PanelHead title="Facturación" description="Tu plan, el método de pago y las últimas facturas." />

        <GroupLabel>Plan</GroupLabel>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
          sx={{ py: 1.7, borderTop: `1px solid ${color.borderSoft}` }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: type.body, fontWeight: 700, color: color.navy }}>Plan Flota</Typography>
            <Typography sx={{ fontSize: type.caption, color: color.muted }}>
              Hasta 5 vehículos · {ars(92500)} por mes
            </Typography>
          </Box>
          <Typography sx={{ fontSize: type.caption, color: color.muted }}>
            Próxima factura: 1 de noviembre
          </Typography>
        </Stack>

        <Box>
          <GroupLabel>Método de pago</GroupLabel>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ py: 1.7, borderTop: `1px solid ${color.borderSoft}` }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: type.body, fontWeight: 600, color: color.navy }}>
                Visa ···· 4242
              </Typography>
              <Typography sx={{ fontSize: type.caption, color: color.muted }}>Vence 08/28</Typography>
            </Box>
          </Stack>
        </Box>

        <Box>
          <GroupLabel>Últimas facturas</GroupLabel>
          {INVOICES.map((invoice, index) => (
            <Stack
              key={invoice.id}
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ py: 1.5, borderTop: index === 0 ? 'none' : `1px solid ${color.borderSoft}` }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: type.body, fontWeight: 600, color: color.navy }}>
                  {invoice.month}
                </Typography>
                <Typography sx={{ fontSize: type.caption, color: color.muted }}>{invoice.state}</Typography>
              </Box>
              <Typography sx={{ fontSize: type.body, fontWeight: 700, color: color.inkStrong }}>
                {ars(invoice.amount)}
              </Typography>
            </Stack>
          ))}
        </Box>
      </>
    ),
  }[section]

  return (
    <AppShell
      active="ajustes"
      breadcrumb={['Cuenta', 'Ajustes']}
      title="Ajustes"
      description="Tu cuenta, las notificaciones y la seguridad del equipo."
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '248px minmax(0, 1fr)' },
          bgcolor: color.paper,
          border: `1px solid ${color.border}`,
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <Box
          component="nav"
          aria-label="Secciones de ajustes"
          sx={{
            display: { xs: 'grid', md: 'flex' },
            gridTemplateColumns: { xs: '1fr 1fr', md: 'none' },
            flexDirection: 'column',
            gap: 0.5,
            p: 1.5,
            borderBottom: { xs: `1px solid ${color.borderSoft}`, md: 'none' },
            borderRight: { md: `1px solid ${color.borderSoft}` },
          }}
        >
          {SECTIONS.map((item) => {
            const Icon = item.icon
            const active = item.key === section
            return (
              <Box
                key={item.key}
                component="button"
                type="button"
                onClick={() => setSection(item.key)}
                aria-current={active ? 'page' : undefined}
                sx={{
                  appearance: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.2,
                  px: 1.5,
                  py: 1.1,
                  borderRadius: radius.sm,
                  border: `1px solid ${active ? color.border : 'transparent'}`,
                  bgcolor: active ? color.sandDeep : 'transparent',
                  color: active ? color.navy : color.ink,
                  fontFamily: 'inherit',
                  fontSize: 13.5,
                  fontWeight: active ? 700 : 500,
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'background-color 120ms ease, color 120ms ease',
                  '&:hover': { bgcolor: active ? color.sand : color.cream },
                  '&:focus-visible': { outline: `2px solid ${color.blue}`, outlineOffset: 2 },
                }}
              >
                <Icon sx={{ fontSize: 18, color: active ? color.navy : color.muted }} />
                {item.label}
              </Box>
            )
          })}
        </Box>

        <Box sx={{ p: { xs: 2.5, md: 4 }, minWidth: 0 }}>{panel}</Box>
      </Box>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) setPhoto(file)
          event.target.value = ''
        }}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppShell>
  )
}
