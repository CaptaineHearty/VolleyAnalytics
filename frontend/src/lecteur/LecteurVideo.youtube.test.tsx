import { act, createRef } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { simulerMedia, simulerUrlsBlob } from '../test/media'
import { retirerYoutube, simulerYoutube } from '../test/youtubeFactice'
import { LecteurVideo, type ControleLecteur, type SourceVideo } from './LecteurVideo'

const ID = 'dQw4w9WgXcQ'
let yt: ReturnType<typeof simulerYoutube>

beforeEach(() => {
  simulerUrlsBlob()
  simulerMedia()
  yt = simulerYoutube()
})

afterEach(() => {
  retirerYoutube()
})

async function chargerLien(lien = `https://youtu.be/${ID}`, props: Parameters<typeof LecteurVideo>[0] = {}) {
  const user = userEvent.setup()
  render(<LecteurVideo {...props} />)
  await user.type(screen.getByLabelText('Lien YouTube'), lien)
  await user.click(screen.getByRole('button', { name: 'Charger' }))
  await waitFor(() => expect(yt.instances()).toHaveLength(1))
  return user
}

async function chargerEtPreparer() {
  const user = await chargerLien()
  act(() => yt.dernier().pret())
  return user
}

describe('ouverture d’un lien YouTube', () => {
  it('ouvre le lecteur YouTube officiel avec la bonne vidéo', async () => {
    const onSourceChange = vi.fn<(s: SourceVideo) => void>()
    await chargerLien(`https://www.youtube.com/watch?v=${ID}&t=42s`, { onSourceChange })
    const lecteur = yt.dernier()
    expect(lecteur.options.videoId).toBe(ID)
    expect(lecteur.options.playerVars).toMatchObject({ disablekb: 1, playsinline: 1, origin: window.location.origin })
    expect(screen.getByText(`YouTube · ${ID}`)).toBeInTheDocument()
    expect(screen.getByTitle('Lecteur YouTube')).toBeInTheDocument()
    expect(onSourceChange).toHaveBeenCalledWith({ type: 'youtube', id: ID })
  })

  it('refuse un lien qui n’est pas une vidéo YouTube', async () => {
    const user = userEvent.setup()
    render(<LecteurVideo />)
    await user.type(screen.getByLabelText('Lien YouTube'), 'https://vimeo.com/123{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Lien YouTube non reconnu')
    expect(yt.instances()).toHaveLength(0)
  })

  it('vide le champ et lui retire le focus : le clavier revient aux raccourcis', async () => {
    await chargerLien()
    expect(screen.getByLabelText('Lien YouTube')).toHaveValue('')
    expect(screen.getByLabelText('Lien YouTube')).not.toHaveFocus()
  })

  it("affiche un message clair si la vidéo ne peut pas être intégrée", async () => {
    await chargerLien()
    act(() => yt.dernier().erreur(150))
    expect(screen.getByRole('alert')).toHaveTextContent("n'autorise pas sa lecture sur d'autres sites")
  })

  it('passer à un fichier ferme le lecteur YouTube', async () => {
    const user = await chargerLien()
    const lecteur = yt.dernier()
    const champ = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(champ, new File([new Uint8Array(10)], 'match.mp4', { type: 'video/mp4' }))
    expect(lecteur.detruit).toBe(true)
    expect(document.querySelector('video')).not.toBeNull()
  })

  it('passer à une autre vidéo YouTube remplace le lecteur', async () => {
    const user = await chargerLien()
    const premier = yt.dernier()
    await user.type(screen.getByLabelText('Lien YouTube'), 'https://youtu.be/aqz-KE-bpKQ{Enter}')
    await waitFor(() => expect(yt.instances()).toHaveLength(2))
    expect(premier.detruit).toBe(true)
    expect(yt.dernier().options.videoId).toBe('aqz-KE-bpKQ')
  })
})

