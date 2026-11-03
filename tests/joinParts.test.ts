import assert from 'node:assert/strict'
import { test } from 'node:test'
import { joinParts } from '../src/format.ts'

test('joinParts', async (t) => {
  await t.test('une los datos presentes con el separador por defecto', () => {
    assert.equal(joinParts(['Hernán Pérez', '3', '']), 'Hernán Pérez · 3')
  })

  await t.test('descarta el vacío inicial', () => {
    assert.equal(joinParts(['', 'Dana']), 'Dana')
  })

  await t.test('devuelve vacío cuando no queda nada', () => {
    assert.equal(joinParts([null, undefined, '  ']), '')
  })

  await t.test('descarta false y respeta el string restante', () => {
    assert.equal(joinParts([false, 'sin ascensor']), 'sin ascensor')
  })

  await t.test('hace trim y acepta un separador propio', () => {
    assert.equal(joinParts([' Camión mudancero ', ' AF 789 FG ']), 'Camión mudancero · AF 789 FG')
    assert.equal(joinParts(['Palermo', 'Constitución'], ' → '), 'Palermo → Constitución')
  })

  await t.test('no deja separadores colgados con varios faltantes', () => {
    assert.equal(joinParts(['', null, 'Hernán Pérez', undefined, false, '']), 'Hernán Pérez')
  })
})
