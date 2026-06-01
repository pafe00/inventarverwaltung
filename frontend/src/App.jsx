import { useEffect, useMemo, useState } from "react"
import {
  Home, Monitor, MapPin, BarChart3, Settings, Bell, Search, Plus,
  Trash2, Pencil, CheckCircle, Clock3, AlertTriangle, Laptop,
  Keyboard, Server, ChevronRight, Package, LogOut
} from "lucide-react"
import LoginPage from "./LoginPage"

const API_URL =
  (import.meta.env.VITE_API_URL || "https://inventarwebapp-linux-ejb2a7cpcdchhpg9.germanywestcentral-01.azurewebsites.net").replace(/\/$/, "")

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "")
  const [username, setUsername] = useState(() => localStorage.getItem("username") || "")
  const [inventar, setInventar] = useState([])
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [activePage, setActivePage] = useState("Dashboard")
  const [statusFilter, setStatusFilter] = useState("alle")

  function handleLogin(newToken, newUsername) {
    setToken(newToken)
    setUsername(newUsername)
  }

  function handleLogout() {
    localStorage.removeItem("token")
    localStorage.removeItem("username")
    setToken("")
    setUsername("")
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  const emptyForm = {
    id: "",
    name: "",
    kategorie: "Laptop",
    hersteller: "",
    seriennummer: "",
    standort: "",
    status: "verfügbar",
    bemerkung: "",
  }

  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    ladeInventar()
  }, [])

  async function ladeInventar() {
    try {
      const res = await fetch(`${API_URL}/api/inventar`)
      const data = await res.json()
      setInventar(data)
    } catch (err) {
      console.error(err)
    }
  }

  function openAddForm() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEditForm(item) {
    setEditingId(item.id)
    setForm({
      id: item.id,
      name: item.name || "",
      kategorie: item.kategorie || "",
      hersteller: item.hersteller || "",
      seriennummer: item.seriennummer || "",
      standort: item.standort || "",
      status: item.status || "verfügbar",
      bemerkung: item.bemerkung || "",
    })
    setShowForm(true)
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const item = {
      id: Number(form.id),
      name: form.name,
      kategorie: form.kategorie,
      hersteller: form.hersteller,
      seriennummer: form.seriennummer,
      standort: form.standort,
      status: form.status,
      bemerkung: form.bemerkung,
    }

    const method = editingId ? "PUT" : "POST"
    const url = editingId
      ? `${API_URL}/api/inventar/${editingId}`
      : `${API_URL}/api/inventar`

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(item),
    })

    if (res.status === 401) {
      handleLogout()
      return
    }

    if (!res.ok) {
      alert("Speichern fehlgeschlagen. Prüfe, ob dein Backend PUT unterstützt.")
      return
    }

    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    ladeInventar()
  }

  async function loeschen(id) {
    if (!confirm("Gerät wirklich löschen?")) return

    const delRes = await fetch(`${API_URL}/api/inventar/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    })
    if (delRes.status === 401) {
      handleLogout()
      return
    }

    ladeInventar()
  }

  const verfuegbar = inventar.filter((x) => x.status === "verfügbar").length
  const ausgeliehen = inventar.filter((x) => x.status === "ausgeliehen").length
  const defekt = inventar.filter((x) => x.status === "defekt").length

  const gefiltert = useMemo(() => {
    return inventar.filter((x) => {
      const matchesSearch =
        `${x.name} ${x.kategorie} ${x.hersteller} ${x.standort}`
          .toLowerCase()
          .includes(search.toLowerCase())

      const matchesStatus =
        statusFilter === "alle" ? true : x.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [inventar, search, statusFilter])

  const standorte = useMemo(() => {
    const gruppiert = {}

    inventar.forEach((item) => {
      const ort = item.standort || "Unbekannt"
      gruppiert[ort] = (gruppiert[ort] || 0) + 1
    })

    return Object.entries(gruppiert)
  }, [inventar])

  return (
    <>
      <style>{css}</style>

      <div className="layout">
        <aside className="sidebar">
          <div>
            <div className="brand">
              <div className="brandIcon">
                <Package size={30} />
              </div>

              <div>
                <h2>TEKO Inventar</h2>
                <p>Asset Management</p>
              </div>
            </div>

            <nav>
              <Nav icon={<Home />} text="Dashboard" activePage={activePage} onClick={setActivePage} />
              <Nav icon={<Monitor />} text="Inventar" activePage={activePage} onClick={setActivePage} />
              <Nav icon={<MapPin />} text="Standorte" activePage={activePage} onClick={setActivePage} />
              <Nav icon={<BarChart3 />} text="Berichte" activePage={activePage} onClick={setActivePage} />
              <Nav icon={<Settings />} text="Einstellungen" activePage={activePage} onClick={setActivePage} />
            </nav>
          </div>

          <div className="user">
            <div className="avatar">{username ? username[0].toUpperCase() : "A"}</div>
            <div style={{flex:1}}>
              <strong>{username || "Administrator"}</strong>
              <p>angemeldet</p>
            </div>
            <button
              onClick={handleLogout}
              title="Abmelden"
              style={{background:"transparent",border:0,color:"#94a3b8",cursor:"pointer",padding:4}}
            >
              <LogOut size={18} />
            </button>
          </div>
        </aside>

        <main className="main">
          <header className="top">
            <div>
              <h1>{activePage}</h1>
              <p>Cloudbasierte Inventarverwaltung</p>
            </div>

            <div className="topRight">
              <div className="search">
                <Search size={22} />
                <input
                  placeholder="Gerät suchen..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button className="bell">
                <Bell size={22} />
              </button>
            </div>
          </header>

          {(activePage === "Dashboard" || activePage === "Inventar") && (
            <>
              <section className="cards">
                <Card
                  color="blue"
                  icon={<Monitor />}
                  title="Gesamtgeräte"
                  value={inventar.length}
                  text="Alle Geräte im System"
                  onClick={() => setStatusFilter("alle")}
                  active={statusFilter === "alle"}
                />

                <Card
                  color="green"
                  icon={<CheckCircle />}
                  title="Verfügbar"
                  value={verfuegbar}
                  text="Bereit zur Nutzung"
                  onClick={() => setStatusFilter("verfügbar")}
                  active={statusFilter === "verfügbar"}
                />

                <Card
                  color="orange"
                  icon={<Clock3 />}
                  title="Ausgeliehen"
                  value={ausgeliehen}
                  text="Aktuell ausgeliehen"
                  onClick={() => setStatusFilter("ausgeliehen")}
                  active={statusFilter === "ausgeliehen"}
                />

                <Card
                  color="red"
                  icon={<AlertTriangle />}
                  title="Defekt"
                  value={defekt}
                  text="Benötigen Reparatur"
                  onClick={() => setStatusFilter("defekt")}
                  active={statusFilter === "defekt"}
                />
              </section>

              <InventarTabelle
                daten={gefiltert}
                openAddForm={openAddForm}
                openEditForm={openEditForm}
                loeschen={loeschen}
              />
            </>
          )}

          {activePage === "Standorte" && (
            <section className="tableBox">
              <div className="tableHead">
                <div>
                  <h2>Standorte</h2>
                  <p>Übersicht aller Geräte nach Standort</p>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Standort</th>
                    <th>Anzahl Geräte</th>
                  </tr>
                </thead>
                <tbody>
                  {standorte.map(([ort, anzahl]) => (
                    <tr key={ort}>
                      <td>{ort}</td>
                      <td>{anzahl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {activePage === "Berichte" && (
            <section className="tableBox report">
              <h2>Berichte</h2>
              <p>Gesamtgeräte: {inventar.length}</p>
              <p>Verfügbar: {verfuegbar}</p>
              <p>Ausgeliehen: {ausgeliehen}</p>
              <p>Defekt: {defekt}</p>
            </section>
          )}

          {activePage === "Einstellungen" && (
            <section className="tableBox report">
              <h2>Einstellungen</h2>
              <p>API-Verbindung:</p>
              <code>{API_URL}</code>
              <br />
              <button className="add small" onClick={ladeInventar}>
                Daten neu laden
              </button>
            </section>
          )}
        </main>

        {showForm && (
          <div className="modalBg">
            <form className="modal" onSubmit={handleSubmit}>
              <div className="modalTop">
                <h2>{editingId ? "Gerät bearbeiten" : "Gerät hinzufügen"}</h2>
                <button type="button" onClick={() => setShowForm(false)}>×</button>
              </div>

              <div className="formGrid">
                <input name="id" type="number" placeholder="ID" value={form.id} onChange={handleChange} required disabled={!!editingId} />
                <input name="name" placeholder="Gerätename" value={form.name} onChange={handleChange} required />
                <input name="kategorie" placeholder="Kategorie" value={form.kategorie} onChange={handleChange} required />
                <input name="hersteller" placeholder="Hersteller" value={form.hersteller} onChange={handleChange} />
                <input name="seriennummer" placeholder="Seriennummer" value={form.seriennummer} onChange={handleChange} />
                <input name="standort" placeholder="Standort" value={form.standort} onChange={handleChange} required />

                <select name="status" value={form.status} onChange={handleChange}>
                  <option value="verfügbar">verfügbar</option>
                  <option value="ausgeliehen">ausgeliehen</option>
                  <option value="defekt">defekt</option>
                </select>

                <input name="bemerkung" placeholder="Bemerkung" value={form.bemerkung} onChange={handleChange} />
              </div>

              <button className="save" type="submit">
                {editingId ? "Änderungen speichern" : "Speichern"}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  )
}

function InventarTabelle({ daten, openAddForm, openEditForm, loeschen }) {
  return (
    <section className="tableBox">
      <div className="tableHead">
        <div>
          <h2>Inventarliste</h2>
          <p>Übersicht aller Geräte im System</p>
        </div>

        <button className="add" type="button" onClick={openAddForm}>
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
          {daten.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>

              <td>
                <div className="device">
                  <div className="deviceIcon">{getIcon(item.kategorie)}</div>
                  <div>
                    <strong>{item.name}</strong>
                    <p>SN: {item.seriennummer || "-"}</p>
                  </div>
                </div>
              </td>

              <td>{item.kategorie}</td>
              <td>{item.hersteller}</td>
              <td>{item.standort}</td>
              <td>
                <span className={`status ${getStatus(item.status)}`}>
                  {item.status}
                </span>
              </td>
              <td>
                <div className="actions">
                  <button className="edit" onClick={() => openEditForm(item)}>
                    <Pencil size={17} />
                  </button>

                  <button className="delete" onClick={() => loeschen(item.id)}>
                    <Trash2 size={17} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Nav({ icon, text, activePage, onClick }) {
  return (
    <button
      className={activePage === text ? "nav active" : "nav"}
      onClick={() => onClick(text)}
    >
      {icon}
      <span>{text}</span>
    </button>
  )
}

function Card({ icon, title, value, text, color, onClick, active }) {
  return (
    <button className={active ? "card activeCard" : "card"} onClick={onClick}>
      <div className={`cardIcon ${color}`}>{icon}</div>
      <div>
        <p>{title}</p>
        <h2>{value}</h2>
        <span className={color}>{text}</span>
      </div>
    </button>
  )
}

function getStatus(status) {
  if (status === "verfügbar") return "green"
  if (status === "ausgeliehen") return "orange"
  return "red"
}

function getIcon(kategorie = "") {
  const k = kategorie.toLowerCase()
  if (k.includes("monitor")) return <Monitor size={20} />
  if (k.includes("zubehör")) return <Keyboard size={20} />
  if (k.includes("netzwerk")) return <Server size={20} />
  return <Laptop size={20} />
}

const css = `
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #f4f7fb;
  font-family: Inter, Arial, sans-serif;
  color: #0f172a;
}

button {
  font-family: inherit;
}

.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 300px;
  background: linear-gradient(180deg, #06142f, #071936);
  color: white;
  padding: 26px 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 36px;
}

.brandIcon {
  width: 68px;
  height: 68px;
  border-radius: 18px;
  background: linear-gradient(135deg, #38bdf8, #4f46e5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand h2 {
  margin: 0 0 5px;
  font-size: 24px;
}

.brand p {
  margin: 0;
  color: #cbd5e1;
  font-size: 16px;
}

.nav {
  width: 100%;
  height: 64px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: #e2e8f0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 18px;
  font-size: 18px;
  cursor: pointer;
  margin-bottom: 10px;
}

.nav svg {
  width: 22px;
  height: 22px;
}

.nav.active {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: white;
  box-shadow: 0 14px 30px rgba(37, 99, 235, .35);
}

.user {
  height: 96px;
  border-radius: 14px;
  background: rgba(255,255,255,.08);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
}

.user p {
  margin: 4px 0 0;
  color: #cbd5e1;
}

.main {
  flex: 1;
  padding: 30px 34px;
}

.top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 38px;
}

.top h1 {
  margin: 0 0 8px;
  font-size: 30px;
}

.top p {
  margin: 0;
  color: #64748b;
  font-size: 17px;
}

.topRight {
  display: flex;
  gap: 16px;
}

.search {
  width: 340px;
  height: 62px;
  border-radius: 12px;
  background: white;
  border: 1px solid #e5eaf2;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  box-shadow: 0 8px 24px rgba(15,23,42,.06);
}

.search input {
  border: 0;
  outline: 0;
  width: 100%;
  font-size: 16px;
}

.bell {
  width: 62px;
  height: 62px;
  border-radius: 12px;
  border: 1px solid #e5eaf2;
  background: white;
  cursor: pointer;
}

.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 26px;
  margin-bottom: 30px;
}

