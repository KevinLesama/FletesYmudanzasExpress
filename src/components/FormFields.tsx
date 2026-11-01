import { useEffect, useId, useState } from 'react'
import {
  Box,
  Collapse,
  Fade,
  FormControl,
  FormHelperText,
  Select,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import type { SelectProps } from '@mui/material/Select'
import type { TextFieldProps } from '@mui/material/TextField'
import { ErrorOutline } from '@mui/icons-material'
import { type as typeScale } from '../design/tokens'

export function EtiquetaCampo({
  text,
  htmlFor,
  id,
}: {
  text: string
  htmlFor: string
  id?: string
}) {
  return (
    <Typography
      component="label"
      htmlFor={htmlFor}
      id={id}
      sx={{
        display: 'block',
        mb: 0.5,
        fontSize: typeScale.body,
        lineHeight: 1.3,
        fontWeight: 500,
        color: 'text.primary',
        opacity: 0.72,
      }}
    >
      {text}
    </Typography>
  )
}

export function MensajeCampo({
  id,
  mensaje,
  sinAnimacion = false,
}: {
  id: string
  mensaje?: string | null
  sinAnimacion?: boolean
}) {
  const [ultimoMensaje, setUltimoMensaje] = useState(mensaje ?? '')
  const reducirMovimiento = useMediaQuery('(prefers-reduced-motion: reduce)')
  const animacionDesactivada = sinAnimacion || reducirMovimiento

  useEffect(() => {
    if (mensaje) setUltimoMensaje(mensaje)
  }, [mensaje])

  const contenido = (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
      <ErrorOutline
        aria-hidden="true"
        sx={{ mt: '2px', fontSize: 16, color: 'error.main', flexShrink: 0 }}
      />
      <FormHelperText error id={id} sx={{ m: 0, fontSize: typeScale.caption }}>
        {ultimoMensaje}
      </FormHelperText>
    </Box>
  )

  if (animacionDesactivada) {
    return mensaje ? <Box sx={{ mt: 0.5 }}>{contenido}</Box> : null
  }

  return (
    <Collapse
      in={Boolean(mensaje)}
      timeout={200}
      sx={{ mt: ultimoMensaje ? 0.5 : 0, '&.MuiCollapse-hidden': { mt: 0 } }}
    >
      <Fade in={Boolean(mensaje)} timeout={200}>
        {contenido}
      </Fade>
    </Collapse>
  )
}

type CampoTextoProps = Omit<TextFieldProps, 'id' | 'label' | 'error'> & {
  id?: string
  label: string
  error?: boolean
  mensaje?: string | null
  sinAnimacion?: boolean
}

export function CampoTexto({
  id,
  label,
  error,
  mensaje,
  sinAnimacion,
  helperText,
  inputProps,
  ...textFieldProps
}: CampoTextoProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const messageId = `${fieldId}-error`
  const describedBy = [
    inputProps?.['aria-describedby'],
    helperText != null ? `${fieldId}-helper-text` : undefined,
    mensaje ? messageId : undefined,
  ].filter(Boolean).join(' ') || undefined

  return (
    <Box>
      <EtiquetaCampo text={label} htmlFor={fieldId} />
      <TextField
        {...textFieldProps}
        id={fieldId}
        error={error ?? Boolean(mensaje)}
        helperText={helperText}
        inputProps={{ ...inputProps, 'aria-describedby': describedBy }}
      />
      <MensajeCampo id={messageId} mensaje={mensaje} sinAnimacion={sinAnimacion} />
    </Box>
  )
}

type CampoSelectProps<Value = unknown> = Omit<SelectProps<Value>, 'id' | 'label' | 'labelId' | 'error'> & {
  id?: string
  labelId?: string
  label: string
  error?: boolean
  helperText?: React.ReactNode
  mensaje?: string | null
  sinAnimacion?: boolean
}

export function CampoSelect<Value = unknown>({
  id,
  labelId,
  label,
  error,
  helperText,
  mensaje,
  sinAnimacion,
  ...selectProps
}: CampoSelectProps<Value>) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const accessibleLabelId = labelId ?? `${fieldId}-label`
  const helperTextId = helperText != null ? `${fieldId}-helper-text` : undefined
  const messageId = `${fieldId}-error`
  const describedBy = [
    selectProps['aria-describedby'],
    helperTextId,
    mensaje ? messageId : undefined,
  ].filter(Boolean).join(' ') || undefined

  return (
    <FormControl fullWidth size={selectProps.size} error={error ?? Boolean(mensaje)}>
      <EtiquetaCampo text={label} htmlFor={fieldId} id={accessibleLabelId} />
      <Select<Value>
        {...selectProps}
        id={fieldId}
        labelId={accessibleLabelId}
        error={error ?? Boolean(mensaje)}
        aria-describedby={describedBy}
      />
      {helperText != null && <FormHelperText id={helperTextId}>{helperText}</FormHelperText>}
      <MensajeCampo id={messageId} mensaje={mensaje} sinAnimacion={sinAnimacion} />
    </FormControl>
  )
}
