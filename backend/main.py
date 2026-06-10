from fastapi import FastAPI, HTTPException, Depends, Request, Query
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
import time
from allowed_users import ALLOWED_USER_EMAILS

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
AUTH_CACHE_TTL_SECONDS = int(os.getenv("AUTH_CACHE_TTL_SECONDS", "300"))

auth_password_cache = {}
auth_password_cache_loaded_at = 0.0

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


def ensure_email_is_allowed(email: str) -> None:
    if email not in ALLOWED_USER_EMAILS:
        raise HTTPException(
            status_code=403,
            detail="Diese E-Mail-Adresse ist für Inventarverwaltung nicht freigeschaltet"
        )


def validate_password_strength(value: str) -> None:
    pattern = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$"
    if not re.fullmatch(pattern, value):
        raise HTTPException(
            status_code=400,
            detail="Passwort muss mindestens 8 Zeichen haben sowie Gross-/Kleinbuchstaben und 1 Sonderzeichen enthalten"
        )


def refresh_auth_password_cache(force: bool = False) -> None:
    global auth_password_cache
    global auth_password_cache_loaded_at

    now = time.monotonic()
    cache_is_fresh = (
        auth_password_cache
        and (now - auth_password_cache_loaded_at) < AUTH_CACHE_TTL_SECONDS
    )
    if cache_is_fresh and not force:
        return

    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT LOWER(username), password_hash FROM users")
        rows = cursor.fetchall()

        updated_cache = {}
        for row in rows:
            username = row[0]
            password_hash = row[1]
            if username in ALLOWED_USER_EMAILS:
                updated_cache[username] = password_hash

        auth_password_cache = updated_cache
        auth_password_cache_loaded_at = now
    except Exception as exc:
        logger.warning(f"Auth cache refresh failed: {exc}")
    finally:
        try:
            if cursor:
                cursor.close()
        except:
            pass
        try:
            if connection:
                connection.close()
        except:
            pass


def get_cached_password_hash(email: str) -> Optional[str]:
    refresh_auth_password_cache(force=False)
    password_hash = auth_password_cache.get(email)
    if password_hash:
        return password_hash

    # Retry once with forced refresh so newly seeded users can log in immediately.
    refresh_auth_password_cache(force=True)
    return auth_password_cache.get(email)


def normalize_serial(value: Optional[str]) -> Optional[str]:
    """Normalize and validate serial numbers.

    Convention:
    - optional field
    - uppercase
    - whitespace removed
    - allowed: A-Z, 0-9, -, _, ., /
    - length: 6..40 chars
    """
    if value is None:
        return None

    raw = value.strip()
    if raw == "":
        return None

    normalized = re.sub(r"\s+", "", raw).upper()
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9\-_/\.]{5,39}", normalized):
        raise HTTPException(
            status_code=400,
            detail="Seriennummer ist ungültig (erlaubt: A-Z, 0-9, -, _, ., /; Länge 6-40)"
        )
    return normalized

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
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
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
        ensure_inventar_table(cursor)
        ensure_activity_log_table(cursor)
        ensure_inventar_id_sequence(cursor)
        connection.commit()
        cursor.close()
        connection.close()
        refresh_auth_password_cache(force=True)
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

def get_connection():
    """Get a fresh DB connection per request to avoid stale shared-connection issues."""
    if not DB_PASSWORD:
        logger.error("DB_PASSWORD nicht gesetzt")
        raise HTTPException(status_code=500, detail="Serverfehler")

    try:
        return pyodbc.connect(CONNECTION_STRING, autocommit=False)
    except pyodbc.Error as exc:
        logger.error(f"DB Connection Error: {exc}")
        raise HTTPException(status_code=503, detail="Datenbankverbindung nicht möglich")


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


def ensure_inventar_table(cursor):
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

    cursor.execute("""
    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'UQ_inventar_seriennummer_not_null'
          AND object_id = OBJECT_ID('dbo.inventar')
    )
    CREATE UNIQUE INDEX UQ_inventar_seriennummer_not_null
    ON dbo.inventar (seriennummer)
    WHERE seriennummer IS NOT NULL
    """)


