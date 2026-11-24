import { useRef, useState, type RefObject } from 'react'
import { apiFetch } from '../api/client'
import type { Equipe, Evenement, Joueur, Match, Page } from '../api/types'
import { useApi } from '../api/useApi'
import { LecteurVideo, type ControleLecteur, type SourceVideo } from '../lecteur/LecteurVideo'
import { ChoixMatch } from './ChoixMatch'
import { Journal } from './Journal'
import { messagesErreur } from './libelles'
import { PanneauSaisie } from './PanneauSaisie'
import './saisie.css'

interface PropsFeuille {
  match: Match
  equipes: Equipe[]
  lecteur: RefObject<ControleLecteur | null>
}

/** Feuille d'un match : panneau de saisie, journal et export. */
function FeuilleMatch({ match, equipes, lecteur }: PropsFeuille) {
  const joueursDom = useApi<Page<Joueur>>(`/api/joueurs/?equipe=${match.equipe_dom}`)
  const joueursExt = useApi<Page<Joueur>>(`/api/joueurs/?equipe=${match.equipe_ext}`)
  // Un match compte rarement plus de 1000 actions (maximum autorisé par l'API).
  const evenements = useApi<Page<Evenement>>(`/api/evenements/?match=${match.id}&page_size=1000`)
  const [enEdition, setEnEdition] = useState<Evenement | null>(null)
  const [erreurs, setErreurs] = useState<string[]>([])

  const equipeDom = equipes.find((e) => e.id === match.equipe_dom)
  const equipeExt = equipes.find((e) => e.id === match.equipe_ext)
  const erreur = joueursDom.erreur ?? joueursExt.erreur ?? evenements.erreur
  if (erreur) return <p role="alert">{messagesErreur(erreur).join(' ')}</p>
  if (!equipeDom || !equipeExt || !joueursDom.donnees || !joueursExt.donnees || !evenements.donnees) {
    return <p role="status">Chargement de la feuille…</p>
  }

  const liste = evenements.donnees.results
  const joueurs = [...joueursDom.donnees.results, ...joueursExt.donnees.results]
  // On reprend au set de la dernière action saisie.
  const derniere = liste.reduce<Evenement | null>((d, ev) => (!d || ev.t_video > d.t_video ? ev : d), null)

  const supprimer = async (ev: Evenement) => {
    try {
      await apiFetch(`/api/evenements/${ev.id}/`, { method: 'DELETE' })
      if (enEdition?.id === ev.id) setEnEdition(null)
      setErreurs([])
      evenements.recharger()
    } catch (e) {
      setErreurs(messagesErreur(e))
    }
  }

  return (
    <section className="feuille-match" aria-label="Feuille de match">
      <div className="ligne">
        <h2>
          {equipeDom.nom} – {equipeExt.nom}
        </h2>
        <span className="espace" />
        <a className="bouton" href={`/api/matchs/${match.id}/export/`} download>
          Exporter en CSV
        </a>
      </div>

      <PanneauSaisie
        key={enEdition?.id ?? 'nouveau'}
        match={match}
        equipeDom={equipeDom}
        equipeExt={equipeExt}
        joueurs={joueurs}
        lecteur={lecteur}
        setInitial={derniere?.set_num ?? 1}
        enEdition={enEdition}
        onEnregistre={() => evenements.recharger()}
        onFinEdition={() => setEnEdition(null)}
      />

      {erreurs.map((m) => (
        <p key={m} role="alert" className="erreur">
          {m}
        </p>
      ))}

      <Journal
        evenements={liste}
        equipes={equipes}
        joueurs={joueurs}
        enEditionId={enEdition?.id ?? null}
        onAller={(t) => lecteur.current?.allerA(t)}
        onModifier={setEnEdition}
        onSupprimer={supprimer}
      />
    </section>
  )
}

/** L'écran de travail : le lecteur en haut, la feuille du match en dessous. */
export function EcranSaisie() {
  const lecteur = useRef<ControleLecteur>(null)
  const [source, setSource] = useState<SourceVideo | null>(null)
  const [matchId, setMatchId] = useState<number | null>(null)
  const [matchCree, setMatchCree] = useState<Match | null>(null)
  const matchs = useApi<Page<Match>>('/api/matchs/')
  const equipes = useApi<Page<Equipe>>('/api/equipes/')

  const listeMatchs = matchs.donnees?.results ?? []
  const listeEquipes = equipes.donnees?.results ?? []
  // Un match tout juste créé est utilisable avant le rechargement de la liste.
  const match = listeMatchs.find((m) => m.id === matchId) ?? (matchCree?.id === matchId ? matchCree : null)

  return (
    <div className="ecran-saisie">
      <LecteurVideo ref={lecteur} onSourceChange={setSource} />
      <ChoixMatch
        matchs={listeMatchs}
        equipes={listeEquipes}
        matchChoisi={match}
        source={source}
        onChoix={(m) => {
          setMatchId(m?.id ?? null)
          // Un match YouTube rouvre sa vidéo tout seul ; un fichier local doit
          // être rechoisi par l'utilisateur (le navigateur ne peut pas le rouvrir).
          if (m?.video_youtube) lecteur.current?.chargerYoutube(m.video_youtube)
        }}
        onCree={(m) => {
          setMatchCree(m)
          setMatchId(m.id)
          matchs.recharger()
        }}
      />
      {match && <FeuilleMatch key={match.id} match={match} equipes={listeEquipes} lecteur={lecteur} />}
    </div>
  )
}
