import { StatutConnexion } from './components/StatutConnexion'
import { EcranSaisie } from './saisie/EcranSaisie'

function App() {
  return (
    <main>
      <h1>VolleyAnalytics</h1>
      <StatutConnexion>
        <EcranSaisie />
      </StatutConnexion>
    </main>
  )
}

export default App
