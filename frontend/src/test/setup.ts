import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // Efface les cookies posés par un test.
  for (const cookie of document.cookie.split(';')) {
    const nom = cookie.split('=')[0].trim()
    if (nom) document.cookie = `${nom}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  }
})