.card {
  min-height: 180px;
  background: white;
  border: 0;
  border-radius: 16px;
  padding: 32px 28px;
  display: flex;
  align-items: center;
  gap: 28px;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 12px 32px rgba(15,23,42,.07);
}

.card:hover {
  transform: translateY(-3px);
}

.activeCard {
  outline: 3px solid #2563eb;
}

.cardIcon {
  width: 74px;
  height: 74px;
  border-radius: 18px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cardIcon svg {
  width: 36px;
  height: 36px;
}

.card p {
  margin: 0 0 8px;
  color: #334155;
}

.card h2 {
  margin: 0 0 22px;
  font-size: 38px;
}

.blue { color: #2563eb; }
.green { color: #16a34a; }
.orange { color: #ea580c; }
.red { color: #dc2626; }

.cardIcon.blue { background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; }
.cardIcon.green { background: linear-gradient(135deg, #22c55e, #4ade80); color: white; }
.cardIcon.orange { background: linear-gradient(135deg, #f59e0b, #fbbf24); color: white; }
.cardIcon.red { background: linear-gradient(135deg, #ef4444, #f87171); color: white; }

.tableBox {
  background: white;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(15,23,42,.07);
}

.tableHead {
  padding: 26px 30px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tableHead h2 {
  margin: 0 0 6px;
  font-size: 24px;
}

.tableHead p {
  margin: 0;
  color: #64748b;
}

.add {
  height: 48px;
  padding: 0 20px;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: white;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  cursor: pointer;
}

.add.small {
  margin-top: 20px;
  width: fit-content;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  color: #64748b;
  font-size: 14px;
  padding: 18px 30px;
  background: #f8fafc;
}

td {
  padding: 14px 30px;
  border-bottom: 1px solid #e5eaf2;
  font-size: 15px;
}

.device {
  display: flex;
  align-items: center;
  gap: 16px;
}

.deviceIcon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: #eaf1ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.device strong {
  display: block;
  margin-bottom: 4px;
}

.device p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.status {
  display: inline-flex;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}

.status.green {
  background: #dcfce7;
  color: #15803d;
}

.status.orange {
  background: #fef3c7;
  color: #d97706;
}

.status.red {
  background: #fee2e2;
  color: #dc2626;
}

.actions {
  display: flex;
  gap: 10px;
}

.edit,
.delete {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  border: 1px solid #e5eaf2;
  background: white;
  cursor: pointer;
}

.edit {
  color: #2563eb;
}

.delete {
  color: #ef4444;
}

.report {
  padding: 30px;
}

.report h2 {
  margin-top: 0;
}

.report p {
  font-size: 18px;
}

.report code {
  display: inline-block;
  background: #f1f5f9;
  padding: 14px;
  border-radius: 10px;
  margin-top: 8px;
}

.modalBg {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, .55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal {
  width: 650px;
  background: white;
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 24px 70px rgba(0,0,0,.25);
}

.modalTop {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.modalTop h2 {
  margin: 0;
}

.modalTop button {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 10px;
  background: #f1f5f9;
  font-size: 26px;
  cursor: pointer;
}

.formGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.formGrid input,
.formGrid select {
  height: 52px;
  border: 1px solid #dbe3ee;
  border-radius: 12px;
  padding: 0 14px;
  font-size: 15px;
  outline: 0;
}

.formGrid input:disabled {
  background: #f1f5f9;
  color: #64748b;
}

.save {
  width: 100%;
  height: 54px;
  margin-top: 20px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: white;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 1300px) {
  .cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 900px) {
  .layout {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
  }

  .top {
    flex-direction: column;
    gap: 20px;
  }

  .search {
    width: 100%;
  }

  .cards {
    grid-template-columns: 1fr;
  }
}
`