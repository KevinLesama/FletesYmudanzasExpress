import assert from 'node:assert/strict'
import { test } from 'node:test'

const store = new Map<string, string>()
const fakeLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
}

Object.defineProperty(globalThis, 'window', {
  value: { localStorage: fakeLocalStorage },
  configurable: true,
})

const { loadDriverProgress, saveDriverProgress, clearDriverProgress } = await import(
  '../src/driverTripProgress.ts'
)

test('driverTripProgress', async (t) => {
  await t.test('devuelve el progreso inicial cuando no hay nada guardado', () => {
    assert.deepEqual(loadDriverProgress('FEX-1'), {
      phase: 1,
      originArrived: false,
      loadedItems: [],
    })
  })

  await t.test('guarda y recupera el progreso del viaje', () => {
    saveDriverProgress('FEX-2', {
      phase: 3,
      originArrived: true,
      loadedItems: [0, 2],
      paymentMethod: 'Efectivo',
    })

    assert.deepEqual(loadDriverProgress('FEX-2'), {
      phase: 3,
      originArrived: true,
      loadedItems: [0, 2],
      paymentMethod: 'Efectivo',
    })
  })

  await t.test('sanea una fase, ítems y modalidad inválidos', () => {
    store.set(
      'fletes:chofer:viaje:FEX-3',
      JSON.stringify({
        phase: 9,
        originArrived: false,
        loadedItems: [0, -1, 1.5, 2],
        paymentMethod: 'Cripto',
      }),
    )

    assert.deepEqual(loadDriverProgress('FEX-3'), {
      phase: 1,
      originArrived: false,
      loadedItems: [0, 2],
      paymentMethod: undefined,
    })
  })

  await t.test('ignora un JSON corrupto', () => {
    store.set('fletes:chofer:viaje:FEX-4', '{roto')
    assert.deepEqual(loadDriverProgress('FEX-4'), {
      phase: 1,
      originArrived: false,
      loadedItems: [],
    })
  })

  await t.test('borra el progreso al cerrar el viaje', () => {
    saveDriverProgress('FEX-5', { phase: 2, originArrived: true, loadedItems: [1] })
    clearDriverProgress('FEX-5')
    assert.deepEqual(loadDriverProgress('FEX-5'), {
      phase: 1,
      originArrived: false,
      loadedItems: [],
    })
  })
})
