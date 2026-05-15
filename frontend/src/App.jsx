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

  const verfuegbar = inventar.filter((i) => i.status === 'verfügbar').length
  const ausgeliehen = inventar.filter((i) => i.status === 'ausgeliehen').length
  const defekt = inventar.filter((i) => i.status === 'defekt').length
  const standorte = new Set(inventar.map((i) => i.standort)).size

  return (
    <div className="page">
      <nav className="navbar">
        <div className="brand">TEKO INVENTAR</div>
        <div className="nav-links">
          <span className="active">Dashboard</span>
          <span>Inventare</span>
          <span>Standorte</span>
          <span>Import/Export</span>
          <span>Einstellungen</span>
        </div>
        <div className="user">Azure Cloud</div>
      </nav>

      <main className="content">
        <section className="hero-grid">
          <div className="hero-card">
            <div>
              <h1>{inventar.length}</h1>
              <p>Inventare</p>
            </div>
            <div className="hero-icon">◆</div>
          </div>

          <div className="hero-card">
            <div>
              <h1>{standorte}</h1>
              <p>Standorte</p>
            </div>
            <div className="hero-icon">◼</div>
          </div>
        </section>

        <section className="mini-grid">
          <div className="mini-card">
            <p>Aktive Inventare</p>
            <h2>{verfuegbar}</h2>
            <div className="bar green"></div>
          </div>

          <div className="mini-card">
            <p>Ausgeliehen</p>
            <h2>{ausgeliehen}</h2>
            <div className="bar yellow"></div>
          </div>

          <div className="mini-card">
            <p>Defekte Geräte</p>
            <h2>{defekt}</h2>
            <div className="bar red"></div>
          </div>

          <div className="mini-card">
            <p>Gesamtbestand</p>
            <h2>{inventar.length}</h2>
            <div className="bar blue"></div>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="panel chart-panel">
            <h2>Statusverteilung</h2>
            <div className="donut">
              <div className="donut-hole"></div>
            </div>

            <div className="legend">
              <span><b className="dot green-dot"></b>Verfügbar</span>
              <span><b className="dot yellow-dot"></b>Ausgeliehen</span>
              <span><b className="dot red-dot"></b>Defekt</span>
            </div>
          </div>

          <div className="panel">
            <h2>Neues Gerät erfassen</h2>

            <form onSubmit={handleSubmit} className="form">
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

              <button type="submit">Speichern</button>
            </form>
          </div>
        </section>

        <section className="panel table-panel">
          <div className="table-head">
            <div>
              <h2>Inventarliste</h2>
              <p>Gerätebestand aus Azure SQL Database</p>
            </div>

            <input
              className="search"
              placeholder="Inventar suchen..."
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="loading">Daten werden geladen...</p>
          ) : (
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
          )}
        </section>
      </main>
    </div>
  )
}

export default App