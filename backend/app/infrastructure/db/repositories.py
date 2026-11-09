"""Repositories: the only place that builds SQL for local entities (Repository pattern)."""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Select, func, or_, select, update
from sqlalchemy.orm import Session

from app.infrastructure.db.models import AuditLog, AuthSession, Role, User


@dataclass(frozen=True, slots=True)
class PageSlice[T]:
    items: Sequence[T]
    total: int


def _paginate[T](db: Session, query: Select[tuple[T]], page: int, page_size: int) -> PageSlice[T]:
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0
    items = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).unique().all()
    return PageSlice(items=items, total=total)


class RoleRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_by_code(self, code: str) -> Role | None:
        return self._db.scalar(select(Role).where(Role.code == code))

    def list(self) -> Sequence[Role]:
        return self._db.scalars(select(Role).order_by(Role.id)).all()


class UserRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get(self, user_id: uuid.UUID) -> User | None:
        return self._db.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        return self._db.scalar(select(User).where(User.email == email.strip().lower()))

    def add(self, user: User) -> User:
        self._db.add(user)
        return user

    def search(
        self,
        *,
        search: str | None,
        role_code: str | None,
        is_active: bool | None,
        sort: str,
        page: int,
        page_size: int,
    ) -> PageSlice[User]:
        query = select(User).join(User.role)
        if search:
            pattern = f"%{search.strip().lower()}%"
            query = query.where(
                or_(func.lower(User.email).like(pattern), func.lower(User.full_name).like(pattern))
            )
        if role_code:
            query = query.where(Role.code == role_code)
        if is_active is not None:
            query = query.where(User.is_active == is_active)
        columns = {"email": User.email, "full_name": User.full_name, "created_at": User.created_at}
        column = columns.get(sort.lstrip("-"), User.created_at)
        query = query.order_by(column.desc() if sort.startswith("-") else column.asc(), User.id)
        return _paginate(self._db, query, page, page_size)


class SessionRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get(self, session_id: uuid.UUID) -> AuthSession | None:
        return self._db.get(AuthSession, session_id)

    def get_by_refresh_hash(self, token_hash: str) -> AuthSession | None:
        return self._db.scalar(
            select(AuthSession).where(AuthSession.refresh_token_hash == token_hash)
        )

    def get_by_previous_refresh_hash(self, token_hash: str) -> AuthSession | None:
        return self._db.scalar(
            select(AuthSession).where(AuthSession.previous_refresh_token_hash == token_hash)
        )

    def add(self, session: AuthSession) -> AuthSession:
        self._db.add(session)
        return session

    def revoke_all_for_user(
        self, user_id: uuid.UUID, now: datetime, *, except_id: uuid.UUID | None = None
    ) -> None:
        statement = (
            update(AuthSession)
            .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        if except_id is not None:
            statement = statement.where(AuthSession.id != except_id)
        self._db.execute(statement)


class AuditRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def add(self, entry: AuditLog) -> None:
        self._db.add(entry)

    def search(
        self,
        *,
        action: str | None,
        actor: str | None,
        outcome: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
        page: int,
        page_size: int,
    ) -> PageSlice[AuditLog]:
        query = select(AuditLog)
        if action:
            query = query.where(AuditLog.action.like(f"{action.strip()}%"))
        if actor:
            query = query.where(func.lower(AuditLog.actor_email).like(f"%{actor.strip().lower()}%"))
        if outcome:
            query = query.where(AuditLog.outcome == outcome)
        if date_from:
            query = query.where(AuditLog.occurred_at >= date_from)
        if date_to:
            query = query.where(AuditLog.occurred_at <= date_to)
        query = query.order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
        return _paginate(self._db, query, page, page_size)
