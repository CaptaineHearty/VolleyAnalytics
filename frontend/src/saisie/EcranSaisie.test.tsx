import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Evenement } from '../api/types'
import { creerApiFactice, type BaseFactice } from '../test/apiFactice'
import { simulerMedia, simulerUrlsBlob } from '../test/media'
import { retirerYoutube, simulerYoutube } from '../test/youtubeFactice'
import { EcranSaisie } from './EcranSaisie'

const TAILLE = 3 * 1024 * 1024

function base(evenements: Evenement[] = []): BaseFactice {
  return {
    equipes: [
      { id: 1, nom: 'Évry', club: '' },
      { id: 2, nom: 'Ivry', club: '' },
    ],
    joueurs: [
      { id: 10, equipe: 1, nom: 'Martin', prenom: 'Éloïse', numero: 10, poste: '' },
      { id: 11, equipe: 1, nom: 'Petit', prenom: 'Léa', numero: 4, poste: '' },
      { id: 20, equipe: 2, nom: 'Durand', prenom: 'Zoé', numero: 7, poste: '' },
    ],
    matchs: [
      {
        id: 5,
        equipe_dom: 1,
        equipe_ext: 2,
        date: '2026-11-23',
        competition: '',
        video_nom: 'match.mp4',
        video_taille: TAILLE,
        video_youtube: '',
        cree_par: 'scout',
        cree_le: '2026-11-23T10:00:00Z',
      },
    ],
    evenements,
  }
}

function evenement(partiel: Partial<Evenement>): Evenement {
  return {
    id: 1,
    match: 5,
    t_video: 33.5,
    set_num: 1,
    equipe: 1,
    joueur: 10,
    action: 'A',
    zone: 4,
    qualite: 3,
    note: '',
    saisi_par: 'scout',
    cree_le: '2026-11-23T10:00:00Z',
    ...partiel,
  }
}

const video = () => document.querySelector('video') as HTMLVideoElement
const groupe = (nom: string) => within(screen.getByRole('group', { name: nom }))
const lignesJournal = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const regler = (secondes: number) =>
  act(() => {
    video().currentTime = secondes
  })

async function chargerVideo(user: ReturnType<typeof userEvent.setup>, nom = 'match.mp4') {
  const champ = document.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(champ, new File([new Uint8Array(TAILLE)], nom, { type: 'video/mp4' }))
}

async function ouvrirFeuille(options: { evenements?: Evenement[]; video?: boolean } = {}) {
  const api = creerApiFactice(base(options.evenements))
  const user = userEvent.setup()
  render(<EcranSaisie />)
  if (options.video ?? true) await chargerVideo(user)
  await screen.findByRole('option', { name: /Évry – Ivry/ })
  await user.selectOptions(screen.getByLabelText('Match'), '5')
  await screen.findByRole('form', { name: "Saisie d'une action" })
  return { api, user }
}

