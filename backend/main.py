from contextlib import contextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn
import pyodbc
import os

app = FastAPI(
    title="Inventarverwaltung API",
    description="Backend für cloudbasierte Inventarverwaltung",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None
)


def _parse_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS")
    if not raw:
        return [
            "https://inventarfrontend-hsfubmgge0arhag8.germanywestcentral-01.azurewebsites.net",
            "https://teko-inventar.ch",
        ]

    return [origin.strip() for origin in raw.split(",") if origin.strip()]


ALLOWED_ORIGINS = _parse_allowed_origins()
WRITE_API_KEY = os.getenv("WRITE_API_KEY")
DB_DRIVER = os.getenv("SQL_DRIVER", "ODBC Driver 18 for SQL Server")
DB_SERVER = os.getenv("SQL_SERVER")
DB_DATABASE = os.getenv("SQL_DATABASE")
DB_USER = os.getenv("SQL_USER")
DB_PASSWORD = os.getenv("SQL_PASSWORD")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _build_connection_string() -> str:
    missing = [
        name
        for name, value in (
            ("SQL_SERVER", DB_SERVER),
            ("SQL_DATABASE", DB_DATABASE),
            ("SQL_USER", DB_USER),
            ("SQL_PASSWORD", DB_PASSWORD),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(
            "Fehlende Datenbank-Umgebungsvariablen: " + ", ".join(missing)
        )

    return (
        f"Driver={{{DB_DRIVER}}};"
        f"Server=tcp:{DB_SERVER},1433;"
        f"Database={DB_DATABASE};"
        f"Uid={DB_USER};"
        f"Pwd={DB_PASSWORD};"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
        "Connection Timeout=30;"
    )


def get_connection():
    return pyodbc.connect(_build_connection_string())


@contextmanager
def get_db_cursor():
    connection = get_connection()
    cursor = connection.cursor()
    try:
        yield connection, cursor
    finally:
        connection.close()


def require_write_access(x_api_key: Optional[str] = Header(default=None)):
    if not WRITE_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="WRITE_API_KEY ist nicht konfiguriert"
        )

    if x_api_key != WRITE_API_KEY:
        raise HTTPException(status_code=401, detail="Ungültiger API-Key")


@app.exception_handler(pyodbc.Error)
def handle_db_error(_, __):
    return JSONResponse(
        status_code=500,
        content={"detail": "Datenbankfehler"}
    )


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


@app.get("/")
def root():
    return {
        "service": "Inventarverwaltung API",
        "status": "online",
        "message": "Backend der Inventarverwaltung läuft.",
        "access": "API-Zugriff ist nur für das autorisierte Frontend vorgesehen."
    }


@app.get("/api/inventar")
def get_inventar():
    with get_db_cursor() as (_, cursor):
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
    with get_db_cursor() as (_, cursor):
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
def create_item(
    item: InventarItem,
    _: None = Depends(require_write_access)
):
    with get_db_cursor() as (connection, cursor):
        try:
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
        except pyodbc.IntegrityError:
            connection.rollback()
            raise HTTPException(
                status_code=409,
                detail="ID existiert bereits"
            )

    return {
        "message": "Gerät wurde erfolgreich erstellt",
        "item": item
    }


@app.put("/api/inventar/{item_id}")
def update_item(
    item_id: int,
    item: InventarItem,
    _: None = Depends(require_write_access)
):
    with get_db_cursor() as (connection, cursor):
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
            raise HTTPException(
                status_code=404,
                detail="Gerät nicht gefunden"
            )

        connection.commit()

    return {
        "message": "Gerät wurde aktualisiert"
    }


@app.delete("/api/inventar/{item_id}")
def delete_item(
    item_id: int,
    _: None = Depends(require_write_access)
):
    with get_db_cursor() as (connection, cursor):
        cursor.execute(
            "DELETE FROM inventar WHERE id = ?",
            (item_id,)
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Gerät nicht gefunden"
            )

        connection.commit()

    return {
        "message": "Gerät wurde gelöscht"
    }


@app.get("/api/dashboard")
def get_dashboard():
    with get_db_cursor() as (_, cursor):
        cursor.execute("SELECT COUNT(*) FROM inventar")
        gesamt = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM inventar WHERE status = 'verfügbar'")
        verfuegbar = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM inventar WHERE status = 'ausgeliehen'")
        ausgeliehen = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM inventar WHERE status = 'defekt'")
        defekt = cursor.fetchone()[0]

    return {
        "gesamt": gesamt,
        "verfügbar": verfuegbar,
        "ausgeliehen": ausgeliehen,
        "defekt": defekt
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
