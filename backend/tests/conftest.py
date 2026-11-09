"""Shared fixtures: isolated SQLite database per test, simulated fleet and logged-in clients.

Wialon is never called from tests: the API uses FakeFleetGateway and the Wialon adapter is tested
with httpx2.MockTransport.
"""

from collections.abc import Callable, Iterator
from dataclasses import dataclass

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import insert
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.domain.permissions import PERMISSION_DESCRIPTIONS, ROLE_NAMES, ROLE_PERMISSIONS, Permission
from app.infrastructure.db.models import Base, PermissionRecord, Role, User, role_permissions
from app.infrastructure.db.session import create_db_engine, create_session_factory
from app.infrastructure.fake_fleet.gateway import FakeFleetGateway
from app.main import create_app
from app.services.passwords import hash_password

FRONTEND_ORIGIN = "http://localhost:5173"
PASSWORD = "Prueba-Segura-2026!"


def seed_roles(session_factory: sessionmaker[Session]) -> None:
    with session_factory() as db:
        permission_ids = {}
        for index, permission in enumerate(Permission, start=1):
            db.add(
                PermissionRecord(
                    id=index, code=permission.value, description=PERMISSION_DESCRIPTIONS[permission]
                )
            )
            permission_ids[permission] = index
        for index, (role_code, permissions) in enumerate(ROLE_PERMISSIONS.items(), start=1):
            db.add(Role(id=index, code=role_code.value, name=ROLE_NAMES[role_code]))
            db.flush()
            for permission in permissions:
                db.execute(
                    insert(role_permissions).values(
                        role_id=index, permission_id=permission_ids[permission]
                    )
                )
        # A role with no permissions proves that every endpoint denies by default.
        db.add(Role(id=99, code="nobody", name="Sin permisos"))
        db.commit()


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        app_env="test",
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        cors_origins=FRONTEND_ORIGIN,
        jwt_secret="t" * 48,
        fleet_gateway="fake",
        login_rate_limit_per_minute=600,
    )


@pytest.fixture
def session_factory(settings: Settings) -> Iterator[sessionmaker[Session]]:
    engine = create_db_engine(settings.database_url)
    Base.metadata.create_all(engine)
    factory = create_session_factory(engine)
    seed_roles(factory)
    yield factory
    engine.dispose()


@pytest.fixture
def fleet() -> FakeFleetGateway:
    return FakeFleetGateway()


@pytest.fixture
def app(settings: Settings, session_factory, fleet: FakeFleetGateway) -> FastAPI:
    return create_app(settings, fleet_gateway=fleet, session_factory=session_factory)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@dataclass
class CreatedUser:
    id: str
    email: str
    password: str


@pytest.fixture
def make_user(session_factory) -> Callable[..., CreatedUser]:
    counter = {"n": 0}

    def factory(
        role: str = "admin", *, must_change_password: bool = False, is_active: bool = True
    ) -> CreatedUser:
        counter["n"] += 1
        email = f"{role}{counter['n']}@example.com"
        with session_factory() as db:
            role_row = db.query(Role).filter_by(code=role).one()
            user = User(
                email=email,
                full_name=f"Usuario {role}",
                password_hash=hash_password(PASSWORD),
                role=role_row,
                is_active=is_active,
                must_change_password=must_change_password,
            )
            db.add(user)
            db.commit()
            return CreatedUser(id=str(user.id), email=email, password=PASSWORD)

    return factory


def login(client: TestClient, email: str, password: str = PASSWORD):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
        headers={"Origin": FRONTEND_ORIGIN},
    )
    if response.status_code == 200:
        # The SPA echoes the readable CSRF cookie in this header on every unsafe request.
        client.headers["X-CSRF-Token"] = client.cookies.get("gc_csrf", "")
    return response


@pytest.fixture
def login_as(client: TestClient, make_user) -> Callable[[str], TestClient]:
    def _login(role: str) -> TestClient:
        user = make_user(role)
        assert login(client, user.email).status_code == 200
        return client

    return _login
