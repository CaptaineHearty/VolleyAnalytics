import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { simulerFetch, simulerServeurInjoignable } from '../test/fetch'
import { StatutConnexion } from './StatutConnexion'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StatutConnexion', () => {
  it("affiche un message d'attente pendant le chargement", () => {
    simulerFetch(200, { count: 0, next: null, previous: null, results: [] })
    render(<StatutConnexion />)
    expect(screen.getByRole('status')).toHaveTextContent("Connexion à l'API…")
  })

  it("indique le nombre d'équipes une fois connecté", async () => {
    simulerFetch(200, { count: 3, next: null, previous: null, results: [] })
    render(<StatutConnexion />)
    expect(await screen.findByText(/Connecté à l'API · 3 équipes enregistrées/)).toBeInTheDocument()
  })

  it('accorde au singulier pour une seule équipe', async () => {
    simulerFetch(200, { count: 1, next: null, previous: null, results: [] })
    render(<StatutConnexion />)
    expect(await screen.findByText(/1 équipe enregistrée$/)).toBeInTheDocument()
  })

  it.each([401, 403])('propose de se connecter si l’API répond %i', async (status) => {
    simulerFetch(status, { detail: 'Informations d’authentification non fournies.' })
    render(<StatutConnexion />)
    const lien = await screen.findByRole('link', { name: 'Se connecter' })
    expect(lien).toHaveAttribute('href', '/api-auth/login/?next=/')
  })

  it('signale un serveur injoignable', async () => {
    simulerServeurInjoignable()
    render(<StatutConnexion />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Le serveur Django est-il lancé ?')
  })

  it('signale une erreur serveur (500)', async () => {
    simulerFetch(500, { detail: 'Erreur' })
    render(<StatutConnexion />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
