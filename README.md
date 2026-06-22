# Inventarverwaltung 📦

Eine Full-Stack-Anwendung zur Verwaltung von IT-Inventar mit FastAPI Backend und React Frontend.

## 🎯 Features

- **Sichere Authentifizierung** mit JWT-Tokens
- **Rollenbasierte Zugriffskontrolle**
- **Rate Limiting & Input Validation**
- **Swagger UI Dokumentation**
- **Moderne React Web-Oberfläche**

---

## 🚀 Quickstart

### Backend starten

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export JWT_SECRET="your-secret"
export SQL_PASSWORD="your-password"

python main.py
```

Backend läuft auf: **http://localhost:8000**  
API-Docs: **http://localhost:8000/docs**

### Frontend starten

```bash
cd frontend
npm install
npm run dev
```

Frontend läuft auf: **http://localhost:5173**

---

## 📚 Wichtigste Endpoints

- `POST /api/login` - Benutzer einloggen
- `GET /api/inventar` - Alle Items (geschützt)
- `POST /api/inventar` - Neues Item erstellen (geschützt)
- `GET /api/dashboard` - Statistiken (geschützt)

Alle Endpoints benötigen einen JWT-Token im Authorization-Header.

---

## 🏗️ Struktur

```
├── backend/          # FastAPI Server
│   ├── main.py
│   ├── requirements.txt
│   └── allowed_users.py
│
└── frontend/         # React + Vite
    ├── src/
    └── package.json
```

---

## 📝 Umgebungsvariablen

```bash
JWT_SECRET       # Erforderlich: Secret für Token-Signierung
SQL_PASSWORD     # Erforderlich: Datenbankpasswort
```

Optional: `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`

---

## 🛠️ Entwicklung

**Backend:**
```bash
uvicorn main:app --reload
```

**Frontend:**
```bash
npm run dev       # Development
npm run build     # Production Build
npm run lint      # ESLint
```

---

## 📞 Weitere Infos

- API Dokumentation: http://localhost:8000/docs
- Benutzerverwaltung: `backend/allowed_users.py`