describe('commandes avec YouTube (mêmes raccourcis qu’un fichier)', () => {
  it('Espace lance et met en pause', async () => {
    const user = await chargerEtPreparer()
    await user.keyboard(' ')
    expect(yt.dernier().etat).toBe(1)
    expect(screen.getByRole('button', { name: '⏸ Pause' })).toBeInTheDocument()
    await user.keyboard(' ')
    expect(yt.dernier().etat).toBe(2)
  })

  it('les flèches avancent et reculent de 2 s', async () => {
    const user = await chargerEtPreparer()
    yt.dernier().temps = 10
    await user.keyboard('{ArrowRight}')
    expect(yt.dernier().seekTo).toHaveBeenLastCalledWith(12, true)
    await user.keyboard('{ArrowLeft}')
    expect(yt.dernier().seekTo).toHaveBeenLastCalledWith(10, true)
  })

  it('ne dépasse pas le début ni la fin', async () => {
    const user = await chargerEtPreparer()
    yt.dernier().temps = 1
    await user.keyboard('{ArrowLeft}')
    expect(yt.dernier().seekTo).toHaveBeenLastCalledWith(0, true)
    yt.dernier().temps = 299
    await user.keyboard('{ArrowRight}')
    expect(yt.dernier().seekTo).toHaveBeenLastCalledWith(300, true)
  })

  it('la vitesse suit les vitesses proposées par YouTube', async () => {
    const user = await chargerEtPreparer()
    yt.dernier().vitesses = [0.5, 1, 2]
    await user.keyboard('{ArrowUp}')
    expect(yt.dernier().vitesse).toBe(2)
    expect(screen.getByLabelText('Vitesse')).toHaveTextContent('2×')
  })

  it("l'avance image par image est désactivée (le saut YouTube se cale sur les images clés)", async () => {
    const user = await chargerEtPreparer()
    expect(screen.getByRole('button', { name: '⏮ Image' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Image ⏭' })).toBeDisabled()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(yt.dernier().seekTo).not.toHaveBeenCalled()
  })

  it('les commandes sont sans effet tant que YouTube n’est pas prêt', async () => {
    const user = await chargerLien()
    await user.keyboard(' {ArrowRight}')
    expect(yt.dernier().etat).toBe(5)
    expect(yt.dernier().seekTo).not.toHaveBeenCalled()
  })
})

describe('temps et horodatage', () => {
  it('relève le temps de YouTube régulièrement', async () => {
    await chargerLien()
    vi.useFakeTimers()
    try {
      act(() => yt.dernier().pret()) // le relevé périodique démarre à onReady
      yt.dernier().temps = 75.3
      act(() => vi.advanceTimersByTime(150))
      expect(screen.getByLabelText('Temps de la vidéo')).toHaveTextContent('1:15.30 / 5:00.00')
    } finally {
      vi.useRealTimers()
    }
  })

  it("donne à la feuille le temps exact de YouTube au moment de l'appel", async () => {
    const ref = createRef<ControleLecteur>()
    await chargerLien(undefined, { ref })
    act(() => yt.dernier().pret())
    yt.dernier().temps = 42.37
    expect(ref.current?.tempsActuel()).toBe(42.37)
  })

  it('chargerYoutube ouvre une vidéo, et ne recharge pas celle déjà affichée', async () => {
    const ref = createRef<ControleLecteur>()
    render(<LecteurVideo ref={ref} />)
    act(() => ref.current?.chargerYoutube(ID))
    await waitFor(() => expect(yt.instances()).toHaveLength(1))
    act(() => ref.current?.chargerYoutube(ID))
    await new Promise((r) => setTimeout(r, 20))
    expect(yt.instances()).toHaveLength(1)
  })
})

describe('clavier après un clic dans la vidéo YouTube', () => {
  it('rend le focus à la page pour garder les raccourcis', async () => {
    await chargerEtPreparer()
    const iframe = screen.getByTitle('Lecteur YouTube') as HTMLIFrameElement
    iframe.tabIndex = 0
    iframe.focus()
    expect(document.activeElement).toBe(iframe)
    window.dispatchEvent(new Event('blur'))
    await waitFor(() => expect(screen.getByRole('region', { name: 'Lecteur vidéo' })).toHaveFocus())
  })
})

describe('API YouTube injoignable', () => {
  it('affiche un message si le script de YouTube ne se charge pas', async () => {
    retirerYoutube()
    const user = userEvent.setup()
    render(<LecteurVideo />)
    await user.type(screen.getByLabelText('Lien YouTube'), `${ID}{Enter}`)
    const script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]') as HTMLScriptElement
    act(() => {
      script.dispatchEvent(new Event('error'))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger le lecteur YouTube')
  })
})
