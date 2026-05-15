import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const API_URL =
    'https://inventarwebapp-linux-ejb2a7cpcdchhpg9.germanywestcentral-01.azurewebsites.net/

  const [inventar, setInventar] = useState([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    id: '',
    name: '',
    kategorie: '',
    hersteller: '',
    seriennummer: '',
    standort: '',
    status: 'verfügbar',
    bemerkung: '',
  })

  const ladeInventar = async () => {
    setLoading(true)
    const response = await fetch(`${API_URL}/api/inventar`)
    const data = await response.json()
    setInventar(data)
    setLoading(false)
  }

  useEffect(() => {
    ladeInventar()
  }, [])

  const handleChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const neuesItem = {
      id: Number(form.id),
      name: form.name,
      kategorie: form.kategorie,
      hersteller: form.hersteller || null,
      seriennummer: form.seriennummer || null,
      standort: form.standort,
      status: form.status,
      bemerkung: form.bemerkung || null,
    }

    const response = await fetch(`${API_URL}/api/inventar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(neuesItem),
    })

    if (!response.ok) {
      alert('Fehler: ID existiert bereits oder Eingabe ungültig.')
      return
    }

    setForm({
      id: '',
      name: '',
      kategorie: '',
      hersteller: '',
      seriennummer: '',
      standort: '',
      status: 'verfügbar',
      bemerkung: '',
    })

    ladeInventar()
  }

  const loeschen = async (id) => {
    const bestaetigung = confirm('Gerät wirklich löschen?')

    if (!bestaetigung) return

    await fetch(`${API_URL}/api/inventar/${id}`, {
      method: 'DELETE',
    })

    ladeInventar()
  }

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
          <p>{inventar.filter((item) => item.status === 'verfügbar').length}</p>
        </div>

        <div className="card borrowed">
          <h3>Ausgeliehen</h3>
          <p>{inventar.filter((item) => item.status === 'ausgeliehen').length}</p>
        </div>

        <div className="card defect">
          <h3>Defekt</h3>
          <p>{inventar.filter((item) => item.status === 'defekt').length}</p>
        </div>
      </div>

      <section className="form-section">
        <h2>Gerät hinzufügen</h2>

        <form onSubmit={handleSubmit} className="form-grid">
          <input
            name="id"
            type="number"
            placeholder="ID"
            value={form.id}
            onChange={handleChange}
            required
          />

          <input
            name="name"
            type="text"
            placeholder="Gerätename"
            value={form.name}
            onChange={handleChange}
            required
          />

          <input
            name="kategorie"
            type="text"
            placeholder="Kategorie"
            value={form.kategorie}
            onChange={handleChange}
            required
          />

          <input
            name="hersteller"
            type="text"
            placeholder="Hersteller"
            value={form.hersteller}
            onChange={handleChange}
          />

          <input
            name="seriennummer"
            type="text"
            placeholder="Seriennummer"
            value={form.seriennummer}
            onChange={handleChange}
          />

          <input
            name="standort"
            type="text"
            placeholder="Standort"
            value={form.standort}
            onChange={handleChange}
            required
          />

          <select name="status" value={form.status} onChange={handleChange}>
            <option value="verfügbar">Verfügbar</option>
            <option value="ausgeliehen">Ausgeliehen</option>
            <option value="defekt">Defekt</option>
          </select>

          <input
            name="bemerkung"
            type="text"
            placeholder="Bemerkung"
            value={form.bemerkung}
            onChange={handleChange}
          />

          <button type="submit">Hinzufügen</button>
        </form>
      </section>

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
                <th>Aktion</th>
              </tr>
            </thead>

            <tbody>
              {inventar.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.kategorie}</td>
                  <td>{item.hersteller || '-'}</td>
                  <td>{item.standort}</td>
                  <td>
                    <span className={`status ${item.status}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="delete-button"
                      onClick={() => loeschen(item.id)}
                    >
                      Löschen
                    </button>
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
