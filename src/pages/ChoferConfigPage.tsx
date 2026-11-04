import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Divider,
  InputAdornment,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { InfoOutlined, Paid, RestartAlt, Save } from '@mui/icons-material'
import { ChoferShell } from '../components/ChoferShell'
import { CampoTexto } from '../components/FormFields'
import { ErrorState, LoadingState } from '../components/EmptyState'
import { MobileActionBar } from '../components/mobile/MobileActionBar'
import { MOBILE_ACTION_BAR_SPACE } from '../components/mobile/mobileSx'
import { TruckLoader } from '../components/TruckLoader'
import { Toast, type ToastState } from '../components/Toast'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { ars } from '../format'
import { currentUser } from '../supabase'
import { brand } from '../theme'
import type { Driver, Quote } from '../types'

const SAMPLE_KM = 18

interface ChoferConfig {
  baseRate: number
  ratePerKm: number
  ratePerHour: number
}

function toConfig(driver: Driver): ChoferConfig {
  return {
    baseRate: driver.baseRate,
    ratePerKm: driver.ratePerKm,
    ratePerHour: driver.ratePerHour,
  }
}

export function ChoferConfigPage() {
  const user = currentUser()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  // El perfil sale del id que el backend resolvio en /me. No se busca por
  // email: el email de Auth y el de `usuarios` pueden no coincidir.
  const driverState = useAsync(() => {
    if (!user) throw new Error('No hay una sesión activa.')
    return api.getDriver(String(user.id))
  }, [user?.id])
  const driver: Driver | null = driverState.data

  const [config, setConfig] = useState<ChoferConfig | null>(null)
  const [preview, setPreview] = useState<Quote | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (driver) setConfig(toConfig(driver))
  }, [driver])

  // La vista previa la calcula el backend con la misma formula que usa el
  // viaje real. El frontend solo muestra los numeros.
  useEffect(() => {
    if (!config) return
    let cancelled = false
    setPreviewLoading(true)
    const timer = window.setTimeout(() => {
      api
        .previewQuote({
          kmIda: SAMPLE_KM,
          tariffBase: config.baseRate,
          tariffPerKm: config.ratePerKm,
          tariffPerHour: config.ratePerHour,
        })
        .then((quote) => {
          if (cancelled) return
          setPreview(quote)
          setPreviewError('')
        })
        .catch((err) => {
          if (cancelled) return
          setPreview(null)
          setPreviewError(err instanceof Error ? err.message : 'No pudimos calcular el ejemplo.')
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false)
        })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [config])

  if (driverState.loading) {
    return (
      <ChoferShell active="config" breadcrumb={['Chofer', 'Mi configuración']} title="Mi configuración">
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
          <LoadingState label="Cargando configuración..." />
        </Box>
      </ChoferShell>
    )
  }

  if (driverState.error || !driver || !config) {
    return (
      <ChoferShell active="config" breadcrumb={['Chofer', 'Mi configuración']} title="Mi configuración">
        <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3 }}>
          <ErrorState
            message={driverState.error ?? 'No encontramos tu perfil de chofer. Pedile a la administración que vincule tu cuenta.'}
            onRetry={driverState.reload}
          />
        </Box>
      </ChoferShell>
    )
  }

  const setNum = (key: keyof ChoferConfig, v: string) =>
    setConfig((c) => (c ? { ...c, [key]: Number(v.replace(/[^\d]/g, '')) || 0 } : c))

  const save = async () => {
    setSaving(true)
    try {
      const updated = await api.updateDriverRates(driver.id, {
        baseRate: config.baseRate,
        ratePerKm: config.ratePerKm,
        ratePerHour: config.ratePerHour,
      })
      setConfig(toConfig(updated))
      setToast({ message: 'Configuración guardada', tone: 'success' })
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'No pudimos guardar la configuración.', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setConfig(toConfig(driver))
    setToast({ message: 'Restauramos los valores del servidor', tone: 'success' })
  }

  const marginPct = preview ? Math.round((preview.margin - 1) * 100) : 0

  return (
    <>
      <ChoferShell
        active="config"
        breadcrumb={['Chofer', 'Mi configuración']}
        title="Mi configuración"
        description="Definí tu tarifa base y los adicionales de cada viaje."
        action={
          isMobile ? undefined : (
            <Button variant="contained" startIcon={<Save />} onClick={save} disabled={saving} sx={{ bgcolor: brand.orangeStrong, '&:hover': { bgcolor: brand.orangeInk } }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          )
        }
      >
        <Box sx={{ mb: 2.5, p: 1.6, borderRadius: 2, bgcolor: '#EEF2FA', border: '1px solid #D9E2EE', color: '#526B8A' }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <InfoOutlined sx={{ fontSize: 16, mt: 0.2 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
              Con estas tarifas se calcula tu costo y el precio sugerido de cada viaje. La seña es el 50 % del precio acordado.
            </Typography>
          </Stack>
        </Box>

        <Stack spacing={2.5} sx={{ pb: { xs: MOBILE_ACTION_BAR_SPACE.pb, md: 0 } }}>
          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Box sx={{ color: brand.navy, display: 'flex' }}><Paid sx={{ fontSize: 17 }} /></Box>
              <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15 }}>Tarifa del viaje</Typography>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <CampoTexto
                label="Tarifa base por viaje"
                value={config.baseRate}
                onChange={(e) => setNum('baseRate', e.target.value)}
                fullWidth
                size="small"
                helperText="Sueldo base del servicio"
                inputProps={{ inputMode: 'numeric' }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                sx={{ '& .MuiInputBase-root': { minHeight: { xs: 48, md: 'unset' } } }}
              />
              <CampoTexto
                label="Adicional por km"
                value={config.ratePerKm}
                onChange={(e) => setNum('ratePerKm', e.target.value)}
                fullWidth
                size="small"
                helperText="Se aplica sobre los km totales (ida y vuelta)"
                inputProps={{ inputMode: 'numeric' }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                sx={{ '& .MuiInputBase-root': { minHeight: { xs: 48, md: 'unset' } } }}
              />
              <CampoTexto
                label="Adicional por hora"
                value={config.ratePerHour}
                onChange={(e) => setNum('ratePerHour', e.target.value)}
                fullWidth
                size="small"
                helperText="Viaje, vuelta y espera"
                inputProps={{ inputMode: 'numeric' }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                sx={{ '& .MuiInputBase-root': { minHeight: { xs: 48, md: 'unset' } } }}
              />
            </Stack>
          </Box>

          <Box sx={{ bgcolor: '#FBF9F6', border: '1px solid #EDEAE3', borderRadius: 3, p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15 }}>Ejemplo de cálculo</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Typography sx={{ fontSize: { xs: 12.5, md: 11 }, color: '#64707C' }}>{SAMPLE_KM} km de ida · espera 2 h</Typography>
            </Stack>

            {previewLoading && !preview && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TruckLoader size="sm" />
                <Typography sx={{ fontSize: 12.5, color: '#64707C' }}>Calculando...</Typography>
              </Box>
            )}
            {previewError && (
              <Typography sx={{ fontSize: 12.5, color: '#B3261E' }}>{previewError}</Typography>
            )}

            {preview && (
              <Stack spacing={0.7}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography sx={{ fontSize: 12.5, color: '#5C6B7A' }}>Tarifa base</Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#33475F' }}>{ars(preview.costBase)}</Typography>
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography sx={{ fontSize: 12.5, color: '#5C6B7A' }}>Kilometraje ({preview.kmTotal} km)</Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#33475F' }}>{ars(preview.costKm)}</Typography>
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography sx={{ fontSize: 12.5, color: '#5C6B7A' }}>
                    Tiempo ({preview.totalHours.toString().replace('.', ',')} h)
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#33475F' }}>{ars(preview.costTime)}</Typography>
                </Stack>
                <Divider sx={{ borderColor: '#E3DFD5', mt: 0.5 }} />
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: brand.navy }}>Tu costo</Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: brand.navy }}>{ars(preview.driverCost)}</Typography>
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography sx={{ fontSize: 12.5, color: '#5C6B7A' }}>Margen de la empresa ({marginPct} %)</Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#33475F' }}>{ars(preview.suggestedPrice - preview.driverCost)}</Typography>
                </Stack>
                <Divider sx={{ borderColor: '#E3DFD5', mt: 0.5 }} />
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: brand.navy }}>Precio sugerido</Typography>
                  <Typography sx={{ fontSize: 17, fontWeight: 800, color: brand.navy }}>{ars(preview.suggestedPrice)}</Typography>
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography sx={{ fontSize: 12.5, color: '#5C6B7A' }}>Seña requerida (50 %)</Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#33475F' }}>{ars(preview.depositRequired)}</Typography>
                </Stack>
              </Stack>
            )}
          </Box>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<RestartAlt />}
              onClick={reset}
              sx={{ color: brand.navy, borderColor: '#D9D4C9', minHeight: { xs: 44, md: undefined }, width: { xs: '100%', md: 'auto' } }}
            >
              Restaurar valores del servidor
            </Button>
            {!isMobile && (
              <Button variant="contained" startIcon={<Save />} onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar configuración'}
              </Button>
            )}
          </Stack>
        </Stack>
      </ChoferShell>

      {isMobile && (
        <MobileActionBar>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={save}
            disabled={saving}
            sx={{ bgcolor: brand.orangeStrong, '&:hover': { bgcolor: brand.orangeInk } }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </MobileActionBar>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}
