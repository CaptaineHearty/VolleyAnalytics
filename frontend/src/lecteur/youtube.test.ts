import { afterEach, describe, expect, it } from 'vitest'
import { chargerApiYoutube, extraireIdYoutube, messageErreurYoutube, oublierChargementYoutube } from './youtube'

const ID = 'dQw4w9WgXcQ'

describe('extraireIdYoutube', () => {
  it.each([
    [ID],
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/watch?v=${ID}&t=42s`],
    [`https://youtube.com/watch?feature=share&v=${ID}`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?si=abc&t=10`],
    [`youtu.be/${ID}`],
    [`www.youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/live/${ID}?feature=share`],
    [`https://www.youtube.com/embed/${ID}`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [`  https://youtu.be/${ID}  `],
  ])('reconnaît %s', (lien) => {
    expect(extraireIdYoutube(lien)).toBe(ID)
  })

  it.each([
    [''],
    ['bonjour'],
    ['https://vimeo.com/123456789'],
    ['https://www.youtube.com/watch?v=court'],
    ['https://www.youtube.com/@chaine'],
    ['https://youtube.com.exemple.fr/watch?v=dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch'],
  ])('refuse %s', (lien) => {
    expect(extraireIdYoutube(lien)).toBeNull()
  })
})

describe('messageErreurYoutube', () => {
  it.each([
    [100, 'privée'],
    [101, "n'autorise pas"],
    [150, "n'autorise pas"],
    [153, 'Referer'],
    [999, 'code 999'],
  ])('code %i', (code, extrait) => {
    expect(messageErreurYoutube(code)).toContain(extrait)
  })
})

describe('chargerApiYoutube', () => {
  afterEach(() => {
    delete window.YT
    delete window.onYouTubeIframeAPIReady
    document.querySelectorAll('script[src*="youtube"]').forEach((s) => s.remove())
    oublierChargementYoutube()
  })

  const scripts = () => document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')

  it('charge le script une seule fois et se résout quand YouTube est prêt', async () => {
    const a = chargerApiYoutube()
    const b = chargerApiYoutube()
    expect(scripts()).toHaveLength(1)
    const api = { Player: class {} } as unknown as NonNullable<Window['YT']>
    window.YT = api
    window.onYouTubeIframeAPIReady?.()
    await expect(a).resolves.toBe(api)
    await expect(b).resolves.toBe(api)
  })

  it("réutilise l'API déjà chargée sans nouveau script", async () => {
    const api = { Player: class {} } as unknown as NonNullable<Window['YT']>
    window.YT = api
    await expect(chargerApiYoutube()).resolves.toBe(api)
    expect(scripts()).toHaveLength(0)
  })

  it('échoue proprement si le script ne se charge pas, et permet de réessayer', async () => {
    const promesse = chargerApiYoutube()
    scripts()[0].dispatchEvent(new Event('error'))
    await expect(promesse).rejects.toThrow('API YouTube injoignable')
    expect(scripts()).toHaveLength(0)
    void chargerApiYoutube().catch(() => {})
    expect(scripts()).toHaveLength(1)
  })
})
