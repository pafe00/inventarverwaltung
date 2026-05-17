from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://inventarfrontend-hsfubmgge0arhag8.germanywestcentral-01.azurewebsites.net"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONNECTION_STRING = os.getenv("DATABASE_URL")


def get_connection():
    return pyodbc.connect(CONNECTION_STRING)


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
def create_item(item: InventarItem):
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
def update_item(item_id: int, item: InventarItem):
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
def delete_item(item_id: int):
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