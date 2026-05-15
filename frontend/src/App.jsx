import "./App.css"
import { useEffect, useState } from "react"
import {
  Home,
  Monitor,
  MapPin,
  BarChart3,
  Settings,
  Bell,
  Search,
  Plus,
  Trash2,
  CheckCircle,
  Clock3,
  AlertTriangle,
  Laptop,
  Keyboard,
  Server,
} from "lucide-react"
import "./App.css"

function App() {
  const API_URL =
    "https://inventarwebapp-linux-ejb2a7cpcdchhpg9.germanywestcentral-01.azurewebsites.net"

  const [inventar, setInventar] = useState([])
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    id: "",
    name: "",
    kategorie: "",
    hersteller: "",
    seriennummer: "",
    standort: "",
    status: "verfügbar",
    bemerkung: "",
  })

  const ladeInventar = async () => {
    const response = await fetch(`${API_URL}/api/inventar`)
    const data = await response.json()
    setInventar(data)
  }

  useEffect(() => {
    ladeInventar()
  }, [])

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(neuesItem),
    })

    if (!response.ok) {
      alert("Fehler: Gerät konnte nicht gespeichert werden.")
      return
    }

    setForm({
      id: "",
      name: "",
      kategorie: "",
      hersteller: "",
      seriennummer: "",
      standort: "",
      status: "verfügbar",
      bemerkung: "",
    })

    setShowForm(false)
    ladeInventar()
  }

  const loeschen = async (id) => {
    if (!confirm("Gerät wirklich löschen?")) return

    await fetch(`${API_URL}/api/inventar/${id}`, {
      method: "DELETE",
    })

    ladeInventar()
  }

  const verfuegbar = inventar.filter((i) => i.status === "verfügbar").length
  const ausgeliehen = inventar.filter((i) => i.status === "ausgeliehen").length
  const defekt = inventar.filter((i) => i.status === "defekt").length

  const gefiltert = inventar.filter((item) =>
    `${item.name} ${item.kategorie} ${item.hersteller} ${item.standort}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  return (
    <div className="page">
      <aside className="sidebar">
        <div>
          <div className="logo-area">
            <div className="logo-box">
              <Monitor size={30} />
            </div>
            <div>
              <h2>TEKO Inventar</h2>
              <p>Asset Management</p>
            </div>
          </div>

          <nav className="nav">
            <NavItem icon={<Home size={22} />} text="Dashboard" active />
            <NavItem icon={<Monitor size={22} />} text="Inventar" />
            <NavItem icon={<MapPin size={22} />} text="Standorte" />
            <NavItem icon={<BarChart3 size={22} />} text="Berichte" />
            <NavItem icon={<Settings size={22} />} text="Einstellungen" />
          </nav>
        </div>

        <div className="profile">
          <div className="avatar">A</div>
          <div>
            <strong>Administrator</strong>
            <p>admin@teko.ch</p>
          </div>
          <span>›</span>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div>
            <h1>Willkommen zurück 👋</h1>
            <p>Cloudbasierte Inventarverwaltung</p>
          </div>

          <div className="header-right">
            <div className="search-box">
              <Search size={23} />
              <input
                placeholder="Gerät suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button className="icon-btn">
              <Bell size={23} />
            </button>
          </div>
        </header>

        <section className="stats-grid">
          <StatCard
            icon={<Monitor size={34} />}
            title="Gesamtgeräte"
            value={inventar.length}
            text="Alle Geräte im System"
            color="blue"
          />
          <StatCard
            icon={<CheckCircle size={34} />}
            title="Verfügbar"
            value={verfuegbar}
            text="Bereit zur Nutzung"
            color="green"
          />
          <StatCard
            icon={<Clock3 size={34} />}
            title="Ausgeliehen"
            value={ausgeliehen}
            text="Aktuell ausgeliehen"
            color="orange"
          />
          <StatCard
            icon={<AlertTriangle size={34} />}
            title="Defekt"
            value={defekt}
            text="Benötigen Reparatur"
            color="red"
          />
        </section>

        <section className="table-card">
          <div className="table-top">
            <div>
              <h2>Inventarliste</h2>
              <p>Übersicht aller Geräte im System</p>
            </div>

            <button className="add-btn" onClick={() => setShowForm(true)}>
              <Plus size={20} />
              Gerät hinzufügen
            </button>
          </div>

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
              {gefiltert.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>
                    <div className="device-cell">
                      <div className="device-icon">{deviceIcon(item.kategorie)}</div>
                      <div>
                        <strong>{item.name}</strong>
                        <p>SN: {item.seriennummer || "Nicht erfasst"}</p>
                      </div>
                    </div>
                  </td>
                  <td>{item.kategorie}</td>
                  <td>{item.hersteller || "-"}</td>
                  <td>{item.standort}</td>
                  <td>
                    <span className={`badge ${item.status}`}>{item.status}</span>
                  </td>
                  <td>
                    <button className="delete-btn" onClick={() => loeschen(item.id)}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>

      {showForm && (
        <div className="modal-bg">
          <form className="modal" onSubmit={handleSubmit}>
            <div className="modal-head">
              <h2>Neues Gerät hinzufügen</h2>
              <button type="button" onClick={() => setShowForm(false)}>
                ×
              </button>
            </div>

            <div className="form-grid">
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
            </div>

            <button className="save-btn" type="submit">
              Speichern
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function NavItem({ icon, text, active }) {
  return (
    <button className={active ? "nav-item active" : "nav-item"}>
      {icon}
      <span>{text}</span>
    </button>
  )
}

function StatCard({ icon, title, value, text, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div>
        <p className="stat-title">{title}</p>
        <h3>{value}</h3>
        <p className={`stat-text ${color}`}>{text}</p>
      </div>
    </div>
  )
}

function deviceIcon(kategorie) {
  const k = String(kategorie || "").toLowerCase()
  if (k.includes("monitor")) return <Monitor size={24} />
  if (k.includes("zubehör")) return <Keyboard size={24} />
  if (k.includes("netzwerk")) return <Server size={24} />
  return <Laptop size={24} />
}

export default App