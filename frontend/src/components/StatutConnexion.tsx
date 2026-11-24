import { useEffect, useState } from 'react'
import { ApiError, apiFetch } from '../api/client'
import type { Equipe, Page } from '../api/types'

type Etat =
  | { type: 'chargement' }
  | { type: 'connecte'; nbEquipes: number }
  | { type: 'non-connecte' }
  | { type: 'erreur'; message: string }

/** Vérifie que le frontend joint l'API et que l'utilisateur est connecté. */
export function StatutConnexion() {
  const [etat, setEtat] = useState<Etat>({ type: 'chargement' })

  useEffect(() => {
    let actif = true
    apiFetch<Page<Equipe>>('/api/equipes/')
      .then((page) => actif && setEtat({ type: 'connecte', nbEquipes: page.count }))
      .catch((erreur: unknown) => {
        if (!actif) return
        if (erreur instanceof ApiError && (erreur.status === 401 || erreur.status === 403)) {
          setEtat({ type: 'non-connecte' })
        } else {
          setEtat({ type: 'erreur', message: "Impossible de joindre l'API. Le serveur Django est-il lancé ?" })
        }
      })
    return () => {
      actif = false
    }
  }, [])

  switch (etat.type) {
    case 'chargement':
      return <p role="status">Connexion à l'API…</p>
    case 'connecte':
      return (
        <p role="status">
          Connecté à l'API · {etat.nbEquipes} équipe{etat.nbEquipes > 1 ? 's' : ''} enregistrée
          {etat.nbEquipes > 1 ? 's' : ''}
        </p>
      )
    case 'non-connecte':
      return (
        <p role="status">
          Vous n'êtes pas connecté. <a href="/api-auth/login/?next=/">Se connecter</a>
        </p>
      )
    case 'erreur':
      return <p role="alert">{etat.message}</p>
  }
}
