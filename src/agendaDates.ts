/**
 * Date helpers for the agenda.
 *
 * Dates travel as ISO `yyyy-mm-dd` strings and are built from local-time
 * `Date` objects, never from `new Date('2026-09-24')`: that parses as UTC and
 * shifts the day back in any negative offset like Argentina's -03:00.
 */

import { dayName, MESES, MESES_LARGO } from './format'

export const WORK_WEEK_LENGTH = 5

/** Truncated weekday names, Monday first, matching `startOfWorkWeek`. */
export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(iso: string, delta: number): string {
  const date = parseISO(iso)
  date.setDate(date.getDate() + delta)
  return toISO(date)
}

/** Get the start date (Monday) of the work week to display initially.
 * If today is Saturday (6) or Sunday (0), returns Monday of the next week.
 * Otherwise returns Monday of the current week containing today.
 */
export function getInitialWeekStart(now: Date = new Date()): string {
  const day = now.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  if (day === 6) {
    // Saturday -> next Monday
    const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)
    return toISO(nextMonday)
  }
  if (day === 0) {
    // Sunday -> next Monday
    const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    return toISO(nextMonday)
  }
  // Monday to Friday -> start of current week (Monday)
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const offset = (current.getDay() + 6) % 7 // days since Monday
  current.setDate(current.getDate() - offset)
  return toISO(current)
}

/** Get today's date as ISO string in local time. */
export function getTodayISO(now: Date = new Date()): string {
  return toISO(now)
}

/**
 * Initial anchor for the agenda: today in local time, or the next Monday when
 * today is a weekend so the agenda does not open on a work week without work
 * days left.
 */
export function getInitialAnchor(now: Date = new Date()): string {
  const day = now.getDay()
  return day === 0 || day === 6 ? getInitialWeekStart(now) : toISO(now)
}

/** Monday-based start of the week that contains `iso`. */
export function startOfWorkWeek(iso: string): string {
  const date = parseISO(iso)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return toISO(date)
}

/** Monday to Friday of the week that contains `iso`. */
export function workWeekDays(iso: string): string[] {
  const start = startOfWorkWeek(iso)
  return Array.from({ length: WORK_WEEK_LENGTH }, (_, i) => addDays(start, i))
}

export function dayNumber(iso: string): number {
  return parseISO(iso).getDate()
}

/** Monday-first index: 0 = Lun … 6 = Dom. */
export function weekdayIndex(iso: string): number {
  return (parseISO(iso).getDay() + 6) % 7
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS[weekdayIndex(iso)]
}

/** Header date without year: `Lunes 2 de noviembre`. */
export function fmtDayMonth(iso: string): string {
  const { month, day } = parts(iso)
  return `${dayName(iso)} ${day} de ${MESES_LARGO[month]}`
}

function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month: (m ?? 1) - 1, day: d ?? 1 }
}

/**
 * Human range for the toolbar: `24 de septiembre de 2026`,
 * `2 – 6 de noviembre de 2026`, `26 oct – 30 oct de 2026`,
 * `29 dic 2026 – 2 ene 2027`.
 */
export function fmtRange(days: string[]): string {
  if (days.length === 0) return ''
  const first = parts(days[0])
  const last = parts(days[days.length - 1])
  const monthFirst = MESES_LARGO[first.month]

  if (first.year === last.year && first.month === last.month) {
    if (first.day === last.day) return `${first.day} de ${monthFirst} de ${first.year}`
    return `${first.day} – ${last.day} de ${monthFirst} de ${first.year}`
  }
  if (first.year === last.year) {
    return `${first.day} ${MESES[first.month]} – ${last.day} ${MESES[last.month]} de ${first.year}`
  }
  return `${first.day} ${MESES[first.month]} ${first.year} – ${last.day} ${MESES[last.month]} ${last.year}`
}
