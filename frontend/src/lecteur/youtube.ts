/**
 * Intégration du lecteur YouTube officiel (API IFrame).
 * La vidéo n'est jamais téléchargée : elle est lue par le lecteur de YouTube,
 * que l'on pilote en JavaScript. Doc : developers.google.com/youtube/iframe_api_reference
 */

/** Les seules méthodes de l'API dont on se sert. */
export interface LecteurYT {
  playVideo(): void
  pauseVideo(): void
  seekTo(secondes: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  getPlaybackRate(): number
  setPlaybackRate(vitesse: number): void
  getAvailablePlaybackRates(): number[]
  destroy(): void
}

export interface OptionsLecteurYT {
  videoId: string
  width?: string | number
  height?: string | number
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (e: { target: LecteurYT }) => void
    onStateChange?: (e: { data: number; target: LecteurYT }) => void
    onPlaybackRateChange?: (e: { data: number; target: LecteurYT }) => void
    onError?: (e: { data: number; target: LecteurYT }) => void
  }
}

export interface ApiYoutube {
  Player: new (element: HTMLElement, options: OptionsLecteurYT) => LecteurYT
}

declare global {
  interface Window {
    YT?: ApiYoutube
    onYouTubeIframeAPIReady?: () => void
  }
}

/** Valeurs de onStateChange (documentation de l'API IFrame). */
export const ETAT_YT = { NON_DEMARRE: -1, TERMINE: 0, LECTURE: 1, PAUSE: 2, MISE_EN_MEMOIRE: 3, CHARGEE: 5 } as const

const MOTIF_ID = /^[A-Za-z0-9_-]{11}$/

/**
 * Retrouve l'identifiant (11 caractères) d'une vidéo à partir d'un lien
 * youtube.com/watch?v=, youtu.be/, /shorts/, /live/, /embed/ ou de l'identifiant seul.
 */
export function extraireIdYoutube(texte: string): string | null {
  const brut = texte.trim()
  if (MOTIF_ID.test(brut)) return brut

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(brut) ? brut : `https://${brut}`)
  } catch {
    return null
  }
  const hote = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '')
  let candidat: string | null = null
  if (hote === 'youtu.be') {
    candidat = url.pathname.split('/')[1] ?? null
  } else if (hote === 'youtube.com' || hote === 'youtube-nocookie.com') {
    candidat =
      url.pathname === '/watch'
        ? url.searchParams.get('v')
        : (url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1] ?? null)
  }
  return candidat && MOTIF_ID.test(candidat) ? candidat : null
}

/** Message lisible pour les codes d'erreur de onError. */
export function messageErreurYoutube(code: number): string {
  switch (code) {
    case 2:
      return 'Lien YouTube invalide.'
    case 5:
      return "Le lecteur YouTube n'a pas pu lire cette vidéo."
    case 100:
      return 'Vidéo YouTube introuvable : elle a été supprimée ou elle est privée.'
    case 101:
    case 150:
      return "Le propriétaire de cette vidéo n'autorise pas sa lecture sur d'autres sites."
    case 153:
      return "YouTube refuse la lecture : la page n'a pas envoyé d'en-tête Referer."
    default:
      return `Erreur du lecteur YouTube (code ${code}).`
  }
}

const URL_API = 'https://www.youtube.com/iframe_api'
let chargement: Promise<ApiYoutube> | null = null

/** Charge le script de l'API une seule fois, même si plusieurs lecteurs le demandent. */
export function chargerApiYoutube(): Promise<ApiYoutube> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  chargement ??= new Promise<ApiYoutube>((resoudre, rejeter) => {
    const precedent = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      precedent?.()
      if (window.YT) resoudre(window.YT)
    }
    const script = document.createElement('script')
    script.src = URL_API
    script.async = true
    script.onerror = () => {
      chargement = null // on pourra réessayer
      script.remove()
      rejeter(new Error('API YouTube injoignable'))
    }
    document.head.appendChild(script)
  })
  return chargement
}

/** Pour les tests : oublie un chargement en cours. */
export function oublierChargementYoutube() {
  chargement = null
}
