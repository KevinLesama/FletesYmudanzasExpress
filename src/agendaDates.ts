/**
 * Date helpers for the agenda.
 *
 * Dates travel as ISO `yyyy-mm-dd` strings and are built from local-time
 * `Date` objects, never from `new Date('2026-09-24')`: that parses as UTC and
 * shifts the day back in any negative offset like Argentina's -03:00.
 */

import { MESES_LARGO } from './format'

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

function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month: (m ?? 1) - 1, day: d ?? 1 }
}

/**
 * Human range for the toolbar: `24 de septiembre de 2026`,
 * `21 – 25 de septiembre de 2026`, `29 de septiembre – 3 de octubre de 2026`.
 */
export function fmtRange(days: string[]): string {
  if (days.length === 0) return ''
  const first = parts(days[0])
  const last = parts(days[days.length - 1])
  const monthFirst = MESES_LARGO[first.month]
  const monthLast = MESES_LARGO[last.month]

  if (first.year === last.year && first.month === last.month) {
    if (first.day === last.day) return `${first.day} de ${monthFirst} de ${first.year}`
    return `${first.day} – ${last.day} de ${monthFirst} de ${first.year}`
  }
  if (first.year === last.year) {
    return `${first.day} de ${monthFirst} – ${last.day} de ${monthLast} de ${first.year}`
  }
  return `${first.day} de ${monthFirst} de ${first.year} – ${last.day} de ${monthLast} de ${last.year}`
}