def ensure_activity_log_table(cursor):
    cursor.execute("""
    IF NOT EXISTS (
        SELECT * FROM sysobjects
        WHERE name='activity_log' AND xtype='U'
    )
    CREATE TABLE activity_log (
        id INT IDENTITY(1,1) PRIMARY KEY,
        action NVARCHAR(50) NOT NULL,
        item_id INT NULL,
        item_name NVARCHAR(255) NULL,
        actor NVARCHAR(255) NOT NULL,
        details NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
    """)


def log_activity(cursor, action: str, actor: str, item_id: Optional[int] = None, item_name: Optional[str] = None, details: Optional[str] = None):
    cursor.execute(
        """
        INSERT INTO activity_log (action, item_id, item_name, actor, details)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            action,
            item_id,
            item_name,
            actor,
            details,
        ),
    )


def ensure_inventar_id_sequence(cursor):
    """Maintain a monotonic sequence so inventar IDs are server-generated and not reused."""
    cursor.execute("""
    DECLARE @max_id BIGINT = ISNULL((SELECT MAX(id) FROM dbo.inventar), 0);

    IF OBJECT_ID('dbo.inventar_id_seq', 'SO') IS NULL
    BEGIN
        DECLARE @start BIGINT = @max_id + 1;
        DECLARE @create_sql NVARCHAR(300) =
            N'CREATE SEQUENCE dbo.inventar_id_seq AS INT START WITH ' + CAST(@start AS NVARCHAR(30)) +
            N' INCREMENT BY 1 MINVALUE 1 NO CYCLE';
        EXEC(@create_sql);
    END
    ELSE
    BEGIN
        DECLARE @current BIGINT = (
            SELECT CAST(COALESCE(current_value, start_value) AS BIGINT)
            FROM sys.sequences
            WHERE object_id = OBJECT_ID('dbo.inventar_id_seq')
        );

        IF @current <= @max_id
        BEGIN
            DECLARE @restart BIGINT = @max_id + 1;
            DECLARE @alter_sql NVARCHAR(300) =
                N'ALTER SEQUENCE dbo.inventar_id_seq RESTART WITH ' + CAST(@restart AS NVARCHAR(30));
            EXEC(@alter_sql);
        END
    END
    """)


#init_database()


class InventarItemPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    kategorie: str = Field(..., min_length=1, max_length=255)
    hersteller: Optional[str] = Field(None, max_length=255)
    seriennummer: Optional[str] = Field(None, max_length=255)
    standort: str = Field(..., min_length=1, max_length=255)
    status: str = Field(..., pattern="^(verfügbar|Im Einsatz|defekt)$")
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

    @validator('seriennummer')
    def validate_seriennummer(cls, v):
        if v is None or v == "":
            return None
        normalized = re.sub(r"\s+", "", v).upper()
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9\-_/\.]{5,39}", normalized):
            raise ValueError("Seriennummer ungültig (A-Z, 0-9, -, _, ., /; 6-40 Zeichen)")
        return normalized


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
    raise HTTPException(
        status_code=403,
        detail="Registrierung ist deaktiviert. Bitte Admin kontaktieren."
    )


@app.post("/api/login")
@limiter.limit("15/15 minutes")
def login(request: Request, credentials: UserCredentials):
    email = normalize_teko_email(credentials.username)
    ensure_email_is_allowed(email)
    password_hash = get_cached_password_hash(email)

    if not password_hash or not pwd_context.verify(credentials.password, password_hash):
        logger.warning(f"Failed login attempt: {email[:10]}...")
        raise HTTPException(status_code=401, detail="Ungültiger Login")

    token = create_token(email)
    logger.info(f"User logged in: {email[:10]}...")
    return {"access_token": token, "token_type": "bearer", "username": email}


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
def create_item(request: Request, item: InventarItemPayload, username: str = Depends(verify_token)):
    connection = get_connection()
    cursor = connection.cursor()
    serial = normalize_serial(item.seriennummer)

    if serial:
        cursor.execute("SELECT id FROM inventar WHERE seriennummer = ?", (serial,))
        if cursor.fetchone():
            connection.close()
            raise HTTPException(status_code=409, detail="Seriennummer existiert bereits")

    cursor.execute("SELECT NEXT VALUE FOR dbo.inventar_id_seq")
    generated_id = int(cursor.fetchone()[0])

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
            generated_id,
            item.name,
            item.kategorie,
            item.hersteller,
            serial,
            item.standort,
            item.status,
            item.bemerkung
        )
    )

    log_activity(
        cursor,
        action="create",
        actor=username,
        item_id=generated_id,
        item_name=item.name,
        details=f"Gerät erstellt ({item.kategorie}, {item.status}, {item.standort})",
    )

    connection.commit()
    connection.close()

    created_item = {
        "id": generated_id,
        "name": item.name,
        "kategorie": item.kategorie,
        "hersteller": item.hersteller,
        "seriennummer": serial,
        "standort": item.standort,
        "status": item.status,
        "bemerkung": item.bemerkung,
    }

    return {
        "message": "Gerät wurde erfolgreich erstellt",
        "item": created_item
    }


@app.put("/api/inventar/{item_id}")
@limiter.limit("10/15 minutes")
def update_item(request: Request, item_id: int, item: InventarItemPayload, username: str = Depends(verify_token)):
    connection = get_connection()
    cursor = connection.cursor()
    serial = normalize_serial(item.seriennummer)

    cursor.execute(
        "SELECT name, status, standort FROM inventar WHERE id = ?",
        (item_id,)
    )
    existing_row = cursor.fetchone()
    if not existing_row:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Gerät nicht gefunden"
        )

    previous_name, previous_status, previous_location = existing_row

    if serial:
        cursor.execute("SELECT id FROM inventar WHERE seriennummer = ? AND id <> ?", (serial, item_id))
        if cursor.fetchone():
            connection.close()
            raise HTTPException(status_code=409, detail="Seriennummer existiert bereits")

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
            serial,
            item.standort,
            item.status,
            item.bemerkung,
            item_id
        )
    )

    details = f"Gerät aktualisiert ({item.kategorie}, {item.status}, {item.standort})"
    if previous_status != item.status:
        details = f"Status geändert: {previous_status} -> {item.status}"
    elif previous_location != item.standort:
        details = f"Standort geändert: {previous_location} -> {item.standort}"

    log_activity(
        cursor,
        action="update",
        actor=username,
        item_id=item_id,
        item_name=item.name or previous_name,
        details=details,
    )

    connection.commit()
    connection.close()

    return {
        "message": "Gerät wurde aktualisiert"
    }


@app.delete("/api/inventar/{item_id}")
@limiter.limit("10/15 minutes")
def delete_item(request: Request, item_id: int, username: str = Depends(verify_token)):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("SELECT name FROM inventar WHERE id = ?", (item_id,))
    existing_row = cursor.fetchone()
    if not existing_row:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Gerät nicht gefunden"
        )

    existing_name = existing_row[0]

    cursor.execute(
        "DELETE FROM inventar WHERE id = ?",
        (item_id,)
    )

    log_activity(
        cursor,
        action="delete",
        actor=username,
        item_id=item_id,
        item_name=existing_name,
        details="Gerät gelöscht",
    )

    connection.commit()
    connection.close()

    return {
        "message": "Gerät wurde gelöscht"
    }


@app.get("/api/activity")
@limiter.limit("30/15 minutes")
def get_activity(request: Request, limit: int = Query(default=25, ge=1, le=100), _: str = Depends(verify_token)):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            id,
            action,
            item_id,
            item_name,
            actor,
            details,
            created_at
        FROM activity_log
        ORDER BY created_at DESC
        OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY
        """,
        (limit,)
    )

    rows = cursor.fetchall()
    connection.close()

    result = []
    for row in rows:
        created_at = row[6]
        if isinstance(created_at, datetime):
            created_at_value = created_at.replace(tzinfo=timezone.utc).isoformat()
        else:
            created_at_value = str(created_at)

        result.append({
            "id": row[0],
            "action": row[1],
            "item_id": row[2],
            "item_name": row[3],
            "actor": row[4],
            "details": row[5],
            "created_at": created_at_value,
        })

    return result


@app.get("/api/dashboard")
def get_dashboard():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("SELECT COUNT(*) FROM inventar")
    gesamt = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM inventar WHERE status = 'verfügbar'")
    verfuegbar = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM inventar WHERE status = 'Im Einsatz'")
    im_einsatz = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM inventar WHERE status = 'defekt'")
    defekt = cursor.fetchone()[0]

    connection.close()

    return {
        "gesamt": gesamt,
        "verfügbar": verfuegbar,
        "Im Einsatz": im_einsatz,
        "defekt": defekt
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
