import { useEffect, useState } from "react"
import {
  Home, Monitor, MapPin, BarChart3, Settings, Bell, Search, Plus,
  Trash2, Pencil, CheckCircle, Clock3, AlertTriangle, Laptop,
  Keyboard, Server, ChevronRight, Package, LogOut
} from "lucide-react"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import LoginPage from "./LoginPage"

const API_URL =
  (import.meta.env.VITE_API_URL || "https://inventarwebapp-linux-ejb2a7cpcdchhpg9.germanywestcentral-01.azurewebsites.net").replace(/\/$/, "")

const TEKO_STANDORTE = ["Luzern", "Bern", "Basel", "Zürich", "Olten"]

const DEVICE_CATALOG = {
  Apple: {
    Laptop: ["MacBook Air M1", "MacBook Air M2", "MacBook Air M3", "MacBook Pro 14\"", "MacBook Pro 16\""],
    Smartphone: ["iPhone 12", "iPhone 13", "iPhone 14", "iPhone 15"],
    Tablet: ["iPad 10. Gen", "iPad Air", "iPad Pro 11\"", "iPad Pro 12.9\""],
    Earbuds: ["AirPods 2", "AirPods 3", "AirPods Pro", "AirPods Max"],
    Smartwatch: ["Apple Watch SE", "Apple Watch Series 9"],
  },
  Dell: {
    Laptop: ["Latitude 5440", "Latitude 5540", "XPS 13", "XPS 15"],
    Desktop: ["OptiPlex 7010", "OptiPlex 7020"],
    Monitor: ["P2422H", "P2723D", "U2723QE"],
  },
  HP: {
    Laptop: ["EliteBook 840 G10", "ProBook 450 G10", "ZBook Power G10"],
    Desktop: ["ProDesk 400 G9", "EliteDesk 800 G9"],
    Monitor: ["E24 G5", "E27 G5", "Z24f G3"],
  },
  Lenovo: {
    Laptop: ["ThinkPad E14", "ThinkPad T14", "ThinkPad X1 Carbon"],
    Desktop: ["ThinkCentre M70s", "ThinkCentre M90t"],
    Monitor: ["ThinkVision T24i", "ThinkVision T27h"],
    Tablet: ["Tab P11", "Tab P12"],
  },
  Samsung: {
    Smartphone: ["Galaxy S21", "Galaxy S22", "Galaxy S23", "Galaxy S24"],
    Tablet: ["Galaxy Tab S8", "Galaxy Tab S9"],
    Earbuds: ["Galaxy Buds2", "Galaxy Buds2 Pro"],
    Monitor: ["ViewFinity S6", "Odyssey G5"],
  },
  Google: {
    Smartphone: ["Pixel 7", "Pixel 8", "Pixel 8a"],
    Tablet: ["Pixel Tablet"],
    Earbuds: ["Pixel Buds A-Series", "Pixel Buds Pro"],
  },
  Microsoft: {
    Laptop: ["Surface Laptop 5", "Surface Laptop 6"],
    Tablet: ["Surface Pro 9", "Surface Pro 10"],
    Desktop: ["Surface Studio 2+"],
  },
}

