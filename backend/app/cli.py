"""Management commands.

    uv run python -m app.cli seed-admin [--reset-password]

seed-admin creates the initial Admin (RF-07) from ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_FULL_NAME.
It is idempotent: if the user exists it only guarantees the admin role and active state (and the
password with --reset-password). The password is never printed.
"""

import argparse
import sys
from datetime import UTC, datetime

from app.core.config import Settings, get_settings
from app.domain.permissions import RoleCode
from app.infrastructure.db.models import User
from app.infrastructure.db.repositories import RoleRepository, UserRepository
from app.infrastructure.db.session import create_db_engine, create_session_factory
from app.services import passwords
from app.services.audit_service import AuditService


def seed_admin(settings: Settings, *, reset_password: bool = False) -> int:
    email = (settings.admin_email or "").strip().lower()
    password = settings.admin_password.get_secret_value() if settings.admin_password else ""
    full_name = (settings.admin_full_name or "").strip()
    if not email or not password or not full_name:
        print(
            "Faltan ADMIN_EMAIL, ADMIN_PASSWORD o ADMIN_FULL_NAME en el entorno.", file=sys.stderr
        )
        return 2
    problems = passwords.policy_errors(password, email)
    if problems:
        print("ADMIN_PASSWORD no cumple la política:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem.message}", file=sys.stderr)
        return 2

    engine = create_db_engine(settings.database_url)
    session_factory = create_session_factory(engine)
    try:
        with session_factory() as db:
            role = RoleRepository(db).get_by_code(RoleCode.ADMIN)
            if role is None:
                print(
                    "No existe el rol admin: ejecuta antes `alembic upgrade head`.", file=sys.stderr
                )
                return 2
            users = UserRepository(db)
            now = datetime.now(UTC)
            user = users.get_by_email(email)
            if user is None:
                user = users.add(
                    User(
                        email=email,
                        full_name=full_name,
                        password_hash=passwords.hash_password(password),
                        role=role,
                        is_active=True,
                        must_change_password=False,
                        password_changed_at=now,
                    )
                )
                db.flush()
                AuditService(db).record(
                    "user.created",
                    entity_type="user",
                    entity_id=str(user.id),
                    actor_email="seed-admin",
                    details={"source": "seed-admin", "role": "admin"},
                )
                message = f"Administrador creado: {email}"
            elif not reset_password:
                # Restarts must not undo what admins changed later (role, active state).
                print(f"El administrador ya existe: {email} (sin cambios)")
                return 0
            else:
                user.role = role
                user.is_active = True
                user.password_hash = passwords.hash_password(password)
                user.password_changed_at = now
                user.failed_login_attempts = 0
                user.locked_until = None
                AuditService(db).record(
                    "user.updated",
                    entity_type="user",
                    entity_id=str(user.id),
                    actor_email="seed-admin",
                    details={"source": "seed-admin", "credential_reset": True},
                )
                message = (
                    f"Administrador restablecido: {email} (rol admin, activo y nueva contraseña)"
                )
            db.commit()
    finally:
        engine.dispose()
    print(message)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    seed = commands.add_parser("seed-admin", help="Crear o asegurar el administrador inicial")
    seed.add_argument("--reset-password", action="store_true", help="Reaplicar ADMIN_PASSWORD")
    args = parser.parse_args(argv)
    if args.command == "seed-admin":
        return seed_admin(get_settings(), reset_password=args.reset_password)
    return 1


if __name__ == "__main__":
    sys.exit(main())
