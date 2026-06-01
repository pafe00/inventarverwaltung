from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
import uvicorn
import pyodbc
import os
import re

# --- Auth config ---
JWT_SECRET = os.getenv("JWT_SECRET", "J345GJH345JH6G3J45GJ4H5GJ346JH345GHJ463JHRVJH")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 8

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()
ALLOWED_EMAIL_DOMAIN = "edu.teko.ch"


def create_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Ungültiger Token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Ungültiger oder abgelaufener Token")


def normalize_teko_email(value: str) -> str:
    email = value.strip().lower()
    pattern = rf"^[^@\s]+@{re.escape(ALLOWED_EMAIL_DOMAIN)}$"
    if not re.fullmatch(pattern, email):
        raise HTTPException(
            status_code=400,
            detail=f"Nur E-Mail-Adressen mit @{ALLOWED_EMAIL_DOMAIN} sind erlaubt"
        )
    return email

app = FastAPI(
    title="Inventarverwaltung API",
    description="Backend für cloudbasierte Inventarverwaltung",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None
)

DEFAULT_CORS_ORIGINS = [
    "https://inventarfrontend-hsfubmgge0arhag8.germanywestcentral-01.azurewebsites.net",
    "https://teko-inventar.ch",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]
cors_origins_raw = os.getenv("CORS_ALLOW_ORIGINS", "")
allowed_origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]
if not allowed_origins:
    allowed_origins = DEFAULT_CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
DB_PASSWORD = os.getenv("SQL_PASSWORD")

CONNECTION_STRING = (
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=tcp:inventarsqlg6.database.windows.net,1433;"
    "Database=inventarsqlg6;"
    "Uid=inventaradmin;"
    f"Pwd={DB_PASSWORD};"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
    "Connection Timeout=30;"
)


def get_connection():
    if not DB_PASSWORD:
        raise HTTPException(status_code=500, detail="Server-Konfiguration fehlt: SQL_PASSWORD")
    try:
        return pyodbc.connect(CONNECTION_STRING)
    except pyodbc.Error:
        raise HTTPException(status_code=503, detail="Datenbankverbindung fehlgeschlagen")


def init_database():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
    IF NOT EXISTS (
        SELECT * FROM sysobjects
        WHERE name='inventar' AND xtype='U'
    )
    CREATE TABLE inventar (
        id INT PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        kategorie NVARCHAR(255) NOT NULL,
        hersteller NVARCHAR(255),
        seriennummer NVARCHAR(255),
        standort NVARCHAR(255) NOT NULL,
        status NVARCHAR(50) NOT NULL,
        bemerkung NVARCHAR(500)
    )
    """)

    connection.commit()
    connection.close()


#init_database()


class InventarItem(BaseModel):
    id: int
    name: str = Field(..., min_length=2)
    kategorie: str
    hersteller: Optional[str] = None
    seriennummer: Optional[str] = None
    standort: str
    status: str = Field(..., pattern="^(verfügbar|ausgeliehen|defekt)$")
    bemerkung: Optional[str] = None


class UserCredentials(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6)


@app.get("/")
def root():
    return {
        "service": "Inventarverwaltung API",
        "status": "online",
        "message": "Backend der Inventarverwaltung läuft.",
        "access": "API-Zugriff ist nur für das autorisierte Frontend vorgesehen."
    }


@app.post("/api/register")
def register(credentials: UserCredentials):
    email = normalize_teko_email(credentials.username)
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT id FROM users WHERE LOWER(username) = ?", (email,))
    if cursor.fetchone():
        connection.close()
        raise HTTPException(status_code=400, detail="E-Mail bereits vergeben")
    hashed = pwd_context.hash(credentials.password)
    cursor.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        (email, hashed)
    )
    connection.commit()
    connection.close()
    return {"message": "Benutzer erfolgreich registriert"}


@app.post("/api/login")
def login(credentials: UserCredentials):
    email = normalize_teko_email(credentials.username)
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute(
        "SELECT password_hash FROM users WHERE LOWER(username) = ?",
        (email,)
    )
    row = cursor.fetchone()
    connection.close()
    if not row or not pwd_context.verify(credentials.password, row[0]):
        raise HTTPException(status_code=401, detail="Falsche E-Mail oder Passwort")
    token = create_token(email)
    return {"access_token": token, "token_type": "bearer", "username": email}


@app.get("/api/inventar")
def get_inventar():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            id,
            name,
            kategorie,
            hersteller,
            seriennummer,
            standort,
            status,
            bemerkung
        FROM inventar
        ORDER BY id
    """)

    rows = cursor.fetchall()
    connection.close()

    inventar = []

    for row in rows:
        inventar.append({
            "id": row[0],
            "name": row[1],
            "kategorie": row[2],
            "hersteller": row[3],
            "seriennummer": row[4],
            "standort": row[5],
            "status": row[6],
            "bemerkung": row[7]
        })

    return inventar


