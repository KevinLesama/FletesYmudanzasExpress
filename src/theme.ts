import { createTheme, alpha } from '@mui/material/styles'

export const brand = {
  navy: '#132B4A',
  navySoft: '#172942',
  cream: '#F7F6F2',
  card: '#FFFFFF',
  orange: '#F07855',
  orangeDark: '#DF6948',
  border: '#E9E6DF',
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brand.navy, dark: '#0E2140', contrastText: '#FFFFFF' },
    secondary: { main: brand.orange, dark: brand.orangeDark, contrastText: '#FFFFFF' },
    background: { default: brand.cream, paper: brand.card },
    text: { primary: brand.navy, secondary: '#5C6B7A' },
    success: { main: '#2F7D55', light: '#EDF7F2', dark: '#286B50' },
    warning: { main: '#B9761F', light: '#FFF4E5', dark: '#98621B' },
    error: { main: '#B24A3A', light: '#FFF3EF', dark: '#9C493A' },
    info: { main: '#526B8A', light: '#EEF2FA' },
    divider: brand.border,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "'DM Sans', sans-serif",
    h1: { fontFamily: "'Manrope', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' },
    h2: { fontFamily: "'Manrope', sans-serif", fontWeight: 800, letterSpacing: '-0.025em' },
    h3: { fontFamily: "'Manrope', sans-serif", fontWeight: 800, letterSpacing: '-0.02em' },
    h4: { fontFamily: "'Manrope', sans-serif", fontWeight: 800, letterSpacing: '-0.02em' },
    h5: { fontFamily: "'Manrope', sans-serif", fontWeight: 800 },
    h6: { fontFamily: "'Manrope', sans-serif", fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 700 },
    button: { fontWeight: 700, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': { minHeight: '100%' },
        body: { backgroundColor: brand.cream, color: brand.navy, WebkitFontSmoothing: 'antialiased' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 700, boxShadow: 'none', borderRadius: 10 },
        containedPrimary: {
          backgroundColor: brand.navy,
          '&:hover': { backgroundColor: '#0E2140', boxShadow: 'none' },
        },
        containedSecondary: {
          '&:hover': { backgroundColor: brand.orangeDark, boxShadow: 'none' },
        },
        outlined: { boxShadow: 'none' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { border: `1px solid ${brand.border}` },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${brand.border}`,
          borderRadius: 14,
          boxShadow: '0 1px 2px rgba(19,43,74,0.04)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottomColor: '#EDEAE3', fontSize: 14 },
        head: { fontWeight: 700, color: '#5C6B7A', backgroundColor: '#FBF9F6' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': { backgroundColor: '#FFFFFF' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700 },
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
  Confirmada: { bg: '#EAF6EF', text: '#397A55', dot: '#4E9A6C' },
  Confirmado: { bg: '#EAF6EF', text: '#397A55', dot: '#4E9A6C' },
  'Pendiente de seña': { bg: '#FFF4E5', text: '#98621B', dot: '#D89B34' },
  'Pendiente de revisión': { bg: '#EEF2FA', text: '#526B8A', dot: '#6E86A7' },
  Tentativa: { bg: '#FFF3EF', text: '#9C493A', dot: '#BD6655' },
  Cancelada: { bg: '#F1F2F4', text: '#6F7780', dot: '#8A929B' },
  Disponible: { bg: '#EAF6EF', text: '#397A55', dot: '#4E9A6C' },
  Asignado: { bg: '#FFF4E5', text: '#98621B', dot: '#D89B34' },
  'En taller': { bg: '#F1F2F4', text: '#6F7780', dot: '#8A929B' },
  Activo: { bg: '#E8F5ED', text: '#26734B', dot: '#3D8A5F' },
  Inactivo: { bg: '#F1F2F4', text: '#6F7780', dot: '#8A929B' },
  'Sin pagos': { bg: '#F1F2F4', text: '#6F7780', dot: '#8A929B' },
  Parcial: { bg: '#FFF4E5', text: '#98621B', dot: '#D89B34' },
  Cobrado: { bg: '#EAF6EF', text: '#397A55', dot: '#4E9A6C' },
  'Guardada': { bg: '#EAF6EF', text: '#397A55', dot: '#4E9A6C' },
  'Borrador': { bg: '#EEF2FA', text: '#526B8A', dot: '#6E86A7' },
  'En destino': { bg: '#FFF4E5', text: '#98621B', dot: '#D89B34' },
  'Finalizado': { bg: '#EAF6EF', text: '#397A55', dot: '#4E9A6C' },
  'Con remito': { bg: '#EAF6EF', text: '#397A55', dot: '#4E9A6C' },
  'En planificación': { bg: '#EEF2FA', text: '#526B8A', dot: '#6E86A7' },
  'Sin guardar': { bg: '#EEF2FA', text: '#526B8A', dot: '#6E86A7' },
  'Con saldo': { bg: '#FFF4E5', text: '#98621B', dot: '#D89B34' },
}

export { alpha }