import { vi } from 'vitest'

type FauxFetch = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/** Remplace fetch par un faux qui répond `status` et `corps` (JSON). */
export function simulerFetch(status: number, corps?: unknown) {
  const faux = vi.fn<FauxFetch>(async () =>
    // Une réponse 204 ne doit pas avoir de corps, même vide.
    new Response(corps === undefined ? null : JSON.stringify(corps), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', faux)
  return faux
}

/** Remplace fetch par un faux qui échoue comme un serveur injoignable. */
export function simulerServeurInjoignable() {
  const faux = vi.fn<FauxFetch>(async () => {
    throw new TypeError('Failed to fetch')
  })
  vi.stubGlobal('fetch', faux)
  return faux
}
