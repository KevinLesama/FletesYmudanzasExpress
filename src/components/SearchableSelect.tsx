import { useMemo, type ReactNode } from 'react'
import { Autocomplete, TextField } from '@mui/material'

interface SearchableSelectProps<T> {
  label: string
  value: T | null
  options: T[]
  /** Clave estable de la opción (para comparar valor y opciones). */
  getKey: (option: T) => string
  /** Texto que se muestra en el campo y en la lista. */
  getLabel: (option: T) => string
  /** Texto extra por el que se puede buscar (tipo, estado, etc.). */
  getSearchText?: (option: T) => string
  /** Contenido de cada fila de la lista. */
  renderOption?: (option: T) => ReactNode
  isOptionDisabled?: (option: T) => boolean
  onChange: (option: T | null) => void
  fullWidth?: boolean
  placeholder?: string
  noOptionsText?: string
}

/** Normaliza para buscar sin depender de mayúsculas ni tildes. */
function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Select con buscador integrado, para listas que crecen con los datos
 * (choferes, vehículos, fechas de operación).
 *
 * Mantiene el tamaño y el borde de los inputs de la app, y filtra por
 * etiqueta + texto extra, ignorando tildes.
 */
export function SearchableSelect<T>({
  label,
  value,
  options,
  getKey,
  getLabel,
  getSearchText,
  renderOption,
  isOptionDisabled,
  onChange,
  fullWidth,
  placeholder,
  noOptionsText = 'Sin resultados',
}: SearchableSelectProps<T>) {
  const normalizedOptions = useMemo(
    () =>
      options.map((option) => ({
        option,
        haystack: normalize(`${getLabel(option)} ${getSearchText?.(option) ?? ''}`),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, getLabel, getSearchText],
  )

  return (
    <Autocomplete<T, false, true, false>
      fullWidth={fullWidth}
      disableClearable
      autoHighlight
      value={value as NonNullable<T>}
      options={options}
      noOptionsText={noOptionsText}
      isOptionEqualToValue={(option, selected) => getKey(option) === getKey(selected)}
      getOptionLabel={getLabel}
      getOptionDisabled={isOptionDisabled}
      onChange={(_, next) => onChange(next)}
      filterOptions={(_, state) => {
        const query = normalize(state.inputValue)
        if (!query) return normalizedOptions.map((entry) => entry.option)
        // Todas las palabras tienen que aparecer, en cualquier orden.
        const words = query.split(/\s+/)
        return normalizedOptions
          .filter((entry) => words.every((word) => entry.haystack.includes(word)))
          .map((entry) => entry.option)
      }}
      renderOption={(props, option) => {
        const { key, ...rest } = props as { key?: string } & Record<string, unknown>
        return (
          <li key={key ?? getKey(option)} {...rest}>
            {renderOption ? renderOption(option) : getLabel(option)}
          </li>
        )
      }}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} size="small" />
      )}
      ListboxProps={{ sx: { maxHeight: 320 } }}
    />
  )
}
