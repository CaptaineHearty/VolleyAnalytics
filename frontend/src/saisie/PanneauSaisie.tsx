import { useEffect, useEffectEvent, useState, type ReactNode, type RefObject } from 'react'
import { apiFetch } from '../api/client'
import type { Action, Equipe, Evenement, Joueur, Match } from '../api/types'
import type { ControleLecteur } from '../lecteur/LecteurVideo'
import { formaterTemps } from '../lecteur/temps'
import { enTrainDEcrire } from '../lecteur/useRaccourcis'
import { ACTIONS, GRILLE_ZONES, QUALITES, SETS, messagesErreur } from './libelles'

interface Brouillon {
  set: number
  equipe: number
  joueur: number | null
  action: Action | null
  zone: number | null
  qualite: number | null
  note: string
  /** Moment de l'action dans la vidéo, relevé au premier clic. */
  t: number | null
}

interface Props {
  match: Match
  equipeDom: Equipe
  equipeExt: Equipe
  joueurs: Joueur[]
  lecteur: RefObject<ControleLecteur | null>
  setInitial: number
  /** Événement à modifier ; null = saisie d'une nouvelle action. */
  enEdition: Evenement | null
  onEnregistre: (evenement: Evenement) => void
  onFinEdition: () => void
}

const CHAMPS_VIDES = { joueur: null, action: null, zone: null, qualite: null, note: '', t: null }

/** Sort du champ texte en cours (la note) : les lettres redeviennent des raccourcis. */
function quitterChampTexte() {
  const actif = document.activeElement
  if (actif instanceof HTMLElement && enTrainDEcrire(actif)) actif.blur()
}

// Les boutons ne prennent pas le focus à la souris (Espace et les flèches
// restent au lecteur), et un clic sur un bouton fait sortir de la note.
const sansFocus = (e: React.MouseEvent) => {
  e.preventDefault()
  quitterChampTexte()
}

function Groupe({ titre, children, className }: { titre: string; children: ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={titre} className={`groupe ${className ?? ''}`}>
      <span className="groupe-titre">{titre}</span>
      <div className="groupe-choix">{children}</div>
    </div>
  )
}

