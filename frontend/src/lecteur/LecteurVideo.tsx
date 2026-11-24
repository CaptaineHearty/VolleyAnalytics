import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type Ref,
} from 'react'
import './LecteurVideo.css'
import { SAUT, formaterTaille, formaterTemps } from './temps'
import { useLecteur } from './useLecteur'
import { useLecteurYoutube } from './useLecteurYoutube'
import { RACCOURCIS, useRaccourcis } from './useRaccourcis'
import { extraireIdYoutube } from './youtube'

/** La vidéo affichée, telle que le reste de l'écran a besoin de la connaître. */
export type SourceVideo = { type: 'fichier'; nom: string; taille: number } | { type: 'youtube'; id: string }

/** Ce que le reste de l'écran peut demander au lecteur. */
export interface ControleLecteur {
  /** Position exacte de la vidéo, lue au moment de l'appel ; null sans vidéo. */
  tempsActuel: () => number | null
  allerA: (secondes: number) => void
  /** Ouvre une vidéo YouTube (sans effet si c'est déjà celle affichée). */
  chargerYoutube: (id: string) => void
}

interface Props {
  ref?: Ref<ControleLecteur>
  onSourceChange?: (source: SourceVideo) => void
}

type Source = { type: 'fichier'; fichier: File; url: string } | { type: 'youtube'; id: string }

/**
 * Lecteur vidéo : un fichier de l'ordinateur (lu en local, jamais envoyé) ou
 * une vidéo YouTube (lue par le lecteur officiel de YouTube, jamais téléchargée).
 * La vidéo sert seulement à regarder : tout se pilote par les boutons et le clavier.
 */
