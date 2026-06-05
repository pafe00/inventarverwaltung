from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, validator
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn
import pyodbc
import os
import re
import logging

# --- Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Rate Limiting ---
limiter = Limiter(key_func=get_remote_address)

# --- Auth config ---
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("FEHLER: JWT_SECRET muss als Umgebungsvariable gesetzt sein!")

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 8
MAX_PASSWORD_LENGTH = 128
MAX_EMAIL_LENGTH = 255
MAX_REQUEST_SIZE = 1024 * 100  # 100KB

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


def validate_password_strength(value: str) -> None:
    pattern = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$"
    if not re.fullmatch(pattern, value):
        raise HTTPException(
            status_code=400,
            detail="Passwort muss mindestens 8 Zeichen haben sowie Gross-/Kleinbuchstaben und 1 Sonderzeichen enthalten"
        )

app = FastAPI(
    title="Inventarverwaltung API",
    description="Backend für cloudbasierte Inventarverwaltung",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None
)

app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Zu viele Login-Versuche. Bitte kurz warten und erneut versuchen."}
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

@app.on_event("startup")
def startup_event():
    """Initialize database tables on app startup"""
    try:
        connection = get_connection()
        cursor = connection.cursor()
        ensure_users_table(cursor)
        connection.commit()
        cursor.close()
        logger.info("Database initialization completed on startup")
    except Exception as e:
        logger.warning(f"Database initialization warning: {e}")
        # Don't fail startup if DB init fails - it might already exist

DB_PASSWORD = os.getenv("SQL_PASSWORD")
DB_SERVER = os.getenv("SQL_SERVER", "tcp:inventarsqlg6.database.windows.net,1433")
DB_DATABASE = os.getenv("SQL_DATABASE", "inventarsqlg6")
DB_USER = os.getenv("SQL_USER", "inventaradmin")
DB_DRIVER = os.getenv("SQL_DRIVER", "ODBC Driver 18 for SQL Server")
DB_ENCRYPT = os.getenv("SQL_ENCRYPT", "yes")
DB_TRUST_SERVER_CERT = os.getenv("SQL_TRUST_SERVER_CERTIFICATE", "no")
DB_TIMEOUT = os.getenv("SQL_TIMEOUT", "30")

CONNECTION_STRING = (
    f"Driver={{{DB_DRIVER}}};"
    f"Server={DB_SERVER};"
    f"Database={DB_DATABASE};"
    f"Uid={DB_USER};"
    f"Pwd={DB_PASSWORD};"
    f"Encrypt={DB_ENCRYPT};"
    f"TrustServerCertificate={DB_TRUST_SERVER_CERT};"
    f"Connection Timeout=10;"  # Reduced from 30 to 10 seconds
)

# Global connection pool (simple cache-like mechanism)
_db_connection = None
_db_connection_time = 0
DB_CONNECTION_TTL = 3600  # Recycle connection every hour


def get_connection():
    """Get a database connection with simple pooling"""
    global _db_connection, _db_connection_time
    import time
    
    if not DB_PASSWORD:
        logger.error("DB_PASSWORD nicht gesetzt")
        raise HTTPException(status_code=500, detail="Serverfehler")
    
    # Recycle connection if too old
    current_time = time.time()
    needs_reconnect = _db_connection is None or (current_time - _db_connection_time) > DB_CONNECTION_TTL

    # Validate pooled connection before reusing it.
    if not needs_reconnect and _db_connection is not None:
        try:
            health_cursor = _db_connection.cursor()
            health_cursor.execute("SELECT 1")
            health_cursor.close()
        except pyodbc.Error:
            needs_reconnect = True

    if needs_reconnect:
        if _db_connection:
            try:
                _db_connection.close()
            except:
                pass
        
        try:
            _db_connection = pyodbc.connect(CONNECTION_STRING, autocommit=False)
            _db_connection_time = current_time
            logger.info("New DB connection established")
        except pyodbc.Error as exc:
            _db_connection = None
            logger.error(f"DB Connection Error: {exc}")
            raise HTTPException(status_code=503, detail="Datenbankverbindung nicht möglich")
    
    return _db_connection


