import argparse
import os
import sys

import pyodbc
from passlib.context import CryptContext

from allowed_users import ALLOWED_USER_EMAILS


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_connection() -> pyodbc.Connection:
    db_password = os.getenv("SQL_PASSWORD")
    if not db_password:
        raise RuntimeError("SQL_PASSWORD ist nicht gesetzt")

    db_server = os.getenv("SQL_SERVER", "tcp:inventarsqlg6.database.windows.net,1433")
    db_database = os.getenv("SQL_DATABASE", "inventarsqlg6")
    db_user = os.getenv("SQL_USER", "inventaradmin")
    db_driver = os.getenv("SQL_DRIVER", "ODBC Driver 18 for SQL Server")
    db_encrypt = os.getenv("SQL_ENCRYPT", "yes")
    db_trust_server_cert = os.getenv("SQL_TRUST_SERVER_CERTIFICATE", "no")

    connection_string = (
        f"Driver={{{db_driver}}};"
        f"Server={db_server};"
        f"Database={db_database};"
        f"Uid={db_user};"
        f"Pwd={db_password};"
        f"Encrypt={db_encrypt};"
        f"TrustServerCertificate={db_trust_server_cert};"
        "Connection Timeout=10;"
    )
    return pyodbc.connect(connection_string, autocommit=False)


def ensure_users_table(cursor: pyodbc.Cursor) -> None:
    cursor.execute(
        """
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
        """
    )


def seed_users(initial_password: str, reset_passwords: bool) -> None:
    connection = get_connection()
    cursor = connection.cursor()

    inserted = 0
    updated = 0
    unchanged = 0

    try:
        ensure_users_table(cursor)
        password_hash = pwd_context.hash(initial_password)

        for email in sorted(ALLOWED_USER_EMAILS):
            cursor.execute("SELECT id FROM users WHERE LOWER(username) = ?", (email,))
            row = cursor.fetchone()

            if row:
                if reset_passwords:
                    cursor.execute(
                        "UPDATE users SET password_hash = ? WHERE id = ?",
                        (password_hash, row[0]),
                    )
                    updated += 1
                else:
                    unchanged += 1
                continue

            cursor.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (email, password_hash),
            )
            inserted += 1

        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()

    print("Seed abgeschlossen")
    print(f"Neu erstellt: {inserted}")
    print(f"Passwort aktualisiert: {updated}")
    print(f"Unveraendert: {unchanged}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Legt die erlaubten TEKO-User in der DB an"
    )
    parser.add_argument(
        "--password",
        default=os.getenv("INIT_USER_PASSWORD"),
        help="Initiales Passwort fuer alle erlaubten User (oder ENV INIT_USER_PASSWORD)",
    )
    parser.add_argument(
        "--reset-passwords",
        action="store_true",
        help="Setzt Passwort fuer bestehende erlaubte User ebenfalls neu",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not args.password:
        print("Fehler: Bitte --password setzen oder INIT_USER_PASSWORD als ENV setzen.")
        return 1

    try:
        seed_users(initial_password=args.password, reset_passwords=args.reset_passwords)
        return 0
    except Exception as exc:
        print(f"Seed fehlgeschlagen: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
