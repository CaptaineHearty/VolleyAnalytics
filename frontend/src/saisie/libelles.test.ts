import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { GRILLE_ZONES, messagesErreur, nomMatch } from './libelles'

describe('messagesErreur', () => {
  it("détaille les erreurs de validation (400) champ par champ", () => {
    const erreur = new ApiError(400, { zone: ['Trop grand.'], equipe: 'Hors match.' })
    expect(messagesErreur(erreur)).toEqual(['zone : Trop grand.', 'equipe : Hors match.'])
  })

  it.each([401, 403])('signale une session expirée (%i)', (status) => {
    expect(messagesErreur(new ApiError(status, null))).toEqual(['Session expirée : reconnectez-vous.'])
  })

  it('signale une erreur serveur', () => {
    expect(messagesErreur(new ApiError(500, null))[0]).toContain('(500)')
  })

  it('signale un serveur injoignable', () => {
    expect(messagesErreur(new TypeError('Failed to fetch'))[0]).toContain('Django est-il lancé')
  })
})

describe('GRILLE_ZONES', () => {
  it('place la ligne avant (2, 3, 4) au filet et la ligne arrière (1, 5, 6) derrière', () => {
    expect([...GRILLE_ZONES[0]].sort()).toEqual([2, 3, 4])
    expect([...GRILLE_ZONES[1]].sort()).toEqual([1, 5, 6])
  })
})

describe('nomMatch', () => {
  it('assemble la date et les noms des équipes', () => {
    const equipes = [
      { id: 1, nom: 'Évry', club: '' },
      { id: 2, nom: 'Ivry', club: '' },
    ]
    const match = {
      id: 5,
      equipe_dom: 1,
      equipe_ext: 2,
      date: '2026-11-23',
      competition: '',
      video_nom: '',
      video_taille: 0,
      video_youtube: '',
      cree_par: null,
      cree_le: '',
    }
    expect(nomMatch(match, equipes)).toBe('2026-11-23 · Évry – Ivry')
  })
})