def ensure_users_table(cursor):
    """Ensure users table exists (called only once on startup)"""
    cursor.execute("""
    IF NOT EXISTS (
        SELECT * FROM sysobjects
        WHERE name='users' AND xtype='U'
    )
    CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
    """)


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
    id: int = Field(..., gt=0, le=2147483647)
    name: str = Field(..., min_length=1, max_length=255)
    kategorie: str = Field(..., min_length=1, max_length=255)
    hersteller: Optional[str] = Field(None, max_length=255)
    seriennummer: Optional[str] = Field(None, max_length=255)
    standort: str = Field(..., min_length=1, max_length=255)
    status: str = Field(..., pattern="^(verfügbar|ausgeliehen|defekt)$")
    bemerkung: Optional[str] = Field(None, max_length=500)
    
    @validator('name', 'kategorie', 'hersteller', 'seriennummer', 'standort', 'bemerkung', pre=True)
    def sanitize_strings(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            v = v.strip()
            if len(v) > 500:
                raise ValueError("Input zu lang")
            # Keine SQL-Injection möglich durch Parameterized Queries, aber dennoch sanitize
            if '<script' in v.lower() or 'javascript:' in v.lower():
                raise ValueError("Ungültiges Zeichen in Input")
        return v


class UserCredentials(BaseModel):
    username: str = Field(..., min_length=3, max_length=MAX_EMAIL_LENGTH)
    password: str = Field(..., min_length=8, max_length=MAX_PASSWORD_LENGTH)
    
    @validator('username')
    def validate_username(cls, v):
        if len(v) > MAX_EMAIL_LENGTH:
            raise ValueError(f"Username zu lang (max {MAX_EMAIL_LENGTH})")
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError("Ungültige Email-Format")
        return v.strip().lower()
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) > MAX_PASSWORD_LENGTH:
            raise ValueError(f"Passwort zu lang (max {MAX_PASSWORD_LENGTH})")
        return v


@app.get("/")
def root():
    return {
        "service": "Inventarverwaltung API",
        "status": "online",
        "message": "Backend der Inventarverwaltung läuft.",
        "access": "API-Zugriff ist nur für das autorisierte Frontend vorgesehen."
    }


@app.post("/api/register")
@limiter.limit("15/15 minutes")
def register(request: Request, credentials: UserCredentials):
    email = normalize_teko_email(credentials.username)
    validate_password_strength(credentials.password)
    
    connection = get_connection()
    cursor = connection.cursor()
    
    try:
        cursor.execute("SELECT id FROM users WHERE LOWER(username) = ?", (email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="User existiert bereits")
        
        hashed = pwd_context.hash(credentials.password)
        cursor.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (email, hashed)
        )
        connection.commit()
        logger.info(f"User registriert: {email[:10]}...")
        return {"message": "Registrierung erfolgreich"}
    except HTTPException:
        raise
    except Exception as e:
        connection.rollback()
        logger.error(f"Register error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=400, detail="Registrierung fehlgeschlagen")
    finally:
        try:
            cursor.close()
        except:
            pass


@app.post("/api/login")
@limiter.limit("15/15 minutes")
def login(request: Request, credentials: UserCredentials):
    email = normalize_teko_email(credentials.username)
    connection = get_connection()  # Uses connection pool now (fast!)
    cursor = connection.cursor()
    
    try:
        cursor.execute(
            "SELECT password_hash FROM users WHERE LOWER(username) = ?",
            (email,)
        )
        row = cursor.fetchone()
        
        if not row or not pwd_context.verify(credentials.password, row[0]):
            logger.warning(f"Failed login attempt: {email[:10]}...")
            raise HTTPException(status_code=401, detail="Ungültiger Login")
        
        token = create_token(email)
        logger.info(f"User logged in: {email[:10]}...")
        return {"access_token": token, "token_type": "bearer", "username": email}
    finally:
        try:
            cursor.close()
        except:
            pass


@app.get("/api/inventar")
@limiter.limit("30/15 minutes")
def get_inventar(request: Request, username: str = Depends(verify_token)):
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
@limiter.limit("30/15 minutes")
def get_item(request: Request, item_id: int, username: str = Depends(verify_token)):
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
@limiter.limit("10/15 minutes")
def create_item(request: Request, item: InventarItem, _: str = Depends(verify_token)):
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
@limiter.limit("10/15 minutes")
def update_item(request: Request, item_id: int, item: InventarItem, _: str = Depends(verify_token)):
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
@limiter.limit("10/15 minutes")
def delete_item(request: Request, item_id: int, _: str = Depends(verify_token)):
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
