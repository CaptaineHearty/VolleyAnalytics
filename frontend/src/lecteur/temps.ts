/** Fonctions pures du lecteur : faciles à tester, sans DOM. */

/** Pas utilisé pour avancer/reculer « d'une image ». Le navigateur ne donne pas
 * la cadence de la vidéo ; 1/25 s correspond aux caméras réglées en 25 i/s
 * (standard européen) et reste fin à 30 i/s. */
export const PAS_IMAGE = 1 / 25

/** Saut des flèches gauche/droite, en secondes. */
export const SAUT = 2

export const VITESSES = [0.25, 0.5, 0.75, 1, 1.5, 2] as const

/** 75.3 → "1:15.30" ; 3725.5 → "1:02:05.50" (centièmes de seconde). */
export function formaterTemps(secondes: number): string {
  if (!Number.isFinite(secondes) || secondes < 0) secondes = 0
  const centiemes = Math.round(secondes * 100)
  const h = Math.floor(centiemes / 360000)
  const m = Math.floor((centiemes % 360000) / 6000)
  const s = Math.floor((centiemes % 6000) / 100)
  const c = centiemes % 100
  const deux = (n: number) => String(n).padStart(2, '0')
  const fin = `${deux(s)}.${deux(c)}`
  return h > 0 ? `${h}:${deux(m)}:${fin}` : `${m}:${fin}`
}

/** Garde un temps dans [0, durée]. Durée inconnue (NaN) : seulement ≥ 0. */
export function borner(t: number, duree: number): number {
  const max = Number.isFinite(duree) ? duree : Number.POSITIVE_INFINITY
  return Math.min(Math.max(t, 0), max)
}

/** Vitesse suivante (sens = +1) ou précédente (sens = -1) dans `liste`
 * (triée, de la plus lente à la plus rapide). */
export function vitesseVoisine(actuelle: number, sens: 1 | -1, liste: readonly number[] = VITESSES): number {
  if (liste.length === 0) return actuelle
  const index = liste.findIndex((v) => v >= actuelle - 1e-9)
  const depart = index === -1 ? liste.length - 1 : index
  const exacte = Math.abs(liste[depart] - actuelle) < 1e-9
  const cible = sens === 1 ? (exacte ? depart + 1 : depart) : depart - 1
  return liste[Math.min(Math.max(cible, 0), liste.length - 1)]
}

/** 1536000 → "1,5 Mo" */
export function formaterTaille(octets: number): string {
  const unites = ['o', 'Ko', 'Mo', 'Go']
  let valeur = octets
  let i = 0
  while (valeur >= 1024 && i < unites.length - 1) {
    valeur /= 1024
    i++
  }
  const arrondi = i === 0 ? String(valeur) : valeur.toFixed(1).replace('.', ',')
  return `${arrondi} ${unites[i]}`
}