export function LecteurVideo({ ref, onSourceChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const youtubeRef = useRef<HTMLDivElement>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [erreurFichier, setErreurFichier] = useState<string | null>(null)
  const [lien, setLien] = useState('')
  const [erreurLien, setErreurLien] = useState<string | null>(null)

  // Une URL blob: par fichier : l'ancienne est libérée au changement de vidéo,
  // la dernière quand le lecteur disparaît.
  const urlCourante = useRef<string | null>(null)
  const libererFichier = useCallback(() => {
    if (urlCourante.current) URL.revokeObjectURL(urlCourante.current)
    urlCourante.current = null
  }, [])
  useEffect(() => libererFichier, [libererFichier])

  const local = useLecteur(videoRef, source?.type === 'fichier' ? source.url : null)
  const youtube = useLecteurYoutube(youtubeRef, source?.type === 'youtube' ? source.id : null)
  const estYoutube = source?.type === 'youtube'
  const lecteur = estYoutube ? youtube : local
  const { basculerLecture, deplacer, image, changerVitesse, allerA } = lecteur
  const actions = useMemo(
    () => ({ basculerLecture, deplacer, image, changerVitesse, allerA }),
    [basculerLecture, deplacer, image, changerVitesse, allerA],
  )
  useRaccourcis(actions, source !== null)

  const ouvrirYoutube = useCallback(
    (id: string) => {
      libererFichier()
      setSource({ type: 'youtube', id })
      setErreurFichier(null)
      setErreurLien(null)
      onSourceChange?.({ type: 'youtube', id })
    },
    [libererFichier, onSourceChange],
  )

  const tempsYoutube = youtube.tempsActuel
  useImperativeHandle(
    ref,
    () => ({
      // On lit la vidéo elle-même plutôt que l'état React (qui suit avec un
      // léger décalage) : l'horodatage est celui de l'image affichée.
      tempsActuel: () => {
        if (source?.type === 'fichier') return videoRef.current?.currentTime ?? null
        if (source?.type === 'youtube') return tempsYoutube()
        return null
      },
      allerA,
      chargerYoutube: (id: string) => {
        if (!(source?.type === 'youtube' && source.id === id)) ouvrirYoutube(id)
      },
    }),
    [source, tempsYoutube, allerA, ouvrirYoutube],
  )

  const choisirFichier = (e: ChangeEvent<HTMLInputElement>) => {
    const choisi = e.target.files?.[0]
    e.target.value = '' // permet de rechoisir le même fichier
    if (!choisi) return
    libererFichier()
    urlCourante.current = URL.createObjectURL(choisi)
    setSource({ type: 'fichier', fichier: choisi, url: urlCourante.current })
    setErreurFichier(null)
    setErreurLien(null)
    onSourceChange?.({ type: 'fichier', nom: choisi.name, taille: choisi.size })
  }

  const soumettreLien = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const id = extraireIdYoutube(lien)
    if (!id) {
      setErreurLien("Lien YouTube non reconnu. Collez l'adresse d'une vidéo, par exemple https://youtu.be/…")
      return
    }
    ouvrirYoutube(id)
    setLien('')
    e.currentTarget.querySelector('input')?.blur() // le clavier revient aux raccourcis
  }

  // Les boutons ne prennent pas le focus à la souris : Espace reste au lecteur.
  const sansFocus = (e: React.MouseEvent) => e.preventDefault()
  const erreur = estYoutube ? youtube.erreur : erreurFichier
  const titreImage = estYoutube
    ? "Indisponible avec YouTube : le saut se cale sur l'image clé la plus proche"
    : undefined

  return (
    // tabIndex -1 : le lecteur peut reprendre le focus après un clic dans la vidéo YouTube.
    <section className="lecteur" aria-label="Lecteur vidéo" tabIndex={-1}>
      <div className="lecteur-source">
        <label className="bouton">
          {source?.type === 'fichier' ? 'Changer de fichier' : 'Choisir un fichier vidéo'}
          <input type="file" accept="video/*" onChange={choisirFichier} hidden />
        </label>
        <span className="lecteur-ou">ou</span>
        <form className="lecteur-lien" aria-label="Vidéo YouTube" onSubmit={soumettreLien}>
          <input
            type="text"
            inputMode="url"
            aria-label="Lien YouTube"
            placeholder="Lien YouTube (youtube.com/watch?v=… ou youtu.be/…)"
            value={lien}
            onChange={(e) => {
              setLien(e.target.value)
              setErreurLien(null)
            }}
          />
          <button type="submit">Charger</button>
        </form>
        {source && (
          <span className="lecteur-nom">
            {source.type === 'fichier'
              ? `${source.fichier.name} · ${formaterTaille(source.fichier.size)}`
              : `YouTube · ${source.id}`}
          </span>
        )}
      </div>
      {erreurLien && <p role="alert">{erreurLien}</p>}

      {source?.type === 'fichier' && (
        <video
          ref={videoRef}
          src={source.url}
          preload="auto"
          playsInline
          onError={() => setErreurFichier('Ce fichier ne peut pas être lu par le navigateur. Essayez un MP4 (H.264).')}
        />
      )}
      {/* Le lecteur YouTube est affiché tel quel, sans rien par-dessus (règles de YouTube). */}
      {source?.type === 'youtube' && <div className="lecteur-youtube" ref={youtubeRef} />}
      {erreur && <p role="alert">{erreur}</p>}

      {source && (
        <>
          <input
            className="lecteur-barre"
            type="range"
            aria-label="Position dans la vidéo"
            min={0}
            max={Number.isFinite(lecteur.duree) ? lecteur.duree : 0}
            step={0.01}
            value={lecteur.temps}
            onChange={(e) => allerA(Number(e.target.value))}
          />

          <div className="lecteur-commandes">
            <button
              type="button"
              onMouseDown={sansFocus}
              onClick={() => image(-1)}
              title={titreImage ?? 'Maj + ←'}
              disabled={estYoutube}
            >
              ⏮ Image
            </button>
            <button type="button" onMouseDown={sansFocus} onClick={() => deplacer(-SAUT)} title="←">
              −{SAUT} s
            </button>
            <button
              type="button"
              className="lecteur-play"
              onMouseDown={sansFocus}
              onClick={basculerLecture}
              title="Espace"
            >
              {lecteur.enPause ? '▶ Lecture' : '⏸ Pause'}
            </button>
            <button type="button" onMouseDown={sansFocus} onClick={() => deplacer(SAUT)} title="→">
              +{SAUT} s
            </button>
            <button
              type="button"
              onMouseDown={sansFocus}
              onClick={() => image(1)}
              title={titreImage ?? 'Maj + →'}
              disabled={estYoutube}
            >
              Image ⏭
            </button>

            <span className="lecteur-temps" aria-label="Temps de la vidéo">
              <output>{formaterTemps(lecteur.temps)}</output> / {formaterTemps(lecteur.duree)}
            </span>
            <span className="lecteur-vitesse">
              <button type="button" onMouseDown={sansFocus} onClick={() => changerVitesse(-1)} title="↓">
                −
              </button>
              <output aria-label="Vitesse">{String(lecteur.vitesse).replace('.', ',')}×</output>
              <button type="button" onMouseDown={sansFocus} onClick={() => changerVitesse(1)} title="↑">
                +
              </button>
            </span>
          </div>

          <dl className="lecteur-aide">
            {RACCOURCIS.map(({ touches, action }) => (
              <div key={touches}>
                <dt>
                  <kbd>{touches}</kbd>
                </dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  )
}
