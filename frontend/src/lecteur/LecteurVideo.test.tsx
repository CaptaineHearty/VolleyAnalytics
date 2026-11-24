import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { simulerMedia, simulerUrlsBlob } from '../test/media'
import { LecteurVideo } from './LecteurVideo'

let urls: ReturnType<typeof simulerUrlsBlob>
let media: ReturnType<typeof simulerMedia>

beforeEach(() => {
  urls = simulerUrlsBlob()
  media = simulerMedia(120)
})

function fichierVideo(nom = 'match.mp4', taille = 3 * 1024 * 1024) {
  return new File([new Uint8Array(taille)], nom, { type: 'video/mp4' })
}

function champFichier(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

function video(): HTMLVideoElement {
  return document.querySelector('video') as HTMLVideoElement
}

async function chargerVideo(nom?: string) {
  const user = userEvent.setup()
  render(<LecteurVideo />)
  await user.upload(champFichier(), fichierVideo(nom))
  return user
}

describe('choix du fichier', () => {
  it("n'affiche que le bouton de choix tant qu'aucune vidéo n'est choisie", () => {
    render(<LecteurVideo />)
    expect(screen.getByText('Choisir un fichier vidéo')).toBeInTheDocument()
    expect(video()).toBeNull()
  })

  it('lit le fichier en local via une URL blob, sans envoi', async () => {
    await chargerVideo('finale.mp4')
    expect(urls.creer).toHaveBeenCalledOnce()
    expect(video()).toHaveAttribute('src', 'blob:test/1')
    expect(screen.getByText('finale.mp4 · 3,0 Mo')).toBeInTheDocument()
    expect(screen.getByText('Changer de fichier')).toBeInTheDocument()
  })

  it("libère l'ancienne URL quand on change de vidéo", async () => {
    const user = await chargerVideo()
    await user.upload(champFichier(), fichierVideo('autre.mp4'))
    expect(urls.liberer).toHaveBeenCalledWith('blob:test/1')
    expect(video()).toHaveAttribute('src', 'blob:test/2')
  })

  it('libère la dernière URL quand le lecteur disparaît', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<LecteurVideo />)
    await user.upload(champFichier(), fichierVideo())
    unmount()
    expect(urls.liberer).toHaveBeenCalledWith('blob:test/1')
  })

  it('signale un format illisible', async () => {
    await chargerVideo('match.avi')
    fireEvent.error(video())
    expect(screen.getByRole('alert')).toHaveTextContent('Essayez un MP4 (H.264)')
  })
})

describe('raccourcis clavier', () => {
  it('Espace lance puis met en pause', async () => {
    const user = await chargerVideo()
    await user.keyboard(' ')
    expect(media.play).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '⏸ Pause' })).toBeInTheDocument()
    await user.keyboard(' ')
    expect(media.pause).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '▶ Lecture' })).toBeInTheDocument()
  })

  it('les flèches avancent et reculent de 2 s', async () => {
    const user = await chargerVideo()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(video().currentTime).toBe(4)
    await user.keyboard('{ArrowLeft}')
    expect(video().currentTime).toBe(2)
  })

  it('ne recule pas avant le début ni au-delà de la fin', async () => {
    const user = await chargerVideo()
    await user.keyboard('{ArrowLeft}')
    expect(video().currentTime).toBe(0)
    act(() => {
      video().currentTime = 119
    })
    await user.keyboard('{ArrowRight}')
    expect(video().currentTime).toBe(120)
  })

  it('Maj + flèche avance image par image, en pause', async () => {
    const user = await chargerVideo()
    await user.keyboard(' ') // lecture
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(video().paused).toBe(true)
    expect(video().currentTime).toBeCloseTo(0.04)
  })

  it('les flèches haut et bas changent la vitesse', async () => {
    const user = await chargerVideo()
    await user.keyboard('{ArrowUp}')
    expect(video().playbackRate).toBe(1.5)
    expect(screen.getByLabelText('Vitesse')).toHaveTextContent('1,5×')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(video().playbackRate).toBe(0.75)
  })

  it('ignore les touches tapées dans un champ texte', async () => {
    const user = userEvent.setup()
    render(
      <>
        <input aria-label="note" />
        <LecteurVideo />
      </>,
    )
    await user.upload(champFichier(), fichierVideo())
    await user.click(screen.getByLabelText('note'))
    await user.keyboard(' {ArrowRight}')
    expect(media.play).not.toHaveBeenCalled()
    expect(video().currentTime).toBe(0)
    expect(screen.getByLabelText('note')).toHaveValue(' ')
  })

  it('ignore les combinaisons avec Ctrl (raccourcis du navigateur)', async () => {
    const user = await chargerVideo()
    await user.keyboard('{Control>}{ArrowRight}{/Control}')
    expect(video().currentTime).toBe(0)
  })

  it('ne fait rien tant qu’aucune vidéo n’est chargée', async () => {
    const user = userEvent.setup()
    render(<LecteurVideo />)
    await user.keyboard(' {ArrowRight}')
    expect(media.play).not.toHaveBeenCalled()
  })
})

describe('commandes à la souris', () => {
  it('les boutons pilotent la vidéo', async () => {
    const user = await chargerVideo()
    await user.click(screen.getByRole('button', { name: '+2 s' }))
    expect(video().currentTime).toBe(2)
    await user.click(screen.getByRole('button', { name: '▶ Lecture' }))
    expect(media.play).toHaveBeenCalledOnce()
  })

  it('un clic sur un bouton ne lui donne pas le focus (Espace reste au lecteur)', async () => {
    await chargerVideo()
    const bouton = screen.getByRole('button', { name: '+2 s' })
    expect(fireEvent.mouseDown(bouton)).toBe(false) // défaut annulé
  })

  it('un clic sur la vidéo ne fait rien : elle sert seulement à regarder', async () => {
    const user = await chargerVideo()
    await user.click(video())
    expect(media.play).not.toHaveBeenCalled()
  })

  it('la barre de progression déplace la lecture', async () => {
    await chargerVideo()
    // La barre prend la durée de la vidéo une fois ses métadonnées chargées.
    fireEvent(video(), new Event('loadedmetadata'))
    fireEvent.change(screen.getByLabelText('Position dans la vidéo'), { target: { value: '42.5' } })
    expect(video().currentTime).toBe(42.5)
  })
})

describe('affichage du temps', () => {
  it('affiche la position et la durée au centième', async () => {
    await chargerVideo()
    act(() => {
      fireEvent(video(), new Event('loadedmetadata'))
      video().currentTime = 75.3
    })
    expect(screen.getByLabelText('Temps de la vidéo')).toHaveTextContent('1:15.30 / 2:00.00')
  })
})
