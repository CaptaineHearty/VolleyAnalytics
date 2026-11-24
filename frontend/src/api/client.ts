/**
 * Petit client pour l'API Django.
 *
 * - Envoie le cookie de session (même origine grâce au proxy Vite).
 * - Ajoute le jeton CSRF de Django sur les requêtes qui modifient des données.
 * - Transforme toute réponse non 2xx en ApiError, avec le statut HTTP.
 */

export class ApiError extends Error {
  readonly status: number
  readonly details: unknown

  constructor(status: number, details: unknown) {
    super(`Erreur API ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

const METHODES_SURES = new Set(['GET', 'HEAD', 'OPTIONS'])

export function lireCookie(nom: string): string | null {
  for (const morceau of document.cookie.split(';')) {
    const [cle, ...valeur] = morceau.trim().split('=')
    if (cle === nom) return decodeURIComponent(valeur.join('='))
  }
  return null
}

export async function apiFetch<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const methode = (options.method ?? 'GET').toUpperCase()
  const entetes = new Headers(options.headers)
  entetes.set('Accept', 'application/json')
  if (options.body !== undefined && !entetes.has('Content-Type')) {
    entetes.set('Content-Type', 'application/json')
  }
  if (!METHODES_SURES.has(methode)) {
    const jeton = lireCookie('csrftoken')
    if (jeton) entetes.set('X-CSRFToken', jeton)
  }

  const reponse = await fetch(chemin, {
    ...options,
    method: methode,
    headers: entetes,
    credentials: 'same-origin',
  })

  const texte = await reponse.text()
  const donnees: unknown = texte ? JSON.parse(texte) : null
  if (!reponse.ok) throw new ApiError(reponse.status, donnees)
  return donnees as T
}
