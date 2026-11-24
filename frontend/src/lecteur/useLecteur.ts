import { useCallback, useEffect, useState, type RefObject } from 'react'
import { PAS_IMAGE, borner, vitesseVoisine } from './temps'

export interface EtatLecteur {
  temps: number
  duree: number
  enPause: boolean
  vitesse: number
}

export interface ActionsLecteur {
  basculerLecture: () => void
  deplacer: (secondes: number) => void
  image: (sens: 1 | -1) => void
  changerVitesse: (sens: 1 | -1) => void
  allerA: (secondes: number) => void
}

export const ETAT_INITIAL: EtatLecteur = { temps: 0, duree: Number.NaN, enPause: true, vitesse: 1 }

/**
 * Pilote un <video> et suit son état.
 *
 * Le temps affiché suit chaque image grâce à requestVideoFrameCallback quand le
 * navigateur le propose, sinon l'événement timeupdate (moins fréquent).
 * `src` sert de clé : changer de vidéo remet l'état à zéro.
 */
export function useLecteur(
  videoRef: RefObject<HTMLVideoElement | null>,
  src: string | null,
): EtatLecteur & ActionsLecteur {
  // L'état mémorise la vidéo à laquelle il se rapporte : à un changement de
  // vidéo, on repart de l'état initial sans effet ni rendu supplémentaire.
  const [suivi, setSuivi] = useState<{ src: string | null; etat: EtatLecteur }>({ src, etat: ETAT_INITIAL })
  const etat = suivi.src === src ? suivi.etat : ETAT_INITIAL

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    const synchroniser = () =>
      setSuivi({
        src,
        etat: {
          temps: video.currentTime,
          duree: video.duration,
          enPause: video.paused,
          vitesse: video.playbackRate,
        },
      })
    const evenements = ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'play', 'pause', 'ratechange']
    for (const nom of evenements) video.addEventListener(nom, synchroniser)

    let idImage: number | null = null
    if ('requestVideoFrameCallback' in video) {
      const suivre: VideoFrameRequestCallback = (_maintenant, meta) => {
        setSuivi((s) => ({ src, etat: { ...(s.src === src ? s.etat : ETAT_INITIAL), temps: meta.mediaTime } }))
        idImage = video.requestVideoFrameCallback(suivre)
      }
      idImage = video.requestVideoFrameCallback(suivre)
    }

    return () => {
      for (const nom of evenements) video.removeEventListener(nom, synchroniser)
      if (idImage !== null) video.cancelVideoFrameCallback(idImage)
    }
  }, [videoRef, src])

  const allerA = useCallback(
    (secondes: number) => {
      const video = videoRef.current
      if (video) video.currentTime = borner(secondes, video.duration)
    },
    [videoRef],
  )

  const basculerLecture = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      // play() renvoie une promesse rejetée si la lecture est interrompue : sans effet ici.
      void video.play()?.catch(() => {})
    } else {
      video.pause()
    }
  }, [videoRef])

  const deplacer = useCallback(
    (secondes: number) => {
      const video = videoRef.current
      if (video) allerA(video.currentTime + secondes)
    },
    [videoRef, allerA],
  )

  const image = useCallback(
    (sens: 1 | -1) => {
      const video = videoRef.current
      if (!video) return
      video.pause()
      allerA(video.currentTime + sens * PAS_IMAGE)
    },
    [videoRef, allerA],
  )

  const changerVitesse = useCallback(
    (sens: 1 | -1) => {
      const video = videoRef.current
      if (video) video.playbackRate = vitesseVoisine(video.playbackRate, sens)
    },
    [videoRef],
  )

  return { ...etat, basculerLecture, deplacer, image, changerVitesse, allerA }
}
