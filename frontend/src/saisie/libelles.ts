import { ApiError } from '../api/client'
import type { Action, Equipe, Match } from '../api/types'

/** La lettre sert aussi de raccourci clavier. */
export const ACTIONS: readonly { code: Action; libelle: string }[] = [
  { code: 'S', libelle: 'Service' },
  { code: 'R', libelle: 'Réception' },
  { code: 'P', libelle: 'Passe' },
  { code: 'A', libelle: 'Attaque' },
  { code: 'B', libelle: 'Bloc' },
  { code: 'D', libelle: 'Défense' },
]

export const LIBELLE_ACTION: Record<Action, string> = Object.fromEntries(
  ACTIONS.map((a) => [a.code, a.libelle]),
) as Record<Action, string>

/** Disposition du terrain vu du fond : ligne avant (au filet) 4-3-2, ligne arrière 5-6-1. */
export const GRILLE_ZONES = [
  [4, 3, 2],
  [5, 6, 1],
] as const

/** 0 = erreur … 3 = parfait (voir le modèle Django). */
export const QUALITES = [0, 1, 2, 3] as const
export const SETS = [1, 2, 3, 4, 5] as const

/** Transforme une erreur d'API en phrases lisibles. */
export function messagesErreur(erreur: unknown): string[] {
  if (erreur instanceof ApiError) {
    if (erreur.status === 400 && erreur.details && typeof erreur.details === 'object') {
      return Object.entries(erreur.details as Record<string, unknown>).map(
        ([champ, msg]) => `${champ} : ${Array.isArray(msg) ? msg.join(' ') : String(msg)}`,
      )
    }
    if (erreur.status === 401 || erreur.status === 403) return ['Session expirée : reconnectez-vous.']
    return [`Le serveur a répondu avec une erreur (${erreur.status}).`]
  }
  return ["Impossible de joindre l'API. Le serveur Django est-il lancé ?"]
}

/** « 2026-11-23 · Évry – Saint-Ouen » */
export function nomMatch(match: Match, equipes: Equipe[]): string {
  const nom = (id: number) => equipes.find((e) => e.id === id)?.nom ?? `Équipe ${id}`
  return `${match.date} · ${nom(match.equipe_dom)} – ${nom(match.equipe_ext)}`
}