function Choix(props: { actif: boolean; onClick: () => void; children: ReactNode; title?: string; label?: string }) {
  return (
    <button
      type="button"
      className="choix"
      aria-pressed={props.actif}
      aria-label={props.label}
      title={props.title}
      onMouseDown={sansFocus}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

/**
 * La « feuille » de saisie sous le lecteur : on y note une action comme on
 * l'écrirait sur papier, et elle est horodatée sur la vidéo.
 */
export function PanneauSaisie(props: Props) {
  const { match, equipeDom, equipeExt, joueurs, lecteur, enEdition } = props
  const [brouillon, setBrouillon] = useState<Brouillon>(() =>
    enEdition
      ? {
          set: enEdition.set_num,
          equipe: enEdition.equipe,
          joueur: enEdition.joueur,
          action: enEdition.action,
          zone: enEdition.zone,
          qualite: enEdition.qualite,
          note: enEdition.note,
          t: enEdition.t_video,
        }
      : { set: props.setInitial, equipe: match.equipe_dom, ...CHAMPS_VIDES },
  )
  const [erreurs, setErreurs] = useState<string[]>([])
  const [envoi, setEnvoi] = useState(false)

  const lireTemps = () => lecteur.current?.tempsActuel() ?? null

  /** Modifie le brouillon ; le premier choix fixe le moment de l'action. */
  const modifier = (partiel: Partial<Brouillon>, horodater = true) => {
    // `partiel` passe en dernier : « Reprendre le temps actuel » peut imposer t.
    setBrouillon({ ...brouillon, t: brouillon.t ?? (horodater ? lireTemps() : null), ...partiel })
    setErreurs([])
  }
  const basculer = <K extends 'joueur' | 'action' | 'zone' | 'qualite'>(champ: K, valeur: Brouillon[K]) =>
    modifier({ [champ]: brouillon[champ] === valeur ? null : valeur } as Partial<Brouillon>)

  const effacer = () => {
    setBrouillon((b) => ({ ...b, ...CHAMPS_VIDES }))
    setErreurs([])
  }
  const annuler = () => (enEdition ? props.onFinEdition() : effacer())

  const valider = async () => {
    if (envoi) return
    if (!brouillon.action) {
      setErreurs(['Choisissez une action.'])
      return
    }
    const t = brouillon.t ?? lireTemps()
    if (t === null) {
      setErreurs(["Chargez la vidéo du match : c'est elle qui donne le moment de l'action."])
      return
    }
    const corps = {
      match: match.id,
      t_video: Math.round(t * 1000) / 1000,
      set_num: brouillon.set,
      equipe: brouillon.equipe,
      joueur: brouillon.joueur,
      action: brouillon.action,
      zone: brouillon.zone,
      qualite: brouillon.qualite,
      note: brouillon.note,
    }
    setEnvoi(true)
    try {
      const enregistre = await apiFetch<Evenement>(
        enEdition ? `/api/evenements/${enEdition.id}/` : '/api/evenements/',
        { method: enEdition ? 'PATCH' : 'POST', body: JSON.stringify(corps) },
      )
      props.onEnregistre(enregistre)
      quitterChampTexte() // après Entrée dans la note : on enchaîne au clavier
      if (enEdition) props.onFinEdition()
      else effacer()
    } catch (erreur) {
      setErreurs(messagesErreur(erreur))
    } finally {
      setEnvoi(false)
    }
  }

  // Raccourcis de la feuille : lettre = action, Entrée = valider, Échap = effacer.
  // Ils ne se déclenchent pas pendant l'écriture d'une note.
  const surTouche = useEffectEvent((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || enTrainDEcrire(e.target)) return
    const action = ACTIONS.find((a) => a.code === e.key.toUpperCase())
    if (action && e.key.length === 1) {
      basculer('action', action.code)
    } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
      void valider()
    } else if (e.key === 'Escape') {
      annuler()
    } else {
      return
    }
    e.preventDefault()
  })
  useEffect(() => {
    const ecouteur = (e: KeyboardEvent) => surTouche(e)
    window.addEventListener('keydown', ecouteur)
    return () => window.removeEventListener('keydown', ecouteur)
  }, [])

  const joueursEquipe = joueurs.filter((j) => j.equipe === brouillon.equipe).sort((a, b) => a.numero - b.numero)

  return (
    <form
      className={`feuille ${enEdition ? 'feuille-edition' : ''}`}
      aria-label={enEdition ? "Modification d'une action" : "Saisie d'une action"}
      onSubmit={(e) => {
        e.preventDefault()
        void valider()
      }}
    >
      <div className="ligne">
        <Groupe titre="Set">
          {SETS.map((s) => (
            <Choix key={s} actif={brouillon.set === s} onClick={() => modifier({ set: s }, false)}>
              {s}
            </Choix>
          ))}
        </Groupe>
        <Groupe titre="Équipe">
          {[equipeDom, equipeExt].map((eq) => (
            <Choix
              key={eq.id}
              actif={brouillon.equipe === eq.id}
              onClick={() => modifier({ equipe: eq.id, joueur: brouillon.equipe === eq.id ? brouillon.joueur : null })}
            >
              {eq.nom}
            </Choix>
          ))}
        </Groupe>
      </div>

      <Groupe titre="Joueur">
        {joueursEquipe.length === 0 ? (
          <span className="aide">
            Aucun joueur pour cette équipe (à ajouter dans <a href="/admin/scouting/joueur/">l'administration</a>).
          </span>
        ) : (
          joueursEquipe.map((j) => (
            <Choix
              key={j.id}
              actif={brouillon.joueur === j.id}
              onClick={() => basculer('joueur', j.id)}
              title={`${j.prenom} ${j.nom}`.trim()}
              label={`#${j.numero} ${j.prenom} ${j.nom}`.trim()}
            >
              {j.numero}
            </Choix>
          ))
        )}
      </Groupe>

      <Groupe titre="Action">
        {ACTIONS.map((a) => (
          <Choix key={a.code} actif={brouillon.action === a.code} onClick={() => basculer('action', a.code)} label={a.libelle}>
            <kbd>{a.code}</kbd> {a.libelle}
          </Choix>
        ))}
      </Groupe>

      <div className="ligne">
        <Groupe titre="Zone" className="zones">
          <span className="filet">filet</span>
          {GRILLE_ZONES.flat().map((z) => (
            <Choix key={z} actif={brouillon.zone === z} onClick={() => basculer('zone', z)} label={`Zone ${z}`}>
              {z}
            </Choix>
          ))}
        </Groupe>
        <Groupe titre="Qualité">
          {QUALITES.map((q) => (
            <Choix
              key={q}
              actif={brouillon.qualite === q}
              onClick={() => basculer('qualite', q)}
              title="0 = erreur … 3 = parfait"
              label={`Qualité ${q}`}
            >
              {q}
            </Choix>
          ))}
        </Groupe>
      </div>

      <label className="note">
        Note{' '}
        <input
          value={brouillon.note}
          maxLength={255}
          onChange={(e) => modifier({ note: e.target.value })}
          onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
        />
      </label>

      <div className="ligne pied">
        <span className="moment" aria-label="Moment de l'action">
          {brouillon.t === null ? 'Moment relevé au premier clic' : `Moment : ${formaterTemps(brouillon.t)}`}
        </span>
        <button type="button" onMouseDown={sansFocus} onClick={() => modifier({ t: lireTemps() })}>
          Reprendre le temps actuel
        </button>
        <span className="espace" />
        <button type="button" onMouseDown={sansFocus} onClick={annuler}>
          {enEdition ? 'Annuler la modification' : 'Effacer (Échap)'}
        </button>
        <button type="submit" className="principal" disabled={envoi} onMouseDown={sansFocus}>
          {enEdition ? 'Enregistrer la modification' : 'Valider (Entrée)'}
        </button>
      </div>

      {erreurs.map((m) => (
        <p key={m} role="alert" className="erreur">
          {m}
        </p>
      ))}
    </form>
  )
}
