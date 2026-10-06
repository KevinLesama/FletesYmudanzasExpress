import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from './theme'

export function renderPage(element: React.ReactElement): void {
  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('No se encontró el elemento #root')
  createRoot(rootEl).render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {element}
      </ThemeProvider>
    </React.StrictMode>,
  )
}