import { createTheme, alpha } from '@mui/material/styles'
import { color, motion, radius, shadow } from './design/tokens'

/**
 * Brand aliases kept for pages that already import `brand`.
 * New code should prefer `color`/`radius` tokens from `src/design/tokens.ts`.
 */
export const brand = {
  navy: color.navy,
  navySoft: color.navySoft,
  cream: color.cream,
  card: color.paper,
  orange: color.orange,
  orangeDark: color.orangeDark,
  orangeInk: color.orangeInk,
  orangeStrong: color.orangeStrong,
  border: color.border,
  muted: color.muted,
}

const heading = {
  fontFamily: "'Manrope', sans-serif",
  fontWeight: 800,
  letterSpacing: '-0.025em',
} as const

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: color.navy, dark: color.navyDeep, contrastText: color.paper },
    secondary: { main: color.orangeStrong, dark: color.orangeInk, contrastText: color.paper },
    background: { default: color.cream, paper: color.paper },
    text: { primary: color.navy, secondary: color.ink, disabled: color.mutedSoft },
    success: { main: color.green, light: color.greenSoft, dark: '#286B50' },
    warning: { main: color.amber, light: color.amberSoft, dark: '#98621B' },
    error: { main: color.red, light: color.redSoft, dark: '#9C493A' },
    info: { main: color.blue, light: color.blueSoft },
    divider: color.border,
  },
  // radius unit: numeric `borderRadius` values in `sx` are multiplied by this.
  // 4 keeps the scale readable: 2 => 8px, 3 => 12px, 4 => 16px.
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: "'DM Sans', sans-serif",
    h1: { ...heading, letterSpacing: '-0.03em', fontSize: 40 },
    h2: { ...heading, fontSize: 32 },
    h3: { ...heading, fontSize: 28 },
    h4: { ...heading, fontSize: 26 },
    h5: { ...heading, fontSize: 20, letterSpacing: '-0.01em' },
    h6: { ...heading, fontWeight: 700, fontSize: 16, letterSpacing: 0 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 700 },
    button: { fontWeight: 700, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': { minHeight: '100%' },
        body: {
          backgroundColor: color.cream,
          color: color.navy,
          WebkitFontSmoothing: 'antialiased',
        },
        // Visible, consistent keyboard focus across the app.
        ':focus-visible': {
          outline: `2px solid ${color.orangeInk}`,
          outlineOffset: 2,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
          boxShadow: 'none',
          borderRadius: radius.md,
          transition: `background-color ${motion.fast}, border-color ${motion.fast}`,
        },
        containedPrimary: {
          backgroundColor: color.navy,
          '&:hover': { backgroundColor: color.navyDeep, boxShadow: 'none' },
        },
        containedSecondary: {
          '&:hover': { backgroundColor: color.orangeInk, boxShadow: 'none' },
        },
        outlined: { boxShadow: 'none' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { border: `1px solid ${color.border}` },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: 'none', backgroundImage: 'none', border: 'none' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${color.border}`,
          borderRadius: radius.lg,
          boxShadow: shadow.card,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: radius.xl,
          border: `1px solid ${color.border}`,
          boxShadow: shadow.raised,
          backgroundImage: 'none',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: radius.md,
          border: `1px solid ${color.border}`,
          boxShadow: shadow.raised,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottomColor: color.borderSoft, fontSize: 14 },
        head: {
          fontWeight: 700,
          fontSize: 12.5,
          letterSpacing: '0.02em',
          color: color.ink,
          backgroundColor: color.sand,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          backgroundColor: color.paper,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: color.mutedSoft,
          },
        },
        notchedOutline: { borderColor: color.border },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700, borderRadius: radius.sm },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: radius.md },
        filledSuccess: { backgroundColor: color.green },
        filledError: { backgroundColor: color.red },
        filledInfo: { backgroundColor: color.blue },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: { borderRadius: radius.sm, textTransform: 'none', fontWeight: 700 },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: { borderRadius: radius.md },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { borderRadius: radius.sm, fontSize: 12 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 700 },
      },
    },
  },
})

export const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Confirmada: { bg: color.greenSoft, text: '#397A55', dot: '#4E9A6C' },
  Confirmado: { bg: color.greenSoft, text: '#397A55', dot: '#4E9A6C' },
  'Pendiente de seña': { bg: color.amberSoft, text: '#98621B', dot: '#D89B34' },
  'Pendiente de revisión': { bg: color.blueSoft, text: '#526B8A', dot: '#6E86A7' },
  Tentativa: { bg: color.redSoft, text: '#9C493A', dot: '#BD6655' },
  Cancelada: { bg: '#F1F2F4', text: '#5F6873', dot: '#8A929B' },
  Disponible: { bg: color.greenSoft, text: '#397A55', dot: '#4E9A6C' },
  Asignado: { bg: color.amberSoft, text: '#98621B', dot: '#D89B34' },
  'En taller': { bg: '#F1F2F4', text: '#5F6873', dot: '#8A929B' },
  Activo: { bg: '#E8F5ED', text: '#26734B', dot: '#3D8A5F' },
  Inactivo: { bg: '#F1F2F4', text: '#5F6873', dot: '#8A929B' },
  'Sin pagos': { bg: '#F1F2F4', text: '#5F6873', dot: '#8A929B' },
  Parcial: { bg: color.amberSoft, text: '#98621B', dot: '#D89B34' },
  Cobrado: { bg: color.greenSoft, text: '#397A55', dot: '#4E9A6C' },
  Guardada: { bg: color.greenSoft, text: '#397A55', dot: '#4E9A6C' },
  Borrador: { bg: color.blueSoft, text: '#526B8A', dot: '#6E86A7' },
  'En destino': { bg: color.amberSoft, text: '#98621B', dot: '#D89B34' },
  Finalizado: { bg: color.greenSoft, text: '#397A55', dot: '#4E9A6C' },
  'Con remito': { bg: color.greenSoft, text: '#397A55', dot: '#4E9A6C' },
  'En planificación': { bg: color.blueSoft, text: '#526B8A', dot: '#6E86A7' },
  'Sin guardar': { bg: color.blueSoft, text: '#526B8A', dot: '#6E86A7' },
  'Con saldo': { bg: color.amberSoft, text: '#98621B', dot: '#D89B34' },
}

export { alpha }
