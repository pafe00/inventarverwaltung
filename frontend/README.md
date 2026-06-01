# Frontend

React/Vite Frontend fuer die Inventarverwaltung.

## Start

```bash
npm install
npm run dev
```

## Build und Production-Start

```bash
npm run build
npm start
```

## Umgebungsvariablen

In `frontend/.env.local`:

```bash
VITE_API_URL=http://localhost:8000
VITE_WRITE_API_KEY=<api-key-fuer-schreibzugriffe>
```

Hinweis: `VITE_WRITE_API_KEY` wird an das Backend als `x-api-key` fuer `POST`, `PUT`, `DELETE` gesendet.
