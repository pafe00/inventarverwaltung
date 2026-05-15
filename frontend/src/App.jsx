import { useEffect, useState } from "react";
import {
  Home,
  Package,
  MapPin,
  Settings,
  Bell,
  Plus,
  Trash2,
  Search,
} from "lucide-react";
import "./App.css";

function App() {
  const API_URL =
    "https://inventarwebapp-linux-ejb2a7cpcdchhpg9.germanywestcentral-01.azurewebsites.net";

  const [inventar, setInventar] = useState([]);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    id: "",
    name: "",
    kategorie: "",
    hersteller: "",
    seriennummer: "",
    standort: "",
    status: "verfügbar",
  });

  const ladeInventar = async () => {
    try {
      const response = await fetch(`${API_URL}/api/inventar`);
      const data = await response.json();
      setInventar(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    ladeInventar();
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const response = await fetch(`${API_URL}/api/inventar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        id: Number(form.id),
      }),
    });

    if (!response.ok) {
      alert("Fehler beim Speichern");
      return;
    }

    setForm({
      id: "",
      name: "",
      kategorie: "",
      hersteller: "",
      seriennummer: "",
      standort: "",
      status: "verfügbar",
    });

    ladeInventar();
  };

  const loeschen = async (id) => {
    await fetch(`${API_URL}/api/inventar/${id}`, {
      method: "DELETE",
    });

    ladeInventar();
  };

  const gefiltert = inventar.filter((item) =>
    item.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">⬢</div>

          <div>
            <h2>TEKO Inventar</h2>
            <p>Asset Management</p>
          </div>
        </div>

        <nav className="menu">
          <button className="menu-item active">
            <Home size={18} />
            Dashboard
          </button>

          <button className="menu-item">
            <Package size={18} />
            Inventar
          </button>

          <button className="menu-item">
            <MapPin size={18} />
            Standorte
          </button>

          <button className="menu-item">
            <Settings size={18} />
            Einstellungen
          </button>
        </nav>
      </aside>

      {/* MAIN */}
      <main className="main">
        {/* TOPBAR */}
        <header className="topbar">
          <div>
            <h1>Willkommen zurück 👋</h1>
            <p>Inventarübersicht</p>
          </div>

          <div className="topbar-right">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="Suche..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Bell />
          </div>
        </header>

        {/* CARDS */}
        <section className="cards">
          <div className="card">
            <h3>Gesamtgeräte</h3>
            <h2>{inventar.length}</h2>
          </div>

          <div className="card green">
            <h3>Verfügbar</h3>
            <h2>
              {
                inventar.filter((item) => item.status === "verfügbar").length
              }
            </h2>
          </div>

          <div className="card yellow">
            <h3>Ausgeliehen</h3>
            <h2>
              {
                inventar.filter((item) => item.status === "ausgeliehen").length
              }
            </h2>
          </div>

          <div className="card red">
            <h3>Defekt</h3>
            <h2>{inventar.filter((item) => item.status === "defekt").length}</h2>
          </div>
        </section>

        {/* FORM */}
        <section className="form-section">
          <div className="section-header">
            <h2>Neues Gerät</h2>

            <button className="blue-btn">
              <Plus size={18} />
              Hinzufügen
            </button>
          </div>

          <form onSubmit={handleSubmit} className="form-grid">
            <input
              name="id"
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

            <button type="submit" className="submit-btn">
              Speichern
            </button>
          </form>
        </section>

        {/* TABLE */}
        <section className="table-section">
          <h2>Inventarliste</h2>

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
                  <td>{item.name}</td>
                  <td>{item.kategorie}</td>
                  <td>{item.hersteller}</td>
                  <td>{item.standort}</td>

                  <td>
                    <span className={`status ${item.status}`}>
                      {item.status}
                    </span>
                  </td>

                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => loeschen(item.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

export default App;