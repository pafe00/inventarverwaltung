# Inventarverwaltung

Cloudbasierte Inventarverwaltung mit FastAPI-Backend und React/Vite-Frontend.

## Projektstruktur

- `backend`: FastAPI API mit SQL Server (Azure SQL)
- `frontend`: React UI (Vite) + Express-Server fuer Deployment

## Voraussetzungen

- Python 3.11+
- Node.js 20+
- ODBC Driver 18 for SQL Server

## Backend starten

1. Abhaengigkeiten installieren:

```bash
cd backend
pip install -r requirements.txt
```

2. Umgebungsvariablen setzen:

```bash
export SQL_SERVER="<server-hostname>"
export SQL_DATABASE="<database-name>"
export SQL_USER="<db-user>"
export SQL_PASSWORD="<db-password>"
export WRITE_API_KEY="<starker-api-key-fuer-schreibzugriffe>"
# optional
export ALLOWED_ORIGINS="http://localhost:5173,https://deine-domain.tld"
export SQL_DRIVER="ODBC Driver 18 for SQL Server"
```

3. API starten:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend starten

1. Abhaengigkeiten installieren:

```bash
cd frontend
npm install
```

2. Datei `frontend/.env.local` anlegen:

```bash
VITE_API_URL=http://localhost:8000
VITE_WRITE_API_KEY=<gleicher_key_wie_WRITE_API_KEY_im_backend>
```

3. Entwicklungsserver starten:

```bash
npm run dev
```

## Sicherheitshinweise

- Schreibzugriffe (`POST`, `PUT`, `DELETE`) sind mit `x-api-key` geschuetzt.
- Ohne `WRITE_API_KEY` werden Schreibzugriffe vom Backend mit `503` abgelehnt.
- Produktive Secrets niemals im Repository speichern.

## Deployment

Die GitHub Actions Workflows in `.github/workflows` deployen Backend und Frontend nach Azure Web Apps.