import { vi } from 'vitest'
import type { Equipe, Evenement, Joueur, Match } from '../api/types'

export interface BaseFactice {
  equipes: Equipe[]
  joueurs: Joueur[]
  matchs: Match[]
  evenements: Evenement[]
}

interface Appel {
  methode: string
  chemin: string
  corps: Record<string, unknown> | undefined
}

/** Permet à un test de forcer une réponse (erreur 400, 500…) pour une requête donnée. */
type Interception = (appel: Appel) => { status: number; corps?: unknown } | undefined

const page = <T>(results: T[]) => ({ count: results.length, next: null, previous: null, results })

/**
 * Une fausse API Django en mémoire, branchée à la place de fetch : les
 * composants l'utilisent exactement comme la vraie (mêmes routes, mêmes réponses).
 */
export function creerApiFactice(depart: BaseFactice, intercepter?: Interception) {
  const base: BaseFactice = structuredClone(depart)
  const appels: Appel[] = []
  let prochainId = 1000

  const repondre = (status: number, corps?: unknown) =>
    new Response(status === 204 || corps === undefined ? null : JSON.stringify(corps), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  const faux = vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entree), 'http://localhost')
    const methode = (init?.method ?? 'GET').toUpperCase()
    const corps = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined
    const appel = { methode, chemin: url.pathname + url.search, corps }
    appels.push(appel)

    const force = intercepter?.(appel)
    if (force) return repondre(force.status, force.corps)

    const p = url.pathname
    const q = url.searchParams
    const idDans = (prefixe: string) => Number(p.slice(prefixe.length).replace('/', ''))

    if (methode === 'GET' && p === '/api/equipes/') return repondre(200, page(base.equipes))
    if (methode === 'GET' && p === '/api/joueurs/') {
      return repondre(200, page(base.joueurs.filter((j) => !q.get('equipe') || j.equipe === Number(q.get('equipe')))))
    }
    if (methode === 'GET' && p === '/api/matchs/') return repondre(200, page(base.matchs))
    if (methode === 'POST' && p === '/api/matchs/') {
      const match = { id: prochainId++, competition: '', cree_par: 'scout', cree_le: '2026-11-24T10:00:00Z', ...corps } as Match
      base.matchs.push(match)
      return repondre(201, match)
    }
    if (methode === 'GET' && p === '/api/evenements/') {
      const liste = base.evenements
        .filter((e) => e.match === Number(q.get('match')))
        .sort((a, b) => a.t_video - b.t_video)
      return repondre(200, page(liste))
    }
    if (methode === 'POST' && p === '/api/evenements/') {
      const ev = { id: prochainId++, saisi_par: 'scout', cree_le: '2026-11-24T10:00:00Z', ...corps } as Evenement
      base.evenements.push(ev)
      return repondre(201, ev)
    }
    if (p.startsWith('/api/evenements/')) {
      const id = idDans('/api/evenements/')
      const index = base.evenements.findIndex((e) => e.id === id)
      if (index === -1) return repondre(404, { detail: 'Non trouvé.' })
      if (methode === 'PATCH') {
        base.evenements[index] = { ...base.evenements[index], ...corps } as Evenement
        return repondre(200, base.evenements[index])
      }
      if (methode === 'DELETE') {
        base.evenements.splice(index, 1)
        return repondre(204)
      }
    }
    return repondre(404, { detail: `Route inconnue : ${methode} ${p}` })
  })

  vi.stubGlobal('fetch', faux)
  return {
    base,
    /** Les requêtes reçues, filtrées par méthode et début de chemin. */
    appels: (methode: string, debut = '') => appels.filter((a) => a.methode === methode && a.chemin.startsWith(debut)),
  }
}
