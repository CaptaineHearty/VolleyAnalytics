import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { borner, vitesseVoisine } from './temps'
import { ETAT_INITIAL, type ActionsLecteur, type EtatLecteur } from './useLecteur'
import { ETAT_YT, chargerApiYoutube, messageErreurYoutube, type LecteurYT } from './youtube'

/** Fréquence de relevé du temps : l'API YouTube n'a pas d'événement par image. */
const INTERVALLE_MS = 100

interface Suivi {
  id: string | null
  etat: EtatLecteur
  erreur: string | null
}

/**
 * Pilote un lecteur YouTube intégré avec les mêmes commandes que le lecteur
 * local. `conteneur` reçoit l'<iframe> de YouTube ; `id` sert de clé.
 *
 * Différences avec un fichier local :
 * - l'avance image par image n'est pas proposée : `seekTo` se cale sur l'image
 *   clé la plus proche, pas sur un instant exact ;
 * - les vitesses sont celles que YouTube propose pour la vidéo.
 */
export function useLecteurYoutube(
  conteneur: RefObject<HTMLDivElement | null>,
  id: string | null,
): EtatLecteur & ActionsLecteur & { erreur: string | null; tempsActuel: () => number | null } {
  const lecteurRef = useRef<LecteurYT | null>(null)
  const [suivi, setSuivi] = useState<Suivi>({ id, etat: ETAT_INITIAL, erreur: null })
  const courant = suivi.id === id ? suivi : { id, etat: ETAT_INITIAL, erreur: null }

  useEffect(() => {
    const hote = conteneur.current
    if (!hote || !id) return
    let actif = true
    let intervalle: number | undefined
    let lecteur: LecteurYT | null = null

    const maj = (partiel: Partial<EtatLecteur>) => {
      if (!actif) return
      setSuivi((s) => {
        const base = s.id === id ? s : { id, etat: ETAT_INITIAL, erreur: null }
        const changement = Object.entries(partiel).some(([cle, v]) => base.etat[cle as keyof EtatLecteur] !== v)
        return changement ? { ...base, etat: { ...base.etat, ...partiel } } : base
      })
    }
    const erreur = (message: string) => actif && setSuivi((s) => ({ ...(s.id === id ? s : { id, etat: ETAT_INITIAL }), erreur: message }))
    const relever = (l: LecteurYT) => maj({ temps: l.getCurrentTime(), duree: l.getDuration() || Number.NaN })

    // L'API remplace l'élément qu'on lui donne par son <iframe> : on lui donne
    // un élément créé ici, que React ne gère pas.
    const cible = document.createElement('div')
    hote.replaceChildren(cible)

    chargerApiYoutube()
      .then((YT) => {
        if (!actif) return
        lecteur = new YT.Player(cible, {
          videoId: id,
          width: '100%',
          height: '100%',
          playerVars: {
            playsinline: 1,
            // Le clavier reste à VolleyAnalytics (mêmes raccourcis pour toutes les sources).
            disablekb: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (!actif) return
              lecteurRef.current = e.target
              relever(e.target)
              maj({ vitesse: e.target.getPlaybackRate(), enPause: e.target.getPlayerState() !== ETAT_YT.LECTURE })
              intervalle = window.setInterval(() => lecteurRef.current && relever(lecteurRef.current), INTERVALLE_MS)
            },
            onStateChange: (e) => {
              relever(e.target)
              maj({ enPause: e.data !== ETAT_YT.LECTURE })
            },
            onPlaybackRateChange: (e) => maj({ vitesse: e.data }),
            onError: (e) => erreur(messageErreurYoutube(e.data)),
          },
        })
      })
      .catch(() => erreur('Impossible de charger le lecteur YouTube. Vérifiez la connexion internet.'))

    // Un clic dans la vidéo YouTube lui donne le focus clavier : on le rend
    // juste après au bloc du lecteur (focusable, tabindex=-1), pour que les
    // raccourcis du lecteur et de la feuille restent actifs.
    const surPerteDeFocus = () =>
      window.setTimeout(() => {
        const iframe = hote.querySelector('iframe')
        if (actif && iframe && document.activeElement === iframe) {
          iframe.blur()
          hote.closest<HTMLElement>('[tabindex="-1"]')?.focus({ preventScroll: true })
        }
      }, 0)
    window.addEventListener('blur', surPerteDeFocus)

    return () => {
      actif = false
      window.clearInterval(intervalle)
      window.removeEventListener('blur', surPerteDeFocus)
      lecteur?.destroy()
      lecteurRef.current = null
      hote.replaceChildren()
    }
  }, [conteneur, id])

  const allerA = useCallback((secondes: number) => {
    const l = lecteurRef.current
    if (!l) return
    const t = borner(secondes, l.getDuration() || Number.NaN)
    l.seekTo(t, true)
    setSuivi((s) => ({ ...s, etat: { ...s.etat, temps: t } }))
  }, [])

  const basculerLecture = useCallback(() => {
    const l = lecteurRef.current
    if (!l) return
    if (l.getPlayerState() === ETAT_YT.LECTURE) l.pauseVideo()
    else l.playVideo()
  }, [])

  const deplacer = useCallback(
    (secondes: number) => {
      const l = lecteurRef.current
      if (l) allerA(l.getCurrentTime() + secondes)
    },
    [allerA],
  )

  const image = useCallback(() => {
    // Volontairement sans effet : voir la documentation du hook.
  }, [])

  const changerVitesse = useCallback((sens: 1 | -1) => {
    const l = lecteurRef.current
    if (l) l.setPlaybackRate(vitesseVoisine(l.getPlaybackRate(), sens, l.getAvailablePlaybackRates()))
  }, [])

  const tempsActuel = useCallback(() => lecteurRef.current?.getCurrentTime() ?? null, [])

  return {
    ...courant.etat,
    erreur: courant.erreur,
    basculerLecture,
    deplacer,
    image,
    changerVitesse,
    allerA,
    tempsActuel,
  }
}
