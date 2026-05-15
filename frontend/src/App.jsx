import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const API_URL =
    'https://inventarwebapp-linux-ejb2a7cpcdchhpg9.germanywestcentral-01.azurewebsites.net'

  const [inventar, setInventar] = useState([])
  const [loading, setLoading] = useState(true)
  const [suche, setSuche] = useState('')

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
      headers: { 'Content-Type': 'application/json' },
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
    if (!confirm('Gerät wirklich löschen?')) return

    await fetch(`${API_URL}/api/inventar/${id}`, {
      method: 'DELETE',
    })

    ladeInventar()
  }

  const gefiltertesInventar = inventar.filter((item) =>
    `${item.name} ${item.kategorie} ${item.hersteller} ${item.standort} ${item.status}`
      .toLowerCase()
      .includes(suche.toLowerCase())
  )

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="logo">
          <span>TI</span>
          <div>
            <h2>TEKO Inventar</h2>
            <p>Cloud Asset Management</p>
          </div>
        </div>

        <nav>
          <a className="active">Dashboard</a>
          <a>Inventar</a>
          <a>Standorte</a>
          <a>Berichte</a>
          <a>Einstellungen</a>
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>Inventarverwaltung</h1>
            <p>Azure · FastAPI · SQL Database · React</p>
          </div>

          <button onClick={ladeInventar}>Aktualisieren</button>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <p>Gesamtgeräte</p>
            <h2>{inventar.length}</h2>
          </div>

          <div className="stat-card success">
            <p>Verfügbar</p>
            <h2>{inventar.filter((i) => i.status === 'verfügbar').length}</h2>
          </div>

          <div className="stat-card warning">
            <p>Ausgeliehen</p>
            <h2>{inventar.filter((i) => i.status === 'ausgeliehen').length}</h2>
          </div>

          <div className="stat-card danger">
            <p>Defekt</p>
            <h2>{inventar.filter((i) => i.status === 'defekt').length}</h2>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Neues Gerät erfassen</h2>
              <p>Inventarobjekt direkt in Azure SQL speichern</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form-grid">
            <input name="id" type="number" placeholder="ID" value={form.id} onChange={handleChange} required />
            <input name="name" placeholder="Gerätename" value={form.name} onChange={handleChange} required />
            <input name="kategorie" placeholder="Kategorie" value={form.kategorie} onChange={handleChange} required />
            <input name="hersteller" placeholder="Hersteller" value={form.hersteller} onChange={handleChange} />
            <input name="seriennummer" placeholder="Seriennummer" value={form.seriennummer} onChange={handleChange} />
            <input name="standort" placeholder="Standort" value={form.standort} onChange={handleChange} required />

            <select name="status" value={form.status} onChange={handleChange}>
              <option value="verfügbar">Verfügbar</option>
              <option value="ausgeliehen">Ausgeliehen</option>
              <option value="defekt">Defekt</option>
            </select>

            <input name="bemerkung" placeholder="Bemerkung" value={form.bemerkung} onChange={handleChange} />

            <button type="submit">Gerät hinzufügen</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header table-header">
            <div>
              <h2>Inventarliste</h2>
              <p>Aktuelle Geräte aus der Datenbank</p>
            </div>

            <input
              className="search"
              placeholder="Suchen..."
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="loading">Daten werden geladen...</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Gerät</th>
                    <th>Kategorie</th>
                    <th>Hersteller</th>
                    <th>Standort</th>
                    <th>Status</th>
                    <th>Aktion</th>
                  </tr>
                </thead>

                <tbody>
                  {gefiltertesInventar.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.seriennummer || 'Keine Seriennummer'}</small>
                      </td>
                      <td>{item.kategorie}</td>
                      <td>{item.hersteller || '-'}</td>
                      <td>{item.standort}</td>
                      <td>
                        <span className={`badge ${item.status}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <button className="delete-btn" onClick={() => loeschen(item.id)}>
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App