@app.get("/api/inventar/{item_id}")
def get_item(item_id: int):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            id,
            name,
            kategorie,
            hersteller,
            seriennummer,
            standort,
            status,
            bemerkung
        FROM inventar
        WHERE id = ?
    """, (item_id,))

    row = cursor.fetchone()
    connection.close()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Gerät nicht gefunden"
        )

    return {
        "id": row[0],
        "name": row[1],
        "kategorie": row[2],
        "hersteller": row[3],
        "seriennummer": row[4],
        "standort": row[5],
        "status": row[6],
        "bemerkung": row[7]
    }


@app.post("/api/inventar")
def create_item(item: InventarItem, _: str = Depends(verify_token)):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT id FROM inventar WHERE id = ?",
        (item.id,)
    )

    existing = cursor.fetchone()

    if existing:
        connection.close()
        raise HTTPException(
            status_code=400,
            detail="ID existiert bereits"
        )

    cursor.execute("""
        INSERT INTO inventar (
            id,
            name,
            kategorie,
            hersteller,
            seriennummer,
            standort,
            status,
            bemerkung
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            item.id,
            item.name,
            item.kategorie,
            item.hersteller,
            item.seriennummer,
            item.standort,
            item.status,
            item.bemerkung
        )
    )

    connection.commit()
    connection.close()

    return {
        "message": "Gerät wurde erfolgreich erstellt",
        "item": item
    }


@app.put("/api/inventar/{item_id}")
def update_item(item_id: int, item: InventarItem, _: str = Depends(verify_token)):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        UPDATE inventar
        SET
            name = ?,
            kategorie = ?,
            hersteller = ?,
            seriennummer = ?,
            standort = ?,
            status = ?,
            bemerkung = ?
        WHERE id = ?
    """,
        (
            item.name,
            item.kategorie,
            item.hersteller,
            item.seriennummer,
            item.standort,
            item.status,
            item.bemerkung,
            item_id
        )
    )

    if cursor.rowcount == 0:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Gerät nicht gefunden"
        )

    connection.commit()
    connection.close()

    return {
        "message": "Gerät wurde aktualisiert"
    }


@app.delete("/api/inventar/{item_id}")
def delete_item(item_id: int, _: str = Depends(verify_token)):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "DELETE FROM inventar WHERE id = ?",
        (item_id,)
    )

    if cursor.rowcount == 0:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Gerät nicht gefunden"
        )

    connection.commit()
    connection.close()

    return {
        "message": "Gerät wurde gelöscht"
    }


@app.get("/api/dashboard")
def get_dashboard():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("SELECT COUNT(*) FROM inventar")
    gesamt = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM inventar WHERE status = 'verfügbar'")
    verfuegbar = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM inventar WHERE status = 'ausgeliehen'")
    ausgeliehen = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM inventar WHERE status = 'defekt'")
    defekt = cursor.fetchone()[0]

    connection.close()

    return {
        "gesamt": gesamt,
        "verfügbar": verfuegbar,
        "ausgeliehen": ausgeliehen,
        "defekt": defekt
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
