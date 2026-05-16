from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import uvicorn
import pyodbc

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

connection_string = (
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=tcp:inventarsqlg6.database.windows.net,1433;"
    "Database=inventarsqlg6;"
    "Uid=inventaradmin;"
    "Pwd=Sommer2026$;"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
    "Connection Timeout=30;"
)

connection = pyodbc.connect(connection_string)
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
    return {"message": "Inventarverwaltung Backend läuft"}

@app.get("/api/inventar")
def get_inventar():

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
    """, item_id)

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
def create_item(item: InventarItem):

    cursor.execute(
        "SELECT id FROM inventar WHERE id = ?",
        item.id
    )

    existing = cursor.fetchone()

    if existing:
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
        item.id,
        item.name,
        item.kategorie,
        item.hersteller,
        item.seriennummer,
        item.standort,
        item.status,
        item.bemerkung
    )

    connection.commit()

    return {
        "message": "Gerät wurde erfolgreich erstellt",
        "item": item
    }

@app.put("/api/inventar/{item_id}")
def update_item(item_id: int, item: InventarItem):

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
        item.name,
        item.kategorie,
        item.hersteller,
        item.seriennummer,
        item.standort,
        item.status,
        item.bemerkung,
        item_id
    )

    connection.commit()

    return {
        "message": "Gerät wurde aktualisiert"
    }

@app.delete("/api/inventar/{item_id}")
def delete_item(item_id: int):

    cursor.execute(
        "DELETE FROM inventar WHERE id = ?",
        item_id
    )

    connection.commit()

    return {
        "message": "Gerät wurde gelöscht"
    }

@app.get("/api/dashboard")
def get_dashboard():

    cursor.execute("SELECT COUNT(*) FROM inventar")
    gesamt = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*)
        FROM inventar
        WHERE status = 'verfügbar'
    """)
    verfuegbar = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*)
        FROM inventar
        WHERE status = 'ausgeliehen'
    """)
    ausgeliehen = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*)
        FROM inventar
        WHERE status = 'defekt'
    """)
    defekt = cursor.fetchone()[0]

    return {
        "gesamt": gesamt,
        "verfügbar": verfuegbar,
        "ausgeliehen": ausgeliehen,
        "defekt": defekt
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)