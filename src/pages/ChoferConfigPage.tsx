import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Add, Close, InfoOutlined, Paid, RestartAlt, Save, Tune } from '@mui/icons-material'
import { ChoferShell } from '../components/ChoferShell'
import { ErrorState, LoadingState } from '../components/EmptyState'
import { Toast, type ToastState } from '../components/Toast'
import { tripEarnings } from '../mockData'
import { api } from '../api'
import { useAsync } from '../useAsync'
import { ars } from '../format'
import { brand } from '../theme'
import type { Driver, Factor } from '../types'

const DEMO_DRIVER_ID = 'JA'
const SAMPLE_KM = 18
const SAMPLE_HOURS = 2

interface ChoferConfig {
  baseRate: number
  ratePerKm: number
  ratePerHour: number
  factors: Factor[]
}

function toConfig(driver: Driver): ChoferConfig {
  return {
    baseRate: driver.baseRate,
    ratePerKm: driver.ratePerKm,
    ratePerHour: driver.ratePerHour,
    factors: driver.factors.map((f) => ({ ...f })),
  }
}

export function ChoferConfigPage() {
  const driverState = useAsync(() => api.listDrivers(), [])
  const drivers: Driver[] = driverState.data ?? []
  const driver = drivers.find((d) => d.id === DEMO_DRIVER_ID)

  const [config, setConfig] = useState<ChoferConfig | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (driver) setConfig(toConfig(driver))
  }, [driver])

  if (driverState.loading || (!config && driver)) {
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
          <ErrorState message={driverState.error ?? 'No encontramos el chofer de demostración.'} onRetry={driverState.reload} />
        </Box>
      </ChoferShell>
    )
  }

  const patch = (p: Partial<ChoferConfig>) => setConfig((c) => (c ? { ...c, ...p } : c))

  const setNum = (key: 'baseRate' | 'ratePerKm' | 'ratePerHour', v: string) =>
    patch({ [key]: Number(v.replace(/[^\d]/g, '')) || 0 })

  const setFactor = (idx: number, p: Partial<Factor>) =>
    setConfig((c) => (c ? { ...c, factors: c.factors.map((f, i) => (i === idx ? { ...f, ...p } : f)) } : c))

  const removeFactor = (idx: number) =>
    setConfig((c) => (c ? { ...c, factors: c.factors.filter((_, i) => i !== idx) } : c))

  const addFactor = () => setConfig((c) => (c ? { ...c, factors: [...c.factors, { label: '', amount: 0 }] } : c))

  const preview = tripEarnings({ ...driver, ...config }, SAMPLE_KM, SAMPLE_HOURS)

  const save = async () => {
    setSaving(true)
    try {
      await api.updateDriverRates(DEMO_DRIVER_ID, {
        base_rate: config.baseRate,
        rate_per_km: config.ratePerKm,
        rate_per_hour: config.ratePerHour,
        factors: config.factors,
      })
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

  return (
    <>
      <ChoferShell
        active="config"
        breadcrumb={['Chofer', 'Mi configuración']}
        title="Mi configuración"
        description="Definí tu tarifa base y los adicionales de cada viaje."
        action={
          <Button variant="contained" startIcon={<Save />} onClick={save} disabled={saving} sx={{ bgcolor: brand.orange, '&:hover': { bgcolor: brand.orangeDark } }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        }
      >
        <Box sx={{ mb: 2.5, p: 1.6, borderRadius: 2, bgcolor: '#EEF2FA', border: '1px solid #D9E2EE', color: '#526B8A' }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <InfoOutlined sx={{ fontSize: 16, mt: 0.2 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
              Estos valores los usan tus viajes para mostrar el cálculo. Los toca la administración solo en la vista de flota.
            </Typography>
          </Stack>
        </Box>

        <Stack spacing={2.5}>
          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Box sx={{ color: brand.navy, display: 'flex' }}><Paid sx={{ fontSize: 17 }} /></Box>
              <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15 }}>Tarifa del viaje</Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Tarifa base por viaje"
                value={config.baseRate}
                onChange={(e) => setNum('baseRate', e.target.value)}
                fullWidth
                size="small"
                helperText="Sueldo base del servicio"
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              />
              <TextField
                label="Adicional por km"
                value={config.ratePerKm}
                onChange={(e) => setNum('ratePerKm', e.target.value)}
                fullWidth
                size="small"
                helperText="Por kilómetro recorrido"
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              />
              <TextField
                label="Adicional por hora"
                value={config.ratePerHour}
                onChange={(e) => setNum('ratePerHour', e.target.value)}
                fullWidth
                size="small"
                helperText="Por hora de servicio"
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              />
            </Stack>
          </Box>

          <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid #E9E6DF', borderRadius: 3, p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Box sx={{ color: brand.navy, display: 'flex' }}><Tune sx={{ fontSize: 17 }} /></Box>
              <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15 }}>Otros factores</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Button size="small" startIcon={<Add />} onClick={addFactor} sx={{ color: brand.navy }}>
                Agregar factor
              </Button>
            </Stack>
            <Stack spacing={1.2}>
              {config.factors.length === 0 && (
                <Typography sx={{ fontSize: 13, color: '#64707C' }}>Sin factores extras. Agregá uno si aplica.</Typography>
              )}
              {config.factors.map((f, idx) => (
                <Stack key={idx} direction="row" spacing={1.2} alignItems="center">
                  <TextField
                    value={f.label}
                    onChange={(e) => setFactor(idx, { label: e.target.value })}
                    placeholder="Nombre del factor (ej. espera por ascensor)"
                    size="small"
                    sx={{ flexGrow: 1 }}
                  />
                  <TextField
                    value={f.amount}
                    onChange={(e) => setFactor(idx, { amount: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
                    size="small"
                    sx={{ width: 140 }}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  />
                  <IconButton onClick={() => removeFactor(idx)} size="small" aria-label="Quitar factor" sx={{ color: '#9C493A' }}>
                    <Close fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box sx={{ bgcolor: '#FBF9F6', border: '1px solid #EDEAE3', borderRadius: 3, p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15 }}>Ejemplo de cálculo</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Typography sx={{ fontSize: 11, color: '#64707C' }}>FEX-1048 · {SAMPLE_KM} km · {SAMPLE_HOURS} h</Typography>
            </Stack>
            <Stack spacing={0.7}>
              {preview.lines.map((l) => (
                <Stack key={l.label} direction="row" alignItems="center" justifyContent="space-between">
                  <Typography sx={{ fontSize: 12.5, color: '#5C6B7A' }}>{l.label}</Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#33475F' }}>{ars(l.value)}</Typography>
                </Stack>
              ))}
              <Divider sx={{ borderColor: '#E3DFD5', mt: 0.5 }} />
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: brand.navy }}>Total estimado</Typography>
                <Typography sx={{ fontSize: 17, fontWeight: 800, color: brand.navy }}>{ars(preview.total)}</Typography>
              </Stack>
            </Stack>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
            <Button variant="outlined" startIcon={<RestartAlt />} onClick={reset} sx={{ color: brand.navy, borderColor: '#D9D4C9' }}>
              Restaurar valores de ejemplo
            </Button>
            <Button variant="contained" startIcon={<Save />} onClick={save} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </Button>
          </Stack>
        </Stack>
      </ChoferShell>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}