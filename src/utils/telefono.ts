export const filtrarTelefono = (rawValue: string) => {
  const withoutPlus = rawValue.replace(/[^\d\s()-]/g, '')
  return `${rawValue.startsWith('+') ? '+' : ''}${withoutPlus}`.slice(0, 20)
}

export const validarTelefono = (value: string) => {
  const digitCount = value.replace(/\D/g, '').length
  if (digitCount < 8 || digitCount > 13) {
    return 'Ingresá un teléfono válido (entre 8 y 13 dígitos).'
  }
  return null
}

/**
 * Quita el 0 de larga distancia y el 15 de celular del tramo nacional.
 *
 * El 15 aparece después del código de área. Como no hay una lista completa de
 * áreas, sólo lo removemos cuando el número supera los 10 dígitos nacionales:
 * en un número ya normalizado ese 15 no puede estar presente.
 */
function stripNationalDialingPrefixes(national: string): string {
  const value = national.replace(/^0+/, '')
  if (!value || value.startsWith('9') || value.length <= 10) return value

  if (value.startsWith('11')) {
    return value.slice(2, 4) === '15' ? `11${value.slice(4)}` : value
  }

  const mobileMarker = value.indexOf('15')
  if (mobileMarker >= 2 && mobileMarker <= 4) {
    return `${value.slice(0, mobileMarker)}${value.slice(mobileMarker + 2)}`
  }

  return value
}

function splitCountryCode(raw: string): { digits: string; international: boolean; argentine: boolean } {
  const input = (raw ?? '').trim()
  let digits = input.replace(/\D/g, '')
  const international = /^\s*\(?\s*\+/.test(input) || digits.startsWith('00')

  if (digits.startsWith('00')) digits = digits.slice(2)

  const argentine = digits.startsWith('54')
  if (argentine) {
    // "5454..." (prefijo duplicado) se colapsa a un único "54".
    digits = digits.replace(/^(?:54)+/, '54')
  }

  return { digits, international, argentine }
}

/**
 * Formato que exige WhatsApp para celulares argentinos:
 * 54 + 9 + código de área + número, sólo dígitos.
 *
 * Si el número viene con un prefijo internacional explícito que no es 54, se
 * devuelve tal cual para no romper teléfonos de otros países.
 */
export function normalizeArgentinaPhoneForWhatsApp(raw: string): string {
  const { digits, international, argentine } = splitCountryCode(raw)
  if (!digits) return ''
  if (!argentine && international) return digits

  const national = stripNationalDialingPrefixes((argentine ? digits.slice(2) : digits) || '')
  if (!national) return ''

  return `54${national.startsWith('9') ? national : `9${national}`}`
}

/**
 * Normaliza el teléfono para guardarlo sin prefijos duplicados, conservando el
 * formato de visualización actual basado en "+54".
 */
export function normalizeArgentinaPhoneForStorage(raw: string): string {
  const { digits, international, argentine } = splitCountryCode(raw)
  if (!digits) return ''
  if (!argentine && international) return `+${digits}`

  const national = stripNationalDialingPrefixes((argentine ? digits.slice(2) : digits) || '')
  if (!national) return ''

  return `+54${national}`
}
