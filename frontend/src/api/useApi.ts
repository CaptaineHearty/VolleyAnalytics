import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from './client'

interface Resultat<T> {
  /** Dernières données reçues : elles restent affichées pendant un rechargement. */
  donnees: T | null
  erreur: unknown
  chargement: boolean
  /** Relance la requête (après une création, une modification…). */
  recharger: () => void
}

/**
 * Charge une ressource GET. `chemin` null = rien à charger.
 * L'état mémorise la requête à laquelle il se rapporte : pas de setState
 * synchrone dans l'effet, et une réponse arrivée trop tard est ignorée.
 */
export function useApi<T>(chemin: string | null): Resultat<T> {
  const [version, setVersion] = useState(0)
  const cle = chemin === null ? null : `${chemin}#${version}`
  const [etat, setEtat] = useState<{ cle: string | null; donnees: T | null; erreur: unknown }>({
    cle: null,
    donnees: null,
    erreur: null,
  })

  useEffect(() => {
    if (chemin === null || cle === null) return
    let actif = true
    apiFetch<T>(chemin)
      .then((donnees) => actif && setEtat({ cle, donnees, erreur: null }))
      .catch((erreur: unknown) => actif && setEtat((e) => ({ cle, donnees: e.donnees, erreur })))
    return () => {
      actif = false
    }
  }, [chemin, cle])

  const recharger = useCallback(() => setVersion((v) => v + 1), [])
  return {
    donnees: chemin === null ? null : etat.donnees,
    erreur: etat.cle === cle ? etat.erreur : null,
    chargement: chemin !== null && etat.cle !== cle,
    recharger,
  }
}
