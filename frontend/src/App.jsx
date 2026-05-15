import { useEffect, useMemo, useState } from 'react'
import './App.css'

function KpiCard({ title, value, sub, color }) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-top">
        <div>
          <p>{title}</p>
          <h2>{value}</h2>
          <span>{sub}</span>
        </div>

        <div className="kpi-icon">⬢</div>
      </div>

      <div className="kpi-chart">
        <div className="wave"></div>
      </div>
    </div>
  )
}

function App() {
  const API_URL =
    'https://inventarwebapp-linux-ejb2a7cpcdchhpg9.germanywestcentral-01.azurewebsites.net'

  const [inventar, setInventar] = useState([])
  const [loading, setLoading] = useState(true)
  const [suche, setSuche] = useState('')
  const [showForm, setShowForm] = useState(false)

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

    try {
      const response = await fetch(`${API_URL}/api/inventar`)
      const data = await response.json()
      setInventar(data)
    } catch (error) {
      console.error(error)
    }

    setLoading(false)
  }

  useEffect(() => {
    ladeInventar()
  }, [])

  const stats = useMemo(() => {
    const total = inventar.length

    const verfuegbar = inventar.filter(
      (i) => i.status === 'verfügbar'
    ).length

    const ausgeliehen = inventar.filter(
      (i) => i.status === 'ausgeliehen'
    ).length

    const defekt = inventar.filter(
      (i) => i.status === 'defekt'
    ).length

    const standorte = new Set(
      inventar.map((i) => i.standort)
    ).size

    return {
      total,
      verfuegbar,
      ausgeliehen,
      defekt,
      standorte,
    }
  }, [inventar])

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
      alert('Fehler beim Speichern.')
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

    setShowForm(false)

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
    `${item.name} ${item.kategorie} ${item.hersteller} ${item.standort}`
      .toLowerCase()
      .includes(suche.toLowerCase())
  )

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-box">⬢</div>

          <div>
            <h2>TEKO Inventar</h2>
            <p>Asset Management</p>
          </div>
        </div>

        <nav className="nav">
          <a className="active">Dashboard</a>
          <a>Inventar</a>
          <a>Standorte</a>
          <a>Kategorien</a>
          <a>Import / Export</a>
          <a>Berichte</a>
          <a>Einstellungen</a>
        </nav>

        <div className="quick-actions">
          <h3>Schnellaktionen</h3>

          <button onClick={() => setShowForm(true)}>
            + Neues Gerät
          </button>

          <button>Importieren</button>
          <button>Exportieren</button>
        </div>

        <div className="profile">
          <div className="avatar">A</div>

          <div>
            <strong>Administrator</strong>
            <span>admin@teko.ch</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div>
            <h1>Willkommen zurück 👋</h1>
            <p>Inventarverwaltung mit Azure & FastAPI</p>
          </div>

          <div className="header-right">
            <input
              placeholder="Suche..."
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />

            <button onClick={ladeInventar}>⟳</button>
          </div>
        </header>

        <section className="kpi-grid">
          <KpiCard
            title="Gesamtgeräte"
            value={stats.total}
            sub="Inventare"
            color="blue"
          />

          <KpiCard
            title="Verfügbar"
            value={stats.verfuegbar}
            sub="Aktiv"
            color="green"
          />

          <KpiCard
            title="Ausgeliehen"
            value={stats.ausgeliehen}
            sub="Benutzer"
            color="orange"
          />

          <KpiCard
            title="Defekt"
            value={stats.defekt}
            sub="Service"
            color="red"
          />

          <KpiCard
            title="Standorte"
            value={stats.standorte}
            sub="Aktiv"
            color="purple"
          />
        </section>

        <section className="content-grid">
          <div className="panel">
            <h2>Statusverteilung</h2>

            <div className="donut-wrapper">
              <div className="donut"></div>

              <div className="legend">
                <div>
                  <span className="dot green"></span>
                  Verfügbar
                </div>

                <div>
                  <span className="dot yellow"></span>
                  Ausgeliehen
                </div>

                <div>
                  <span className="dot red"></span>
                  Defekt
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>Letzte Aktivitäten</h2>

            <div className="activity">
              <div className="activity-item">
                <strong>MacBook Pro hinzugefügt</strong>
                <span>Heute, 10:24</span>
              </div>

              <div className="activity-item">
                <strong>Monitor als defekt markiert</strong>
                <span>Heute, 09:15</span>
              </div>

              <div className="activity-item">
                <strong>Standort Zürich aktualisiert</strong>
                <span>Gestern, 16:45</span>
              </div>

              <div className="activity-item">
                <strong>ThinkPad ausgeliehen</strong>
                <span>Gestern, 14:32</span>
              </div>
            </div>
          </div>
        </section>

        <section className="table-panel">
          <div className="table-header">
            <div>
              <h2>Inventarliste</h2>
              <p>{inventar.length} Geräte</p>
            </div>

            <button
              className="new-btn"
              onClick={() => setShowForm(true)}
            >
              + Neues Gerät
            </button>
          </div>

          {loading ? (
            <p>Daten werden geladen...</p>
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
                      <div className="device">
                        <strong>{item.name}</strong>
                        <span>{item.seriennummer}</span>
                      </div>
                    </td>

                    <td>{item.kategorie}</td>
                    <td>{item.hersteller}</td>
                    <td>{item.standort}</td>

                    <td>
                      <span className={`badge ${item.status}`}>
                        {item.status}
                      </span>
                    </td>

                    <td>
                      <button
                        className="delete-btn"
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

        {showForm && (
          <div className="modal-bg">
            <form className="modal" onSubmit={handleSubmit}>
              <div className="modal-head">
                <h2>Neues Gerät</h2>

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                >
                  ×
                </button>
              </div>

              <div className="form-grid">
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
                  placeholder="Gerätename"
                  value={form.name}
                  onChange={handleChange}
                  required
                />

                <input
                  name="kategorie"
                  placeholder="Kategorie"
                  value={form.kategorie}
                  onChange={handleChange}
                  required
                />

                <input
                  name="hersteller"
                  placeholder="Hersteller"
                  value={form.hersteller}
                  onChange={handleChange}
                />

                <input
                  name="seriennummer"
                  placeholder="Seriennummer"
                  value={form.seriennummer}
                  onChange={handleChange}
                />

                <input
                  name="standort"
                  placeholder="Standort"
                  value={form.standort}
                  onChange={handleChange}
                  required
                />

                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                >
                  <option value="verfügbar">Verfügbar</option>
                  <option value="ausgeliehen">Ausgeliehen</option>
                  <option value="defekt">Defekt</option>
                </select>

                <input
                  name="bemerkung"
                  placeholder="Bemerkung"
                  value={form.bemerkung}
                  onChange={handleChange}
                />
              </div>

              <button className="save-btn" type="submit">
                Gerät speichern
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

export default App