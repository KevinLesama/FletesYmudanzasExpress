import { defineConfig } from 'vitest/config'

/**
 * Pruebas del frontend.
 *
 * Solo cubre logica pura (funciones sin DOM ni red) para que el runner sea
 * rapido y no necesite navegador. Si mas adelante hacen falta pruebas de
 * componentes, alcanza con cambiar `environment` a 'jsdom' y agregar la
 * dependencia correspondiente.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
