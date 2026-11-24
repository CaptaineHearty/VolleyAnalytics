import { describe, expect, it } from 'vitest'
import { borner, formaterTaille, formaterTemps, vitesseVoisine } from './temps'

describe('formaterTemps', () => {
  it.each([
    [0, '0:00.00'],
    [5.5, '0:05.50'],
    [75.3, '1:15.30'],
    [599.999, '10:00.00'],
    [3725.5, '1:02:05.50'],
    [-3, '0:00.00'],
    [Number.NaN, '0:00.00'],
  ])('%s s → %s', (secondes, attendu) => {
    expect(formaterTemps(secondes)).toBe(attendu)
  })
})

describe('borner', () => {
  it('ne descend pas sous 0', () => expect(borner(-2, 60)).toBe(0))
  it('ne dépasse pas la durée', () => expect(borner(65, 60)).toBe(60))
  it('laisse passer un temps valide', () => expect(borner(12.5, 60)).toBe(12.5))
  it('accepte une durée encore inconnue', () => expect(borner(500, Number.NaN)).toBe(500))
})

describe('vitesseVoisine', () => {
  it.each([
    [1, 1, 1.5],
    [1, -1, 0.75],
    [2, 1, 2],
    [0.25, -1, 0.25],
    [1.2, 1, 1.5],
    [1.2, -1, 1],
  ] as const)('depuis %s, sens %s → %s', (depart, sens, attendu) => {
    expect(vitesseVoisine(depart, sens)).toBe(attendu)
  })
})

describe('vitesseVoisine avec une liste fournie (vitesses proposées par YouTube)', () => {
  const youtube = [0.25, 0.5, 1, 1.5, 2]
  it('monte et descend dans la liste donnée', () => {
    expect(vitesseVoisine(1, 1, youtube)).toBe(1.5)
    expect(vitesseVoisine(1, -1, youtube)).toBe(0.5)
  })
  it('reste en place si la liste est vide', () => {
    expect(vitesseVoisine(1, 1, [])).toBe(1)
  })
})

describe('formaterTaille', () => {
  it.each([
    [500, '500 o'],
    [1536, '1,5 Ko'],
    [1536000, '1,5 Mo'],
    [3 * 1024 ** 3, '3,0 Go'],
  ])('%s octets → %s', (octets, attendu) => {
    expect(formaterTaille(octets)).toBe(attendu)
  })
})
