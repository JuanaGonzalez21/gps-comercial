"""User and role management (RF-06), exclusive to holders of `users:manage`.

Each change and its audit entry are committed together. Temporary passwords are generated here,
returned once to the caller and only stored as Argon2id hashes.
"""

import uuid
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.errors import ConflictError, FieldError, InvalidInputError, NotFoundError
from app.infrastructure.db.models import Role, User
from app.infrastructure.db.repositories import (
    PageSlice,
    RoleRepository,
    SessionRepository,
    UserRepository,
)
from app.services import passwords
from app.services.audit_service import AuditService

EMAIL_TAKEN = "Ya existe un usuario con ese correo."
USER_NOT_FOUND = "El usuario no existe."
_MAX_PASSWORD_ATTEMPTS = 10


def _utcnow() -> datetime:
    return datetime.now(UTC)


class UserService:
    def __init__(self, db: Session, *, clock: Callable[[], datetime] = _utcnow) -> None:
        self._db = db
        self._clock = clock
        self._users = UserRepository(db)
        self._roles = RoleRepository(db)
        self._sessions = SessionRepository(db)
        self._audit = AuditService(db)

    # ----- reads -------------------------------------------------------------------------
    def search(
        self,
        *,
        search: str | None = None,
        role: str | None = None,
        is_active: bool | None = None,
        sort: str = "email",
        page: int = 1,
        page_size: int = 20,
    ) -> PageSlice[User]:
        return self._users.search(
            search=search,
            role_code=role,
            is_active=is_active,
            sort=sort,
            page=page,
            page_size=page_size,
        )

    def get(self, user_id: uuid.UUID) -> User:
        user = self._users.get(user_id)
        if user is None:
            raise NotFoundError(USER_NOT_FOUND)
        return user

    def list_roles(self) -> Sequence[Role]:
        return self._roles.list()

    # ----- writes ------------------------------------------------------------------------
    def create(
        self, *, email: str, full_name: str, role: str, actor: User, ip_address: str | None
    ) -> tuple[User, str]:
        """Creates an active user that must change the generated password at first login."""
        normalized = email.strip().lower()
        if self._users.get_by_email(normalized) is not None:
            raise ConflictError(EMAIL_TAKEN)
        role_row = self._role(role)
        temporary = self._temporary_password(normalized)
        user = self._users.add(
            User(
                email=normalized,
                full_name=full_name.strip(),
                password_hash=passwords.hash_password(temporary),
                role=role_row,
                is_active=True,
                must_change_password=True,
                created_by_id=actor.id,
            )
        )
        try:
            self._db.flush()
        except IntegrityError as error:  # a concurrent request created the same e-mail
            self._db.rollback()
            raise ConflictError(EMAIL_TAKEN) from error
        self._audit.record(
            "user.created",
            actor=actor,
            entity_type="user",
            entity_id=str(user.id),
            ip_address=ip_address,
            details={"email": normalized, "role": role_row.code},
        )
        self._db.commit()
        return user, temporary

    def update(
        self,
        user_id: uuid.UUID,
        *,
        full_name: str | None = None,
        role: str | None = None,
        is_active: bool | None = None,
        actor: User,
        ip_address: str | None,
    ) -> User:
        """Partial update. An admin can neither deactivate nor change the role of their own account,
        so there is always at least one active administrator (the actor)."""
        user = self.get(user_id)
        is_self = user.id == actor.id
        role_change = role is not None and role.strip() != user.role.code
        active_change = is_active is not None and is_active != user.is_active
        # Every rule is checked before touching the entity, so a refusal changes nothing.
        if is_self and role_change:
            raise ConflictError("No puedes cambiar el rol de tu propia cuenta.")
        if is_self and active_change and not is_active:
            raise ConflictError("No puedes desactivar tu propia cuenta.")
        role_row = self._role(role) if role_change and role is not None else None

        details: dict[str, Any] = {"email": user.email}
        changed: list[str] = []
        if full_name is not None and full_name.strip() != user.full_name:
            user.full_name = full_name.strip()
            changed.append("full_name")
        if role_row is not None:
            details.update(old_role=user.role.code, new_role=role_row.code)
            user.role = role_row  # permissions are read per request: effective immediately
            changed.append("role")
        if active_change and is_active is not None:
            user.is_active = is_active
            details["is_active"] = is_active
            changed.append("is_active")
            if not is_active:
                # Deactivation ends every open session immediately, not at token expiry.
                self._sessions.revoke_all_for_user(user.id, self._clock())

        if not changed:
            return user
        details["changed_fields"] = changed
        self._audit.record(
            "user.updated",
            actor=actor,
            entity_type="user",
            entity_id=str(user.id),
            ip_address=ip_address,
            details=details,
        )
        self._db.commit()
        return user

    def reset_password(self, user_id: uuid.UUID, *, actor: User, ip_address: str | None) -> str:
        """New temporary password, forced change at next login, sessions revoked, lock cleared."""
        user = self.get(user_id)
        if user.id == actor.id:
            # Resetting oneself here would end the current session and could lock the only admin
            # out; the own password is changed with POST /auth/change-password instead.
            raise ConflictError(
                "Para cambiar tu propia contraseña usa la opción «Cambiar contraseña»."
            )
        now = self._clock()
        temporary = self._temporary_password(user.email)
        user.password_hash = passwords.hash_password(temporary)
        user.must_change_password = True
        user.password_changed_at = now
        user.failed_login_attempts = 0
        user.locked_until = None
        self._sessions.revoke_all_for_user(user.id, now)
        self._audit.record(
            "user.password_reset",
            actor=actor,
            entity_type="user",
            entity_id=str(user.id),
            ip_address=ip_address,
            details={"email": user.email},
        )
        self._db.commit()
        return temporary

    # ----- helpers -----------------------------------------------------------------------
    def _role(self, code: str) -> Role:
        role = self._roles.get_by_code(code.strip())
        if role is None:
            message = "El rol no existe."
            raise InvalidInputError(message, field_errors=[FieldError("role", message)])
        return role

    @staticmethod
    def _temporary_password(email: str) -> str:
        # A random password could, very rarely, contain the e-mail's local part: draw again.
        for _ in range(_MAX_PASSWORD_ATTEMPTS):
            candidate = passwords.generate_temporary_password()
            if not passwords.policy_errors(candidate, email):
                return candidate
        raise RuntimeError("could not generate a temporary password that meets the policy")
