import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [inventar, setInventar] = useState([])
  const [loading, setLoading] = useState(true)

  const API_URL =
    'https://inventarwebapp-linux-ejb2a7cpcdchhppg9.germanywestcentral-01.azurewebsites.net'

  useEffect(() => {
    fetch(`${API_URL}/api/inventar`)
      .then((response) => response.json())
      .then((data) => {
        setInventar(data)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Fehler:', error)
        setLoading(false)
      })
  }, [])

  return (
    <div className="container">
      <header className="header">
        <h1>TEKO Inventarverwaltung</h1>
        <p>Cloudbasierte Inventarverwaltung mit Azure & FastAPI</p>
      </header>

      <div className="dashboard">
        <div className="card">
          <h3>Geräte</h3>
          <p>{inventar.length}</p>
        </div>

        <div className="card available">
          <h3>Verfügbar</h3>
          <p>
            {
              inventar.filter(
                (item) => item.status === 'verfügbar'
              ).length
            }
          </p>
        </div>

        <div className="card borrowed">
          <h3>Ausgeliehen</h3>
          <p>
            {
              inventar.filter(
                (item) => item.status === 'ausgeliehen'
              ).length
            }
          </p>
        </div>

        <div className="card defect">
          <h3>Defekt</h3>
          <p>
            {
              inventar.filter(
                (item) => item.status === 'defekt'
              ).length
            }
          </p>
        </div>
      </div>

      <section className="table-section">
        <h2>Inventarliste</h2>

        {loading ? (
          <p>Lade Daten...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Kategorie</th>
                <th>Hersteller</th>
                <th>Standort</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {inventar.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.kategorie}</td>
                  <td>{item.hersteller}</td>
                  <td>{item.standort}</td>
                  <td>
                    <span className={`status ${item.status}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

export default App