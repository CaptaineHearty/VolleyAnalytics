import { useEffect } from 'react'
import { SAUT } from './temps'
import type { ActionsLecteur } from './useLecteur'

/** Les touches fléchées et Espace existent à la même place en AZERTY et QWERTY. */
export const RACCOURCIS = [
  { touches: 'Espace', action: 'Lecture / pause' },
  { touches: '← / →', action: `Reculer / avancer de ${SAUT} s` },
  { touches: 'Maj + ← / →', action: 'Image précédente / suivante (fichier local)' },
  { touches: '↓ / ↑', action: 'Ralentir / accélérer' },
] as const

const SAISIES_TEXTE = new Set(['text', 'search', 'email', 'number', 'password', 'tel', 'url', 'date', 'time'])

/** Vrai si l'utilisateur est en train d'écrire : on ne vole pas ses touches. */
export function enTrainDEcrire(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) return false
  if (cible.isContentEditable) return true
  if (cible instanceof HTMLTextAreaElement || cible instanceof HTMLSelectElement) return true
  return cible instanceof HTMLInputElement && SAISIES_TEXTE.has(cible.type)
}

export function useRaccourcis(actions: ActionsLecteur, actif: boolean) {
  useEffect(() => {
    if (!actif) return

    const surTouche = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || enTrainDEcrire(e.target)) return

      switch (e.key) {
        case ' ':
          actions.basculerLecture()
          break
        case 'ArrowLeft':
          if (e.shiftKey) actions.image(-1)
          else actions.deplacer(-SAUT)
          break
        case 'ArrowRight':
          if (e.shiftKey) actions.image(1)
          else actions.deplacer(SAUT)
          break
        case 'ArrowUp':
          actions.changerVitesse(1)
          break
        case 'ArrowDown':
          actions.changerVitesse(-1)
          break
        default:
          return
      }
      // Empêche le défilement de la page, et le « clic » d'un bouton qui aurait
      // le focus quand on appuie sur Espace (sinon double lecture/pause).
      e.preventDefault()
    }

    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [actions, actif])
}
