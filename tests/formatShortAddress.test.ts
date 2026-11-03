import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatShortAddress, formatShortPlace } from '../src/format.ts'

// Direcciones reales del registro FEX-1035 tal como las guarda el geocodificador.
const ORIGEN_FEX_1035 =
  'Hipódromo, Senderos para ciclistas, Palermo Pacífico, Palermo, Buenos Aires, Comuna 14, Ciudad Autónoma de Buenos Aires, C1425ABX, Argentina'
const DESTINO_FEX_1035 =
  'Plaza Constitución, 1128, Brasil, Constitución, Buenos Aires, Comuna 1, Ciudad Autónoma de Buenos Aires, C1138, Argentina'

test('formatShortAddress', async (t) => {
  await t.test('acorta el origen real de FEX-1035', () => {
    assert.equal(formatShortAddress(ORIGEN_FEX_1035), 'Hipódromo de Palermo, Palermo')
  })

  await t.test('acorta el destino real de FEX-1035', () => {
    assert.equal(formatShortAddress(DESTINO_FEX_1035), 'Plaza Constitución 1128, Constitución')
  })

  await t.test('no rompe con dirección vacía, null o undefined', () => {
    assert.equal(formatShortAddress(''), '')
    assert.equal(formatShortAddress(null), '')
    assert.equal(formatShortAddress(undefined), '')
  })

  await t.test('deduplica partes repetidas ignorando mayúsculas y tildes', () => {
    assert.equal(formatShortAddress('Av. Cabildo 100, Belgrano, belgrano, ARGENTINA'), 'Av. Cabildo 100, Belgrano')
  })

  await t.test('prioriza la localidad estructurada sobre el parseo del string', () => {
    assert.equal(formatShortAddress(DESTINO_FEX_1035, { locality: 'Monserrat' }), 'Plaza Constitución 1128, Monserrat')
  })

  await t.test('usa calle y número estructurados cuando están disponibles', () => {
    assert.equal(
      formatShortAddress('Cualquier cosa, Argentina', { road: 'Av. Santa Fe', houseNumber: '4321', neighbourhood: 'Palermo' }),
      'Av. Santa Fe 4321, Palermo',
    )
  })
})

test('formatShortPlace tolera barrio nulo y delega en formatShortAddress', () => {
  assert.equal(formatShortPlace({ address: ORIGEN_FEX_1035, barrio: null }), 'Hipódromo de Palermo, Palermo')
  assert.equal(formatShortPlace({ address: 'Av. Corrientes 1234', barrio: '' }), 'Av. Corrientes 1234')
})
