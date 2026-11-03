import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  normalizeArgentinaPhoneForStorage,
  normalizeArgentinaPhoneForWhatsApp,
} from '../src/utils/telefono.ts'

test('normalizeArgentinaPhoneForWhatsApp', async (t) => {
  await t.test('quita el 0 de larga distancia y agrega el 9 de celular', () => {
    assert.equal(normalizeArgentinaPhoneForWhatsApp('+541159037952'), '5491159037952')
  })

  await t.test('colapsa el código de país duplicado', () => {
    assert.equal(normalizeArgentinaPhoneForWhatsApp('+54 541159037952'), '5491159037952')
  })

  await t.test('no duplica el 9 si ya está presente', () => {
    assert.equal(normalizeArgentinaPhoneForWhatsApp('5491159037952'), '5491159037952')
    assert.equal(normalizeArgentinaPhoneForWhatsApp('+54 9 11 5903-7952'), '5491159037952')
  })

  await t.test('normaliza el formato local con 0 y 15', () => {
    assert.equal(normalizeArgentinaPhoneForWhatsApp('011 15 5903-7952'), '5491159037952')
  })

  await t.test('agrega el código de país cuando falta', () => {
    assert.equal(normalizeArgentinaPhoneForWhatsApp('11 5903 7952'), '5491159037952')
  })

  await t.test('no altera números de otros países con prefijo internacional', () => {
    assert.equal(normalizeArgentinaPhoneForWhatsApp('+1 555 123 4567'), '15551234567')
    assert.equal(normalizeArgentinaPhoneForWhatsApp('00 44 20 7946 0958'), '442079460958')
  })

  await t.test('devuelve vacío cuando no hay dígitos', () => {
    assert.equal(normalizeArgentinaPhoneForWhatsApp(''), '')
  })
})

test('normalizeArgentinaPhoneForStorage', async (t) => {
  await t.test('guarda con un único +54 y sin 0/15', () => {
    assert.equal(normalizeArgentinaPhoneForStorage('+54 541159037952'), '+541159037952')
    assert.equal(normalizeArgentinaPhoneForStorage('011 15 5903-7952'), '+541159037952')
    assert.equal(normalizeArgentinaPhoneForStorage('11 5903 7952'), '+541159037952')
  })

  await t.test('conserva el +54 si el número ya está normalizado', () => {
    assert.equal(normalizeArgentinaPhoneForStorage('+5491159037952'), '+5491159037952')
  })
})