const HERSTELLER_OPTIONEN = Object.keys(DEVICE_CATALOG)

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "")
  const [username, setUsername] = useState(() => localStorage.getItem("username") || "")
  const [inventar, setInventar] = useState([])
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [activePage, setActivePage] = useState("Dashboard")
  const [statusFilter, setStatusFilter] = useState("alle")
  const emptyForm = {
    name: "",
    kategorie: "",
    hersteller: "",
    seriennummer: "",
    standort: "",
    status: "verfügbar",
    bemerkung: "",
  }
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)

  function handleLogin(newToken, newUsername) {
    setToken(newToken)
    setUsername(newUsername)
  }

  function handleLogout() {
    localStorage.removeItem("token")
    localStorage.removeItem("username")
    setToken("")
    setUsername("")
    setInventar([])
    setShowForm(false)
    setActivePage("Dashboard")
  }

  useEffect(() => {
    if (token) {
      ladeInventar()
    }
  }, [token])

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  async function ladeInventar() {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/api/inventar`, {
        headers: { "Authorization": `Bearer ${token}` },
      })
      if (res.status === 401) {
        handleLogout()
        return
      }
      if (!res.ok) {
        console.error("Fehler beim Laden:", res.status, res.statusText)
        setInventar([])
        return
      }
      const data = await res.json()
      setInventar(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Fehler beim Abrufen des Inventars:", err)
      setInventar([])
    } finally {
      setLoading(false)
    }
  }

  function openAddForm() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEditForm(item) {
    setEditingId(item.id)
    const standort = TEKO_STANDORTE.includes(item.standort) ? item.standort : ""
    const hersteller = HERSTELLER_OPTIONEN.includes(item.hersteller) ? item.hersteller : ""
    const kategorieOptionen = hersteller ? Object.keys(DEVICE_CATALOG[hersteller]) : []
    const kategorie = kategorieOptionen.includes(item.kategorie) ? item.kategorie : ""
    const modellOptionen = hersteller && kategorie ? DEVICE_CATALOG[hersteller][kategorie] : []
    const modell = modellOptionen.includes(item.name) ? item.name : ""
    setForm({
      name: modell,
      kategorie,
      hersteller,
      seriennummer: item.seriennummer || "",
      standort,
      status: item.status || "verfügbar",
      bemerkung: item.bemerkung || "",
    })
    setShowForm(true)
  }

  function handleChange(e) {
    const { name, value } = e.target

    if (name === "hersteller") {
      setForm({ ...form, hersteller: value, kategorie: "", name: "" })
      return
    }

    if (name === "kategorie") {
      setForm({ ...form, kategorie: value, name: "" })
      return
    }

    if (name === "seriennummer") {
      const normalizedSerial = value.toUpperCase().replace(/\s+/g, "")
      setForm({ ...form, seriennummer: normalizedSerial })
      return
    }

    setForm({ ...form, [name]: value })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const item = {
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

  const gefiltert = inventar.filter((x) => {
    const haystack = [
      x.id,
      x.name,
      x.kategorie,
      x.hersteller,
      x.seriennummer,
      x.standort,
      x.status,
      x.bemerkung,
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLowerCase()

    const matchesSearch =
      haystack.includes(search.trim().toLowerCase())

    const matchesStatus =
      statusFilter === "alle" ? true : x.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const standorte = TEKO_STANDORTE.map((ort) => {
    const anzahl = inventar.filter((item) => item.standort === ort).length
    return [ort, anzahl]
  })

  const kategorieOptionen = form.hersteller ? Object.keys(DEVICE_CATALOG[form.hersteller]) : []
  const modellOptionen = form.hersteller && form.kategorie
    ? DEVICE_CATALOG[form.hersteller][form.kategorie]
    : []

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
            <div className="userMeta">
              <strong>{username || "Administrator"}</strong>
              <p>angemeldet</p>
            </div>
            <button
              onClick={handleLogout}
              className="logoutBtn"
              title="Abmelden"
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
              {activePage === "Inventar" && (
                <div className="search">
                  <Search size={22} />
                  <input
                    placeholder="Modell, SN, Hersteller suchen..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}

              <button className="bell">
                <Bell size={22} />
              </button>

                <button
                  onClick={handleLogout}
                  className="headerLogoutBtn"
                  title="Abmelden"
                >
                  <LogOut size={22} />
                </button>
            </div>
          </header>

          {activePage === "Dashboard" && (
            <DashboardPage inventar={inventar} standorte={TEKO_STANDORTE} />
          )}

          {activePage === "Inventar" && (
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
                  value={inventar.filter((x) => x.status === "verfügbar").length}
                  text="Bereit zur Nutzung"
                  onClick={() => setStatusFilter("verfügbar")}
                  active={statusFilter === "verfügbar"}
                />

                <Card
                  color="orange"
                  icon={<Clock3 />}
                  title="Ausgeliehen"
                  value={inventar.filter((x) => x.status === "ausgeliehen").length}
                  text="Aktuell ausgeliehen"
                  onClick={() => setStatusFilter("ausgeliehen")}
                  active={statusFilter === "ausgeliehen"}
                />

                <Card
                  color="red"
                  icon={<AlertTriangle />}
                  title="Defekt"
                  value={inventar.filter((x) => x.status === "defekt").length}
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
            <ReportPage inventar={inventar} standorte={TEKO_STANDORTE} />
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
                <select name="hersteller" value={form.hersteller} onChange={handleChange} required>
                  <option value="" disabled>Hersteller wählen</option>
                  {HERSTELLER_OPTIONEN.map((hersteller) => (
                    <option key={hersteller} value={hersteller}>{hersteller}</option>
                  ))}
                </select>

                <select name="kategorie" value={form.kategorie} onChange={handleChange} required disabled={!form.hersteller}>
                  <option value="" disabled>Kategorie wählen</option>
                  {kategorieOptionen.map((kategorie) => (
                    <option key={kategorie} value={kategorie}>{kategorie}</option>
                  ))}
                </select>

                <select name="name" value={form.name} onChange={handleChange} required disabled={!form.kategorie}>
                  <option value="" disabled>Modell wählen</option>
                  {modellOptionen.map((modell) => (
                    <option key={modell} value={modell}>{modell}</option>
                  ))}
                </select>

                <input
                  name="seriennummer"
                  placeholder="Seriennummer (optional)"
                  value={form.seriennummer}
                  onChange={handleChange}
                  pattern="[A-Za-z0-9][A-Za-z0-9\-_/\.]{5,39}"
                  title="Optional: 6-40 Zeichen, erlaubt A-Z 0-9 sowie - _ . /"
                />
                <select name="standort" value={form.standort} onChange={handleChange} required>
                  <option value="" disabled>Standort wählen</option>
                  {TEKO_STANDORTE.map((ort) => (
                    <option key={ort} value={ort}>{ort}</option>
                  ))}
                </select>

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

function DashboardPage({ inventar, standorte }) {
  const verfuegbar = inventar.filter((x) => x.status === "verfügbar").length
  const ausgeliehen = inventar.filter((x) => x.status === "ausgeliehen").length
  const defekt = inventar.filter((x) => x.status === "defekt").length

  const statusData = [
    { name: "Verfügbar", value: verfuegbar, color: "#22c55e" },
    { name: "Ausgeliehen", value: ausgeliehen, color: "#f59e0b" },
    { name: "Defekt", value: defekt, color: "#ef4444" },
  ]

  const standortData = standorte.map((ort) => ({
    name: ort,
    count: inventar.filter((item) => item.standort === ort).length,
  }))

  return (
    <section className="dashboard">
      <div className="dashGrid">
        <div className="dashCard kpi">
          <div className="kpiIcon blue">
            <Monitor size={28} />
          </div>
          <div className="kpiText">
            <span>Gesamtgeräte</span>
            <strong>{inventar.length}</strong>
            <p>Alle Geräte im System</p>
          </div>
        </div>

        <div className="dashCard kpi">
          <div className="kpiIcon green">
            <CheckCircle size={28} />
          </div>
          <div className="kpiText">
            <span>Verfügbar</span>
            <strong>{verfuegbar}</strong>
            <p>Bereit zur Nutzung</p>
          </div>
        </div>

        <div className="dashCard kpi">
          <div className="kpiIcon orange">
            <Clock3 size={28} />
          </div>
          <div className="kpiText">
            <span>Ausgeliehen</span>
            <strong>{ausgeliehen}</strong>
            <p>Aktuell ausgeliehen</p>
          </div>
        </div>

        <div className="dashCard kpi alert">
          <div className="kpiIcon red">
            <AlertTriangle size={28} />
          </div>
          <div className="kpiText">
            <span>Defekt</span>
            <strong>{defekt}</strong>
            <p>Benötigen Reparatur</p>
          </div>
        </div>
      </div>

      <div className="chartsGrid">
        <div className="dashCard chart">
          <h3>Status Übersicht</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="dashCard chart">
          <h3>Geräte nach Standort</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={standortData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}

function ReportPage({ inventar, standorte }) {
  const gesamt = inventar.length
  const verfuegbar = inventar.filter((x) => x.status === "verfügbar").length
  const ausgeliehen = inventar.filter((x) => x.status === "ausgeliehen").length
  const defekt = inventar.filter((x) => x.status === "defekt").length
  const defektQuote = gesamt === 0 ? 0 : Math.round((defekt / gesamt) * 100)

  const standortStatusData = standorte.map((ort) => ({
    name: ort,
    verfügbar: inventar.filter((x) => x.standort === ort && x.status === "verfügbar").length,
    ausgeliehen: inventar.filter((x) => x.standort === ort && x.status === "ausgeliehen").length,
    defekt: inventar.filter((x) => x.standort === ort && x.status === "defekt").length,
  }))

  const kategorieMap = {}
  inventar.forEach((item) => {
    const key = item.kategorie || "Unbekannt"
    kategorieMap[key] = (kategorieMap[key] || 0) + 1
  })
  const kategorieData = Object.entries(kategorieMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7)

  const defektListe = inventar
    .filter((x) => x.status === "defekt")
    .slice(0, 10)

  return (
    <section className="dashboard">
      <div className="dashGrid">
        <div className="dashCard kpi">
          <div className="kpiIcon blue">
            <Monitor size={28} />
          </div>
          <div className="kpiText">
            <span>Gesamtgeräte</span>
            <strong>{gesamt}</strong>
            <p>Basis für alle Auswertungen</p>
          </div>
        </div>

        <div className="dashCard kpi">
          <div className="kpiIcon green">
            <CheckCircle size={28} />
          </div>
          <div className="kpiText">
            <span>Verfügbar-Quote</span>
            <strong>{gesamt === 0 ? 0 : Math.round((verfuegbar / gesamt) * 100)}%</strong>
            <p>{verfuegbar} von {gesamt} einsatzbereit</p>
          </div>
        </div>

        <div className="dashCard kpi">
          <div className="kpiIcon orange">
            <Clock3 size={28} />
          </div>
          <div className="kpiText">
            <span>Aktiv genutzt</span>
            <strong>{ausgeliehen}</strong>
            <p>Geräte im Umlauf</p>
          </div>
        </div>

        <div className="dashCard kpi alert">
          <div className="kpiIcon red">
            <AlertTriangle size={28} />
          </div>
          <div className="kpiText">
            <span>Defektquote</span>
            <strong>{defektQuote}%</strong>
            <p>{defekt} Geräte mit Handlungsbedarf</p>
          </div>
        </div>
      </div>

      <div className="chartsGrid">
        <div className="dashCard chart">
          <h3>Standorte nach Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={standortStatusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="verfügbar" stackId="a" fill="#22c55e" />
              <Bar dataKey="ausgeliehen" stackId="a" fill="#f59e0b" />
              <Bar dataKey="defekt" stackId="a" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dashCard chart">
          <h3>Top Kategorien</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={kategorieData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <section className="tableBox" style={{ marginTop: 24 }}>
        <div className="tableHead">
          <div>
            <h2>Defekte Geräte (Top 10)</h2>
            <p>Priorisierte Liste für Reparatur und Austausch</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Gerät</th>
              <th>Kategorie</th>
              <th>Standort</th>
              <th>Bemerkung</th>
            </tr>
          </thead>
          <tbody>
            {defektListe.length === 0 ? (
              <tr>
                <td colSpan={5}>Keine defekten Geräte vorhanden.</td>
              </tr>
            ) : (
              defektListe.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.kategorie}</td>
                  <td>{item.standort}</td>
                  <td>{item.bemerkung || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </section>
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
              <th>Modell</th>
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

                <th>Modell</th>
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

.userMeta {
  flex: 1;
  min-width: 0;
}

.userMeta strong {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.logoutBtn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 0;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  flex-shrink: 0;
}

.logoutBtn:hover {
  background: rgba(148, 163, 184, 0.16);
  color: #dbeafe;
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

  .headerLogoutBtn {
    width: 62px;
    height: 62px;
    border-radius: 12px;
    border: 1px solid #e5eaf2;
    background: white;
    cursor: pointer;
    color: #ef4444;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .headerLogoutBtn:hover {
    background: #fee2e2;
    border-color: #fca5a5;
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

.dashboard {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.dashGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}

.dashCard {
  background: white;
  border-radius: 16px;
  border: 1px solid #e5eaf2;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.dashCard:hover {
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.dashCard.kpi {
  display: flex;
  align-items: center;
  gap: 18px;
}

.dashCard.kpi.alert {
  border-color: #fecaca;
  background: #fef2f2;
}

.kpiIcon {
  width: 60px;
  height: 60px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  flex-shrink: 0;
}

.kpiIcon.blue {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
}

.kpiIcon.green {
  background: linear-gradient(135deg, #22c55e, #15803d);
}

.kpiIcon.orange {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.kpiIcon.red {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.kpiText {
  flex: 1;
}

.kpiText span {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.kpiText strong {
  display: block;
  font-size: 32px;
  margin: 6px 0;
  color: #0f172a;
}

.kpiText p {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

.chartsGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
}

.dashCard.chart {
  padding: 28px;
}

.dashCard.chart h3 {
  margin: 0 0 20px;
  font-size: 18px;
  color: #0f172a;
}

@media (max-width: 1300px) {
  .dashGrid {
    grid-template-columns: repeat(2, 1fr);
  }

  .chartsGrid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .dashGrid {
    grid-template-columns: 1fr;
  }

  .dashCard.kpi {
    flex-direction: row;
  }

  .chartsGrid {
    grid-template-columns: 1fr;
  }
}
`