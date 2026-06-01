import { useState } from "react"
import { LogIn, UserPlus, Package } from "lucide-react"

const API_URL =
  "https://inventarwebapp-linux-ejb2a7cpcdchhpg9.germanywestcentral-01.azurewebsites.net"

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login") // "login" | "register"
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const endpoint = mode === "login" ? "/api/login" : "/api/register"
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || "Fehler beim Anmelden")
        return
      }
      if (mode === "register") {
        setMode("login")
        setError("")
        setUsername("")
        setPassword("")
        return
      }
      // login successful
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("username", data.username)
      onLogin(data.access_token, data.username)
    } catch {
      setError("Verbindungsfehler zum Server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-2xl mb-3">
            <Package size={32} className="text-white" />
          </div>
          <h1 className="text-white text-2xl font-bold">Inventarverwaltung</h1>
          <p className="text-gray-400 text-sm mt-1">TEKO Schweiz</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          {/* Tab switcher */}
          <div className="flex bg-gray-800 rounded-lg p-1 mb-6">
            <button
              onClick={() => { setMode("login"); setError("") }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <LogIn size={15} />
              Anmelden
            </button>
            <button
              onClick={() => { setMode("register"); setError("") }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "register"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <UserPlus size={15} />
              Registrieren
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Benutzername</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                minLength={3}
                placeholder="benutzername"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Passwort</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {mode === "register" && !error && (
              <p className="text-green-400 text-xs hidden" id="success-msg">
                Registrierung erfolgreich! Bitte anmelden.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {loading
                ? "Bitte warten..."
                : mode === "login"
                ? "Anmelden"
                : "Registrieren"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
