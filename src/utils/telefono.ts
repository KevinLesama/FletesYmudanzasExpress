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
