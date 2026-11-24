import { vi } from 'vitest'
import { ETAT_YT, type LecteurYT, type OptionsLecteurYT } from '../lecteur/youtube'

/**
 * Faux lecteur YouTube pour jsdom : même interface que l'API IFrame officielle
 * (constructeur YT.Player, événements, méthodes), sans réseau.
 */
export class FauxLecteurYT implements LecteurYT {
  static instances: FauxLecteurYT[] = []

  readonly options: OptionsLecteurYT
  readonly iframe: HTMLIFrameElement
  temps = 0
  duree = 300
  etat: number = ETAT_YT.CHARGEE
  vitesse = 1
  vitesses = [0.25, 0.5, 1, 1.5, 2]
  detruit = false
  seekTo = vi.fn((s: number) => {
    this.temps = s
  })

  constructor(element: HTMLElement, options: OptionsLecteurYT) {
    this.options = options
    // Comme l'API réelle : l'élément fourni est remplacé par une <iframe>.
    this.iframe = document.createElement('iframe')
    this.iframe.title = 'Lecteur YouTube'
    element.replaceWith(this.iframe)
    FauxLecteurYT.instances.push(this)
  }

  /** Simule la fin du chargement (événement onReady). */
  pret() {
    this.options.events?.onReady?.({ target: this })
  }

  erreur(code: number) {
    this.options.events?.onError?.({ data: code, target: this })
  }

  playVideo() {
    this.etat = ETAT_YT.LECTURE
    this.options.events?.onStateChange?.({ data: this.etat, target: this })
  }
  pauseVideo() {
    this.etat = ETAT_YT.PAUSE
    this.options.events?.onStateChange?.({ data: this.etat, target: this })
  }
  getCurrentTime() {
    return this.temps
  }
  getDuration() {
    return this.duree
  }
  getPlayerState() {
    return this.etat
  }
  getPlaybackRate() {
    return this.vitesse
  }
  setPlaybackRate(v: number) {
    this.vitesse = v
    this.options.events?.onPlaybackRateChange?.({ data: v, target: this })
  }
  getAvailablePlaybackRates() {
    return this.vitesses
  }
  destroy() {
    this.detruit = true
    this.iframe.remove()
  }
}

/** Installe le faux YT global ; à appeler avant de charger une vidéo YouTube. */
export function simulerYoutube() {
  FauxLecteurYT.instances = []
  window.YT = { Player: FauxLecteurYT }
  return {
    dernier: () => FauxLecteurYT.instances.at(-1) as FauxLecteurYT,
    instances: () => FauxLecteurYT.instances,
  }
}

export function retirerYoutube() {
  delete window.YT
}
