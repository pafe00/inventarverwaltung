import { useState, useEffect } from "react"
import { Package } from "lucide-react"

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "")
const ALLOWED_USER_EMAILS = new Set([
  "bleart.azemi@edu.teko.ch",
  "daniel.petrovic@edu.teko.ch",
  "dorian.fuchs@edu.teko.ch",
  "eloy.figueroadelacruz@edu.teko.ch",
  "emanuel.wullschleger@edu.teko.ch",
  "felizian.strub@edu.teko.ch",
  "ilara.pignatella@edu.teko.ch",
  "marc.schneider@edu.teko.ch",
  "marius.hummel@edu.teko.ch",
  "nicola.walker@edu.teko.ch",
  "noel.hauser@edu.teko.ch",
  "patrick.feuz@edu.teko.ch",
  "suban.zuber@edu.teko.ch",
])

function isValidTekoEmail(value) {
  const email = value.trim().toLowerCase()
  return /^[^@\s]+@edu\.teko\.ch$/.test(email) && ALLOWED_USER_EMAILS.has(email)
}

function toErrorMessage(detail, fallback) {
  if (!detail) return fallback
  if (typeof detail === "string") return detail

  // FastAPI validation errors often come as an array of objects.
  if (Array.isArray(detail)) {
    const first = detail[0]
    if (typeof first === "string") return first
    if (first && typeof first === "object") {
      if (typeof first.msg === "string") return first.msg
      if (Array.isArray(first.loc)) return `${first.loc.join(".")}: ungültiger Wert`
    }
    return fallback
  }

  if (typeof detail === "object") {
    if (typeof detail.msg === "string") return detail.msg
    if (typeof detail.message === "string") return detail.message
    if (Array.isArray(detail.loc)) return `${detail.loc.join(".")}: ungültiger Wert`
  }

  return fallback
}

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Force-reset page styling when LoginPage mounts
  useEffect(() => {
    document.body.style.margin = "0"
    document.body.style.padding = "0"
    document.body.style.background = "radial-gradient(1200px 700px at 10% 0%, #d7f0ff 0%, #e9f7ff 35%, #f6fbff 100%)"
    return () => {
      // Cleanup not needed as next component will override
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")

    if (!isValidTekoEmail(username)) {
      setError("Diese E-Mail-Adresse ist für Inventarverwaltung nicht freigeschaltet")
      return
    }

    setLoading(true)
    try {
      const normalizedEmail = username.trim().toLowerCase()
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalizedEmail, password }),
      })

      let data = null
      const contentType = res.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        data = await res.json()
      } else {
        const text = await res.text()
        data = { detail: text }
      }

      if (!res.ok) {
        setError(toErrorMessage(data?.detail, `Serverfehler (${res.status})`))
        return
      }

      localStorage.setItem("token", data.access_token)
      localStorage.setItem("username", normalizedEmail)
      onLogin(data.access_token, normalizedEmail)
    } catch {
      setError("Verbindungsfehler zum Server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{css}</style>

      <div className="authPage">
        <div className="authGlow authGlowLeft" />
        <div className="authGlow authGlowRight" />

        <div className="authShell">
          <div className="authBrand">
            <div className="brandIconWrap">
              <Package size={34} />
            </div>
            <div>
              <h1>Inventarverwaltung</h1>
              <p>Schweizerische Fachschule TEKO</p>
            </div>
          </div>

          <div className="authCard">
            <form onSubmit={handleSubmit} className="authForm">
              <label>
                <span>TEKO E-Mail</span>
                <input
                  type="email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="vorname.nachname@edu.teko.ch"
                  pattern="^[^@\s]+@edu\.teko\.ch$"
                  title="Bitte eine E-Mail-Adresse mit @edu.teko.ch eingeben"
                  autoComplete="username"
                />
              </label>

              <label>
                <span>Passwort</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={1}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </label>

              {error && <p className="msg error">{error}</p>}

              <button type="submit" disabled={loading} className="submitBtn">
                {loading ? "Bitte warten..." : "Anmelden"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

const css = `
@import url("https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap");

* {
  box-sizing: border-box;
}

.authPage {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: radial-gradient(1200px 700px at 10% 0%, #d7f0ff 0%, #e9f7ff 35%, #f6fbff 100%);
  font-family: "Sora", sans-serif;
  position: relative;
  overflow: hidden;
}

.authGlow {
  position: absolute;
  width: 460px;
  height: 460px;
  border-radius: 50%;
  filter: blur(55px);
  opacity: .35;
  pointer-events: none;
}

.authGlowLeft {
  background: #4f46e5;
  top: -170px;
  left: -140px;
}

.authGlowRight {
  background: #0ea5e9;
  bottom: -180px;
  right: -120px;
}

.authShell {
  width: 100%;
  max-width: 460px;
  position: relative;
  z-index: 1;
}

.authBrand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.brandIconWrap {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(145deg, #1d4ed8, #0ea5e9);
  box-shadow: 0 16px 28px rgba(14, 116, 144, .35);
}

.authBrand h1 {
  margin: 0;
  font-size: 32px;
  line-height: 1.05;
  color: #0f172a;
}

.authBrand p {
  margin: 6px 0 0;
  color: #475569;
  font-size: 14px;
}

.authCard {
  background: rgba(255, 255, 255, .74);
  border: 1px solid rgba(15, 23, 42, .08);
  backdrop-filter: blur(8px);
  border-radius: 22px;
  padding: 18px;
  box-shadow: 0 24px 48px rgba(15, 23, 42, .12);
}

.authForm {
  display: grid;
  gap: 12px;
}

.authForm label span {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 7px;
}

.authForm input {
  width: 100%;
  height: 46px;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
  background: rgba(255, 255, 255, .87);
  padding: 0 13px;
  font-size: 15px;
  color: #0f172a;
  outline: none;
  transition: border-color .2s ease, box-shadow .2s ease;
}

.authForm input:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, .15);
}

.msg {
  margin: 2px 0 0;
  border-radius: 11px;
  padding: 10px 12px;
  font-size: 13px;
}

.msg.error {
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #9f1239;
}

.msg.success {
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.submitBtn {
  height: 48px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #1d4ed8, #0284c7);
  color: #fff;
  font-weight: 700;
  letter-spacing: .2px;
  cursor: pointer;
  box-shadow: 0 16px 28px rgba(2, 132, 199, .35);
  transition: transform .18s ease, filter .18s ease;
}

.submitBtn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.submitBtn:disabled {
  opacity: .65;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 640px) {
  .authPage {
    padding: 14px;
  }

  .authBrand h1 {
    font-size: 28px;
  }

  .authCard {
    border-radius: 18px;
    padding: 14px;
  }
}
`