beforeEach(() => {
  simulerUrlsBlob()
  simulerMedia(600)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('feuille du match', () => {
  it("affiche les équipes et l'effectif de l'équipe choisie", async () => {
    await ouvrirFeuille()
    expect(screen.getByRole('heading', { name: 'Évry – Ivry' })).toBeInTheDocument()
    expect(groupe('Joueur').getByRole('button', { name: '#10 Éloïse Martin' })).toBeInTheDocument()
    expect(groupe('Joueur').getByRole('button', { name: '#4 Léa Petit' })).toBeInTheDocument()
    expect(groupe('Joueur').queryByRole('button', { name: /Durand/ })).toBeNull()
  })

  it("trie l'effectif par numéro", async () => {
    await ouvrirFeuille()
    const numeros = groupe('Joueur').getAllByRole('button').map((b) => b.textContent)
    expect(numeros).toEqual(['4', '10'])
  })

  it("changer d'équipe montre l'effectif adverse et retire le joueur choisi", async () => {
    const { user } = await ouvrirFeuille()
    await user.click(groupe('Joueur').getByRole('button', { name: '#10 Éloïse Martin' }))
    await user.click(groupe('Équipe').getByRole('button', { name: 'Ivry' }))
    expect(groupe('Joueur').getByRole('button', { name: '#7 Zoé Durand' })).toHaveAttribute('aria-pressed', 'false')
    expect(groupe('Joueur').queryByRole('button', { name: /Martin/ })).toBeNull()
  })

  it('propose un lien CSV pour exporter le match', async () => {
    await ouvrirFeuille()
    expect(screen.getByRole('link', { name: 'Exporter en CSV' })).toHaveAttribute('href', '/api/matchs/5/export/')
  })

  it('reprend au set de la dernière action saisie', async () => {
    await ouvrirFeuille({ evenements: [evenement({ id: 1, t_video: 10, set_num: 2 }), evenement({ id: 2, t_video: 50, set_num: 3 })] })
    expect(groupe('Set').getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('saisie à la souris', () => {
  it("horodate l'action au premier clic, pas à la validation", async () => {
    const { api, user } = await ouvrirFeuille()
    regler(12.48)
    await user.click(groupe('Joueur').getByRole('button', { name: '#10 Éloïse Martin' }))
    expect(screen.getByLabelText("Moment de l'action")).toHaveTextContent('Moment : 0:12.48')
    regler(15) // la vidéo continue pendant qu'on remplit
    await user.click(groupe('Action').getByRole('button', { name: 'Attaque' }))
    await user.click(groupe('Zone').getByRole('button', { name: 'Zone 4' }))
    await user.click(groupe('Qualité').getByRole('button', { name: 'Qualité 3' }))
    await user.type(screen.getByLabelText('Note'), 'diagonale')
    await user.click(screen.getByRole('button', { name: 'Valider (Entrée)' }))

    const [post] = api.appels('POST', '/api/evenements/')
    expect(post.corps).toEqual({
      match: 5,
      t_video: 12.48,
      set_num: 1,
      equipe: 1,
      joueur: 10,
      action: 'A',
      zone: 4,
      qualite: 3,
      note: 'diagonale',
    })
    const ligne = await screen.findByRole('row', { name: /0:12.48/ })
    expect(ligne).toHaveTextContent('#10 Éloïse Martin')
    expect(ligne).toHaveTextContent('Attaque')
    expect(ligne).toHaveTextContent('diagonale')
  })

  it('remet la feuille à blanc après validation, en gardant le set et l’équipe', async () => {
    const { user } = await ouvrirFeuille()
    await user.click(groupe('Set').getByRole('button', { name: '2' }))
    await user.click(groupe('Équipe').getByRole('button', { name: 'Ivry' }))
    await user.click(groupe('Action').getByRole('button', { name: 'Réception' }))
    await user.click(screen.getByRole('button', { name: 'Valider (Entrée)' }))
    await screen.findByRole('row', { name: /Réception/ })
    expect(groupe('Action').getByRole('button', { name: 'Réception' })).toHaveAttribute('aria-pressed', 'false')
    expect(groupe('Set').getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true')
    expect(groupe('Équipe').getByRole('button', { name: 'Ivry' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText("Moment de l'action")).toHaveTextContent('Moment relevé au premier clic')
  })

  it('un second clic sur un choix le retire', async () => {
    const { user } = await ouvrirFeuille()
    const zone = groupe('Zone').getByRole('button', { name: 'Zone 2' })
    await user.click(zone)
    expect(zone).toHaveAttribute('aria-pressed', 'true')
    await user.click(zone)
    expect(zone).toHaveAttribute('aria-pressed', 'false')
  })

  it('« Reprendre le temps actuel » corrige le moment relevé', async () => {
    const { user } = await ouvrirFeuille()
    regler(5)
    await user.click(groupe('Action').getByRole('button', { name: 'Service' }))
    regler(7.2)
    await user.click(screen.getByRole('button', { name: 'Reprendre le temps actuel' }))
    expect(screen.getByLabelText("Moment de l'action")).toHaveTextContent('Moment : 0:07.20')
  })

  it("refuse de valider sans action", async () => {
    const { api, user } = await ouvrirFeuille()
    await user.click(groupe('Zone').getByRole('button', { name: 'Zone 1' }))
    await user.click(screen.getByRole('button', { name: 'Valider (Entrée)' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choisissez une action.')
    expect(api.appels('POST', '/api/evenements/')).toHaveLength(0)
  })

  it('demande la vidéo si elle n’est pas chargée', async () => {
    const { api, user } = await ouvrirFeuille({ video: false })
    await user.click(groupe('Action').getByRole('button', { name: 'Bloc' }))
    await user.click(screen.getByRole('button', { name: 'Valider (Entrée)' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Chargez la vidéo du match')
    expect(api.appels('POST', '/api/evenements/')).toHaveLength(0)
  })

  it("affiche les erreurs renvoyées par l'API", async () => {
    const api = creerApiFactice(base(), (a) =>
      a.methode === 'POST' && a.chemin === '/api/evenements/'
        ? { status: 400, corps: { zone: ['Assurez-vous que cette valeur est inférieure ou égale à 6.'] } }
        : undefined,
    )
    const user = userEvent.setup()
    render(<EcranSaisie />)
    await chargerVideo(user)
    await user.selectOptions(await screen.findByLabelText('Match'), '5')
    await screen.findByRole('form', { name: "Saisie d'une action" })
    await user.click(groupe('Action').getByRole('button', { name: 'Attaque' }))
    await user.click(screen.getByRole('button', { name: 'Valider (Entrée)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('zone : Assurez-vous')
    expect(api.base.evenements).toHaveLength(0)
  })
})

describe('saisie au clavier', () => {
  it('lettre = action, Entrée = valider', async () => {
    const { api, user } = await ouvrirFeuille()
    regler(3)
    await user.keyboard('r')
    expect(groupe('Action').getByRole('button', { name: 'Réception' })).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard('{Enter}')
    expect(api.appels('POST', '/api/evenements/')[0].corps).toMatchObject({ action: 'R', t_video: 3 })
  })

  it('Échap efface la saisie en cours', async () => {
    const { user } = await ouvrirFeuille()
    await user.keyboard('d')
    await user.keyboard('{Escape}')
    expect(groupe('Action').getByRole('button', { name: 'Défense' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('les lettres tapées dans la note restent du texte', async () => {
    const { user } = await ouvrirFeuille()
    await user.type(screen.getByLabelText('Note'), 'bras')
    expect(screen.getByLabelText('Note')).toHaveValue('bras')
    for (const libelle of ['Bloc', 'Réception', 'Attaque']) {
      expect(groupe('Action').getByRole('button', { name: libelle })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('Entrée dans la note valide aussi', async () => {
    const { api, user } = await ouvrirFeuille()
    await user.keyboard('s')
    await user.type(screen.getByLabelText('Note'), 'ace{Enter}')
    expect(api.appels('POST', '/api/evenements/')[0].corps).toMatchObject({ action: 'S', note: 'ace' })
  })

  it('après une note validée au clic, la lettre suivante choisit une action', async () => {
    const { api, user } = await ouvrirFeuille()
    await user.keyboard('a')
    await user.type(screen.getByLabelText('Note'), 'feinte')
    await user.click(screen.getByRole('button', { name: 'Valider (Entrée)' }))
    await screen.findByRole('row', { name: /feinte/ })
    await user.keyboard('d{Enter}')
    expect(screen.getByLabelText('Note')).toHaveValue('')
    expect(api.appels('POST', '/api/evenements/')[1].corps).toMatchObject({ action: 'D', note: '' })
  })

  it('après Entrée dans la note, on enchaîne au clavier', async () => {
    const { api, user } = await ouvrirFeuille()
    await user.keyboard('s')
    await user.type(screen.getByLabelText('Note'), 'ace{Enter}')
    await screen.findByRole('row', { name: /ace/ })
    await user.keyboard('r{Enter}')
    expect(api.appels('POST', '/api/evenements/')[1].corps).toMatchObject({ action: 'R' })
  })

  it('cliquer un choix pendant l’écriture d’une note fait sortir de la note', async () => {
    const { user } = await ouvrirFeuille()
    await user.type(screen.getByLabelText('Note'), 'x')
    await user.click(groupe('Zone').getByRole('button', { name: 'Zone 3' }))
    await user.keyboard('b')
    expect(screen.getByLabelText('Note')).toHaveValue('x')
    expect(groupe('Action').getByRole('button', { name: 'Bloc' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('Échap dans la note en sort, un second Échap efface la saisie', async () => {
    const { user } = await ouvrirFeuille()
    await user.keyboard('p')
    await user.type(screen.getByLabelText('Note'), 'courte')
    await user.keyboard('{Escape}')
    expect(screen.getByLabelText('Note')).not.toHaveFocus()
    expect(groupe('Action').getByRole('button', { name: 'Passe' })).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard('{Escape}')
    expect(groupe('Action').getByRole('button', { name: 'Passe' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('Espace et les flèches restent au lecteur après un clic sur la feuille', async () => {
    const { user } = await ouvrirFeuille()
    await user.click(groupe('Action').getByRole('button', { name: 'Passe' }))
    await user.keyboard('{ArrowRight}')
    expect(video().currentTime).toBe(2)
  })
})

describe('journal', () => {
  it('liste les actions, la plus récente en haut', async () => {
    await ouvrirFeuille({ evenements: [evenement({ id: 1, t_video: 10 }), evenement({ id: 2, t_video: 50, action: 'S' })] })
    const lignes = lignesJournal()
    expect(lignes[0]).toHaveTextContent('0:50.00')
    expect(lignes[1]).toHaveTextContent('0:10.00')
    expect(screen.getByRole('heading', { name: 'Journal · 2 actions' })).toBeInTheDocument()
  })

  it("un clic sur une ligne ramène la vidéo au moment de l'action", async () => {
    const { user } = await ouvrirFeuille({ evenements: [evenement({ t_video: 33.5 })] })
    await user.click(lignesJournal()[0])
    expect(video().currentTime).toBe(33.5)
  })

  it('modifie une action sans changer son moment', async () => {
    const { api, user } = await ouvrirFeuille({ evenements: [evenement({ id: 7, t_video: 33.5, qualite: 3 })] })
    regler(100)
    await user.click(within(lignesJournal()[0]).getByRole('button', { name: 'Modifier' }))
    const formulaire = await screen.findByRole('form', { name: "Modification d'une action" })
    expect(within(formulaire).getByRole('button', { name: 'Attaque' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(groupe('Qualité').getByRole('button', { name: 'Qualité 1' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer la modification' }))

    const [patch] = api.appels('PATCH', '/api/evenements/7/')
    expect(patch.corps).toMatchObject({ qualite: 1, t_video: 33.5 })
    expect(await screen.findByRole('form', { name: "Saisie d'une action" })).toBeInTheDocument()
  })

  it('annuler une modification revient à la saisie sans rien envoyer', async () => {
    const { api, user } = await ouvrirFeuille({ evenements: [evenement({ id: 7 })] })
    await user.click(within(lignesJournal()[0]).getByRole('button', { name: 'Modifier' }))
    await user.keyboard('{Escape}')
    expect(await screen.findByRole('form', { name: "Saisie d'une action" })).toBeInTheDocument()
    expect(api.appels('PATCH')).toHaveLength(0)
  })

  it('supprime une action après confirmation', async () => {
    const { api, user } = await ouvrirFeuille({ evenements: [evenement({ id: 7 })] })
    await user.click(within(lignesJournal()[0]).getByRole('button', { name: 'Supprimer' }))
    expect(api.appels('DELETE')).toHaveLength(0) // rien avant confirmation
    await user.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))
    expect(api.appels('DELETE', '/api/evenements/7/')).toHaveLength(1)
    expect(await screen.findByText("Aucune action saisie pour l'instant.")).toBeInTheDocument()
  })

  it('« Non » annule la suppression', async () => {
    const { api, user } = await ouvrirFeuille({ evenements: [evenement({ id: 7 })] })
    await user.click(within(lignesJournal()[0]).getByRole('button', { name: 'Supprimer' }))
    await user.click(screen.getByRole('button', { name: 'Non' }))
    expect(api.appels('DELETE')).toHaveLength(0)
    expect(lignesJournal()).toHaveLength(1)
  })
})

describe('choix et création du match', () => {
  it('crée un match associé à la vidéo chargée', async () => {
    const api = creerApiFactice(base())
    const user = userEvent.setup()
    render(<EcranSaisie />)
    await chargerVideo(user, 'finale.mp4')
    await user.click(await screen.findByRole('button', { name: 'Nouveau match' }))
    const formulaire = screen.getByRole('form', { name: 'Nouveau match' })
    await user.selectOptions(within(formulaire).getByLabelText('Domicile'), '2')
    await user.selectOptions(within(formulaire).getByLabelText('Extérieur'), '1')
    await user.clear(within(formulaire).getByLabelText('Date'))
    await user.type(within(formulaire).getByLabelText('Date'), '2026-12-01')
    await user.click(within(formulaire).getByRole('button', { name: 'Créer le match' }))

    expect(api.appels('POST', '/api/matchs/')[0].corps).toMatchObject({
      equipe_dom: 2,
      equipe_ext: 1,
      date: '2026-12-01',
      video_nom: 'finale.mp4',
      video_taille: TAILLE,
    })
    expect(await screen.findByRole('heading', { name: 'Ivry – Évry' })).toBeInTheDocument()
  })

  it('demande la vidéo avant de créer un match', async () => {
    creerApiFactice(base())
    const user = userEvent.setup()
    render(<EcranSaisie />)
    await user.click(await screen.findByRole('button', { name: 'Nouveau match' }))
    expect(screen.getByRole('button', { name: 'Créer le match' })).toBeDisabled()
  })

  it("prévient si la vidéo chargée n'est pas celle du match", async () => {
    const api = creerApiFactice(base())
    const user = userEvent.setup()
    render(<EcranSaisie />)
    await chargerVideo(user, 'autre.mp4')
    await user.selectOptions(await screen.findByLabelText('Match'), '5')
    expect(await screen.findByRole('alert')).toHaveTextContent("n'est pas celle enregistrée pour ce match")
    expect(api.base.matchs).toHaveLength(1)
  })

  it("renvoie vers l'administration s'il manque des équipes", async () => {
    creerApiFactice({ ...base(), equipes: [{ id: 1, nom: 'Seule', club: '' }] })
    const user = userEvent.setup()
    render(<EcranSaisie />)
    await user.click(await screen.findByRole('button', { name: 'Nouveau match' }))
    expect(screen.getByRole('link', { name: "l'administration" })).toHaveAttribute('href', '/admin/scouting/equipe/')
  })
})

describe('match sur une vidéo YouTube', () => {
  const ID = 'dQw4w9WgXcQ'
  let yt: ReturnType<typeof simulerYoutube>

  beforeEach(() => {
    yt = simulerYoutube()
  })
  afterEach(() => {
    retirerYoutube()
  })

  function baseAvecYoutube(): BaseFactice {
    const b = base()
    b.matchs.push({
      ...b.matchs[0],
      id: 6,
      date: '2026-11-24',
      video_nom: '',
      video_taille: null,
      video_youtube: ID,
    })
    return b
  }

  it('crée un match lié à la vidéo YouTube affichée', async () => {
    const api = creerApiFactice(base())
    const user = userEvent.setup()
    render(<EcranSaisie />)
    await user.type(screen.getByLabelText('Lien YouTube'), `https://youtu.be/${ID}{Enter}`)
    await user.click(await screen.findByRole('button', { name: 'Nouveau match' }))
    const formulaire = screen.getByRole('form', { name: 'Nouveau match' })
    expect(within(formulaire).getByText(`Vidéo associée : YouTube ${ID}`)).toBeInTheDocument()
    await user.selectOptions(within(formulaire).getByLabelText('Domicile'), '1')
    await user.selectOptions(within(formulaire).getByLabelText('Extérieur'), '2')
    await user.click(within(formulaire).getByRole('button', { name: 'Créer le match' }))
    expect(api.appels('POST', '/api/matchs/')[0].corps).toMatchObject({
      video_youtube: ID,
      video_nom: '',
      video_taille: null,
    })
  })

  it('choisir un match YouTube ouvre sa vidéo tout seul', async () => {
    creerApiFactice(baseAvecYoutube())
    const user = userEvent.setup()
    render(<EcranSaisie />)
    await user.selectOptions(await screen.findByLabelText('Match'), '6')
    await waitFor(() => expect(yt.instances()).toHaveLength(1))
    expect(yt.dernier().options.videoId).toBe(ID)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it("horodate les actions avec le temps de la vidéo YouTube", async () => {
    const api = creerApiFactice(baseAvecYoutube())
    const user = userEvent.setup()
    render(<EcranSaisie />)
    await user.selectOptions(await screen.findByLabelText('Match'), '6')
    await waitFor(() => expect(yt.instances()).toHaveLength(1))
    act(() => yt.dernier().pret())
    await screen.findByRole('form', { name: "Saisie d'une action" })
    yt.dernier().temps = 42.37
    await user.keyboard('a{Enter}')
    await waitFor(() => expect(api.appels('POST', '/api/evenements/')).toHaveLength(1))
    expect(api.appels('POST', '/api/evenements/')[0].corps).toMatchObject({ action: 'A', match: 6, t_video: 42.37 })
  })

  it('un clic sur le journal ramène la vidéo YouTube au bon moment', async () => {
    const b = baseAvecYoutube()
    b.evenements.push(evenement({ id: 9, match: 6, t_video: 81.5 }))
    creerApiFactice(b)
    const user = userEvent.setup()
    render(<EcranSaisie />)
    await user.selectOptions(await screen.findByLabelText('Match'), '6')
    await waitFor(() => expect(yt.instances()).toHaveLength(1))
    act(() => yt.dernier().pret())
    await user.click((await screen.findAllByRole('row'))[1])
    expect(yt.dernier().seekTo).toHaveBeenLastCalledWith(81.5, true)
  })

  it('prévient si la vidéo affichée est un fichier alors que le match est sur YouTube', async () => {
    creerApiFactice(baseAvecYoutube())
    const user = userEvent.setup()
    render(<EcranSaisie />)
    await user.selectOptions(await screen.findByLabelText('Match'), '6')
    await chargerVideo(user)
    expect(await screen.findByRole('alert')).toHaveTextContent(`n'est pas celle enregistrée pour ce match (YouTube ${ID})`)
  })

  it('rappelle quel fichier choisir pour un match lié à un fichier', async () => {
    creerApiFactice(base())
    const user = userEvent.setup()
    render(<EcranSaisie />)
    await user.selectOptions(await screen.findByLabelText('Match'), '5')
    expect(screen.getByText(/Choisissez le fichier « match.mp4 »/)).toBeInTheDocument()
  })
})
