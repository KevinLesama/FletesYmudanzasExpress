import type { Driver } from './types'
import { DRIVERS } from './mockData'

export interface ChoferConfig {
  baseRate: number
  ratePerKm: number
  ratePerHour: number
  factors: { label: string; amount: number }[]
}

const KEY = (id: string) => 'fex_chofer_config_' + id

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && isFinite(v) ? v : fallback)

export function loadChoferConfig(id: string): ChoferConfig {
  const base = DRIVERS.find((d) => d.id === id) as Driver
  if (typeof localStorage === 'undefined') {
    return { baseRate: base.baseRate, ratePerKm: base.ratePerKm, ratePerHour: base.ratePerHour, factors: [...base.factors] }
  }
  try {
    const raw = localStorage.getItem(KEY(id))
    if (!raw) return { baseRate: base.baseRate, ratePerKm: base.ratePerKm, ratePerHour: base.ratePerHour, factors: [...base.factors] }
    const parsed = JSON.parse(raw)
    return {
      baseRate: num(parsed.baseRate, base.baseRate),
      ratePerKm: num(parsed.ratePerKm, base.ratePerKm),
      ratePerHour: num(parsed.ratePerHour, base.ratePerHour),
      factors: Array.isArray(parsed.factors)
        ? parsed.factors.map((f: { label?: unknown; amount?: unknown }) => ({
            label: String(f?.label ?? ''),
            amount: num(f?.amount, 0),
          }))
        : [...base.factors],
    }
  } catch {
    return { baseRate: base.baseRate, ratePerKm: base.ratePerKm, ratePerHour: base.ratePerHour, factors: [...base.factors] }
  }
}

export function saveChoferConfig(id: string, config: ChoferConfig): void {
  localStorage.setItem(KEY(id), JSON.stringify(config))
}

export function resetChoferConfig(id: string): void {
  localStorage.removeItem(KEY(id))
}