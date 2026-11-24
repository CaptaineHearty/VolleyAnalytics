import { afterEach, describe, expect, it, vi } from 'vitest'
import { simulerFetch } from '../test/fetch'
import { ApiError, apiFetch, lireCookie } from './client'

function entetesEnvoyes(faux: ReturnType<typeof simulerFetch>): Headers {
  const init = faux.mock.calls[0][1] as RequestInit
  return init.headers as Headers
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lireCookie', () => {
  it('retrouve un cookie parmi plusieurs', () => {
    document.cookie = 'a=1'
    document.cookie = 'csrftoken=abc%3D'
    expect(lireCookie('csrftoken')).toBe('abc=')
  })

  it('renvoie null si le cookie est absent', () => {
    expect(lireCookie('inexistant')).toBeNull()
  })
})

describe('apiFetch', () => {
  it('renvoie le JSON de la réponse', async () => {
    simulerFetch(200, { count: 1 })
    await expect(apiFetch('/api/equipes/')).resolves.toEqual({ count: 1 })
  })

  it('envoie le cookie de session et demande du JSON', async () => {
    const faux = simulerFetch(200, {})
    await apiFetch('/api/equipes/')
    const init = faux.mock.calls[0][1] as RequestInit
    expect(init.credentials).toBe('same-origin')
    expect(entetesEnvoyes(faux).get('Accept')).toBe('application/json')
  })

  it("n'envoie pas le jeton CSRF sur un GET", async () => {
    document.cookie = 'csrftoken=jeton'
    const faux = simulerFetch(200, {})
    await apiFetch('/api/equipes/')
    expect(entetesEnvoyes(faux).has('X-CSRFToken')).toBe(false)
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('envoie le jeton CSRF sur un %s', async (methode) => {
    document.cookie = 'csrftoken=jeton'
    const faux = simulerFetch(200, {})
    await apiFetch('/api/equipes/1/', { method: methode, body: '{}' })
    expect(entetesEnvoyes(faux).get('X-CSRFToken')).toBe('jeton')
  })

  it('déclare le corps en JSON quand il y en a un', async () => {
    const faux = simulerFetch(201, { id: 1 })
    await apiFetch('/api/equipes/', { method: 'POST', body: JSON.stringify({ nom: 'A' }) })
    expect(entetesEnvoyes(faux).get('Content-Type')).toBe('application/json')
  })

  it('accepte une réponse vide (204 après une suppression)', async () => {
    simulerFetch(204)
    await expect(apiFetch('/api/equipes/1/', { method: 'DELETE' })).resolves.toBeNull()
  })

  it("lève une ApiError avec le statut et les détails d'erreur", async () => {
    simulerFetch(400, { zone: ['Trop grand'] })
    const erreur = await apiFetch('/api/evenements/', { method: 'POST', body: '{}' }).catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(ApiError)
    expect((erreur as ApiError).status).toBe(400)
    expect((erreur as ApiError).details).toEqual({ zone: ['Trop grand'] })
  })
})
