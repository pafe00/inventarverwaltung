from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

app = FastAPI(
    title="Inventarverwaltung API",
    description="Backend für cloudbasierte Inventarverwaltung",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class InventarItem(BaseModel):
    id: int
    name: str = Field(..., min_length=2)
    kategorie: str
    hersteller: Optional[str] = None
    seriennummer: Optional[str] = None
    standort: str
    status: str = Field(..., pattern="^(verfügbar|ausgeliehen|defekt)$")
    bemerkung: Optional[str] = None

inventar = [
    {
        "id": 1,
        "name": "Laptop Dell Latitude",
        "kategorie": "Laptop",
        "hersteller": "Dell",
        "seriennummer": "DL-1001",
        "standort": "Olten",
        "status": "verfügbar",
        "bemerkung": "Einsatzbereit"
    },
    {
        "id": 2,
        "name": "Monitor Samsung",
        "kategorie": "Monitor",
        "hersteller": "Samsung",
        "seriennummer": "SM-2001",
        "standort": "Bern",
        "status": "ausgeliehen",
        "bemerkung": "Bei Benutzer ausgeliehen"
    },
    {
        "id": 3,
        "name": "Tastatur Logitech",
        "kategorie": "Zubehör",
        "hersteller": "Logitech",
        "seriennummer": "LG-3001",
        "standort": "Zürich",
        "status": "defekt",
        "bemerkung": "Taste defekt"
    }
]

@app.get("/")
def root():
    return {"message": "Inventarverwaltung Backend läuft"}

@app.get("/api/inventar")
def get_inventar(
    status: Optional[str] = None,
    standort: Optional[str] = None,
    kategorie: Optional[str] = None
):
    result = inventar

    if status:
        result = [item for item in result if item["status"].lower() == status.lower()]

    if standort:
        result = [item for item in result if item["standort"].lower() == standort.lower()]

    if kategorie:
        result = [item for item in result if item["kategorie"].lower() == kategorie.lower()]

    return result

@app.get("/api/inventar/{item_id}")
def get_item(item_id: int):
    for item in inventar:
        if item["id"] == item_id:
            return item

    raise HTTPException(status_code=404, detail="Gerät nicht gefunden")

@app.post("/api/inventar")
def create_item(item: InventarItem):
    for existing_item in inventar:
        if existing_item["id"] == item.id:
            raise HTTPException(status_code=400, detail="ID existiert bereits")

    inventar.append(item.model_dump())

    return {
        "message": "Gerät wurde erfolgreich erfasst",
        "item": item
    }

@app.put("/api/inventar/{item_id}")
def update_item(item_id: int, updated_item: InventarItem):
    for index, item in enumerate(inventar):
        if item["id"] == item_id:
            inventar[index] = updated_item.model_dump()
            return {
                "message": "Gerät wurde erfolgreich aktualisiert",
                "item": updated_item
            }

    raise HTTPException(status_code=404, detail="Gerät nicht gefunden")

@app.delete("/api/inventar/{item_id}")
def delete_item(item_id: int):
    for index, item in enumerate(inventar):
        if item["id"] == item_id:
            deleted_item = inventar.pop(index)
            return {
                "message": "Gerät wurde gelöscht",
                "item": deleted_item
            }

    raise HTTPException(status_code=404, detail="Gerät nicht gefunden")

@app.get("/api/dashboard")
def get_dashboard():
    total = len(inventar)
    verfuegbar = len([item for item in inventar if item["status"] == "verfügbar"])
    ausgeliehen = len([item for item in inventar if item["status"] == "ausgeliehen"])
    defekt = len([item for item in inventar if item["status"] == "defekt"])

    return {
        "gesamt": total,
        "verfügbar": verfuegbar,
        "ausgeliehen": ausgeliehen,
        "defekt": defekt
    }

    if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)