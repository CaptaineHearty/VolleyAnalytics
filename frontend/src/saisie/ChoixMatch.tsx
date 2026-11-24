import { useState, type FormEvent } from 'react'
import { apiFetch } from '../api/client'
import type { Equipe, Match } from '../api/types'
import type { SourceVideo } from '../lecteur/LecteurVideo'
import { formaterTaille } from '../lecteur/temps'
import { messagesErreur, nomMatch } from './libelles'

interface Props {
  matchs: Match[]
  equipes: Equipe[]
  matchChoisi: Match | null
  /** La vidéo actuellement affichée dans le lecteur. */
  source: SourceVideo | null
  onChoix: (match: Match | null) => void
  onCree: (match: Match) => void
}

function decrireSource(source: SourceVideo): string {
  return source.type === 'youtube' ? `YouTube ${source.id}` : `${source.nom}, ${formaterTaille(source.taille)}`
}

function sourceDuMatch(match: Match): SourceVideo {
  return match.video_youtube
    ? { type: 'youtube', id: match.video_youtube }
    : { type: 'fichier', nom: match.video_nom, taille: match.video_taille ?? 0 }
}

function memeSource(a: SourceVideo, b: SourceVideo): boolean {
  if (a.type === 'youtube') return b.type === 'youtube' && a.id === b.id
  return b.type === 'fichier' && a.nom === b.nom && a.taille === b.taille
}

function aujourdhui(): string {
  const d = new Date()
  const deux = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
}

export function ChoixMatch({ matchs, equipes, matchChoisi, source, onChoix, onCree }: Props) {
  const [creation, setCreation] = useState(false)
  const [dom, setDom] = useState('')
  const [ext, setExt] = useState('')
  const [date, setDate] = useState(aujourdhui)
  const [competition, setCompetition] = useState('')
  const [erreurs, setErreurs] = useState<string[]>([])

  const creer = async (e: FormEvent) => {
    e.preventDefault()
    if (!source) return
    const video =
      source.type === 'youtube'
        ? { video_nom: '', video_taille: null, video_youtube: source.id }
        : { video_nom: source.nom, video_taille: source.taille, video_youtube: '' }
    try {
      const match = await apiFetch<Match>('/api/matchs/', {
        method: 'POST',
        body: JSON.stringify({
          equipe_dom: Number(dom),
          equipe_ext: Number(ext),
          date,
          competition,
          ...video,
        }),
      })
      setErreurs([])
      setCreation(false)
      onCree(match)
    } catch (erreur) {
      setErreurs(messagesErreur(erreur))
    }
  }

  const attendue = matchChoisi ? sourceDuMatch(matchChoisi) : null
  const videoDifferente = attendue && source && !memeSource(source, attendue)

  return (
    <section className="choix-match" aria-label="Choix du match">
      <div className="ligne">
        <label>
          Match{' '}
          <select
            value={matchChoisi?.id ?? ''}
            onChange={(e) => {
              onChoix(matchs.find((m) => m.id === Number(e.target.value)) ?? null)
              // Sans ça, la liste garde le focus : une lettre ou une flèche
              // destinée à la saisie changerait de match.
              e.target.blur()
            }}
          >
            <option value="">— Choisir un match —</option>
            {matchs.map((m) => (
              <option key={m.id} value={m.id}>
                {nomMatch(m, equipes)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setCreation((c) => !c)} aria-expanded={creation}>
          {creation ? 'Fermer' : 'Nouveau match'}
        </button>
      </div>

      {videoDifferente && (
        <p role="alert" className="avertissement">
          La vidéo affichée ({decrireSource(source)}) n'est pas celle enregistrée pour ce match (
          {decrireSource(attendue)}). Les temps saisis ne correspondraient pas.
        </p>
      )}
      {attendue?.type === 'fichier' && !source && (
        <p className="aide">
          Choisissez le fichier « {attendue.nom} » ({formaterTaille(attendue.taille)}) : c'est la vidéo de ce match.
        </p>
      )}

      {creation && (
        <form className="creation-match" onSubmit={creer} aria-label="Nouveau match">
          {equipes.length < 2 ? (
            <p>
              Il faut au moins deux équipes. Créez les équipes et leurs joueurs dans{' '}
              <a href="/admin/scouting/equipe/">l'administration</a>.
            </p>
          ) : (
            <>
              <label>
                Domicile{' '}
                <select value={dom} onChange={(e) => setDom(e.target.value)} required>
                  <option value="">—</option>
                  {equipes.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nom}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Extérieur{' '}
                <select value={ext} onChange={(e) => setExt(e.target.value)} required>
                  <option value="">—</option>
                  {equipes.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nom}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label>
                Compétition <input value={competition} onChange={(e) => setCompetition(e.target.value)} />
              </label>
              {source ? (
                <p className="aide">Vidéo associée : {decrireSource(source)}</p>
              ) : (
                <p className="aide">
                  Choisissez d'abord la vidéo du match (fichier ou lien YouTube) : elle sera associée au match.
                </p>
              )}
              <button type="submit" disabled={!source}>
                Créer le match
              </button>
            </>
          )}
          {erreurs.map((m) => (
            <p key={m} role="alert">
              {m}
            </p>
          ))}
        </form>
      )}
    </section>
  )
}
