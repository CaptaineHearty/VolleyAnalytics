import { useState } from 'react'
import type { Equipe, Evenement, Joueur } from '../api/types'
import { formaterTemps } from '../lecteur/temps'
import { LIBELLE_ACTION } from './libelles'

interface Props {
  evenements: Evenement[]
  equipes: Equipe[]
  joueurs: Joueur[]
  enEditionId: number | null
  onAller: (secondes: number) => void
  onModifier: (evenement: Evenement) => void
  onSupprimer: (evenement: Evenement) => Promise<void>
}

/** Les lignes de la feuille, la plus récente en haut. Un clic ramène la vidéo au moment de l'action. */
export function Journal({ evenements, equipes, joueurs, enEditionId, onAller, onModifier, onSupprimer }: Props) {
  const [aConfirmer, setAConfirmer] = useState<number | null>(null)
  const lignes = [...evenements].sort((a, b) => b.t_video - a.t_video || b.id - a.id)

  const nomEquipe = (id: number) => equipes.find((e) => e.id === id)?.nom ?? '?'
  const nomJoueur = (id: number | null) => {
    const j = joueurs.find((x) => x.id === id)
    return j ? `#${j.numero} ${j.prenom} ${j.nom}`.trim() : '—'
  }

  return (
    <section className="journal" aria-label="Journal">
      <h3>
        Journal · {evenements.length} action{evenements.length > 1 ? 's' : ''}
      </h3>
      {lignes.length === 0 ? (
        <p className="aide">Aucune action saisie pour l'instant.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Temps</th>
              <th>Set</th>
              <th>Équipe</th>
              <th>Joueur</th>
              <th>Action</th>
              <th>Zone</th>
              <th>Qualité</th>
              <th>Note</th>
              <th>
                <span className="sr-only">Gestion</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ev) => (
              <tr
                key={ev.id}
                className={ev.id === enEditionId ? 'en-edition' : undefined}
                onClick={() => onAller(ev.t_video)}
                title="Revoir ce moment"
              >
                <td className="temps">{formaterTemps(ev.t_video)}</td>
                <td>{ev.set_num}</td>
                <td>{nomEquipe(ev.equipe)}</td>
                <td>{nomJoueur(ev.joueur)}</td>
                <td>{LIBELLE_ACTION[ev.action]}</td>
                <td>{ev.zone ?? '—'}</td>
                <td>{ev.qualite ?? '—'}</td>
                <td>{ev.note}</td>
                <td className="gestion" onClick={(e) => e.stopPropagation()}>
                  {aConfirmer === ev.id ? (
                    <>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => void onSupprimer(ev).finally(() => setAConfirmer(null))}
                      >
                        Confirmer la suppression
                      </button>
                      <button type="button" onClick={() => setAConfirmer(null)}>
                        Non
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" aria-label="Modifier" title="Modifier" onClick={() => onModifier(ev)}>
                        ✎
                      </button>
                      <button type="button" aria-label="Supprimer" title="Supprimer" onClick={() => setAConfirmer(ev.id)}>
                        ✕
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
