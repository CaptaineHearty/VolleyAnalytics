import { vi } from 'vitest'

/**
 * jsdom ne sait pas lire de vidéo : on simule l'état d'un <video> (pause,
 * position, durée, vitesse) et les événements qu'un vrai navigateur émettrait.
 */
interface EtatMedia {
  paused: boolean
  currentTime: number
  duration: number
  playbackRate: number
}

export function simulerMedia(duree = 120) {
  const etats = new WeakMap<HTMLMediaElement, EtatMedia>()
  const etat = (el: HTMLMediaElement) => {
    let e = etats.get(el)
    if (!e) {
      e = { paused: true, currentTime: 0, duration: duree, playbackRate: 1 }
      etats.set(el, e)
    }
    return e
  }
  const emettre = (el: HTMLMediaElement, nom: string) => el.dispatchEvent(new Event(nom))
  const proto = HTMLMediaElement.prototype

  vi.spyOn(proto, 'paused', 'get').mockImplementation(function (this: HTMLMediaElement) {
    return etat(this).paused
  })
  vi.spyOn(proto, 'duration', 'get').mockImplementation(function (this: HTMLMediaElement) {
    return etat(this).duration
  })
  vi.spyOn(proto, 'currentTime', 'get').mockImplementation(function (this: HTMLMediaElement) {
    return etat(this).currentTime
  })
  vi.spyOn(proto, 'currentTime', 'set').mockImplementation(function (this: HTMLMediaElement, t: number) {
    etat(this).currentTime = t
    emettre(this, 'seeked')
  })
  vi.spyOn(proto, 'playbackRate', 'get').mockImplementation(function (this: HTMLMediaElement) {
    return etat(this).playbackRate
  })
  vi.spyOn(proto, 'playbackRate', 'set').mockImplementation(function (this: HTMLMediaElement, v: number) {
    etat(this).playbackRate = v
    emettre(this, 'ratechange')
  })
  const play = vi.spyOn(proto, 'play').mockImplementation(function (this: HTMLMediaElement) {
    etat(this).paused = false
    emettre(this, 'play')
    return Promise.resolve()
  })
  const pause = vi.spyOn(proto, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    etat(this).paused = true
    emettre(this, 'pause')
  })
  return { play, pause }
}

/** jsdom n'a pas URL.createObjectURL : on le simule avec des URL numérotées. */
export function simulerUrlsBlob() {
  let n = 0
  const creer = vi.fn((_objet: Blob | MediaSource) => `blob:test/${++n}`)
  const liberer = vi.fn((_url: string) => {})
  Object.defineProperty(URL, 'createObjectURL', { value: creer, configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: liberer, configurable: true, writable: true })
  return { creer, liberer }
}
