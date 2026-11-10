"""Authentication use cases: login, session refresh/rotation, logout and password change."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import NoReturn

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.domain.errors import (
    AuthenticationError,
    FieldError,
    InvalidCredentialsError,
    InvalidInputError,
)
from app.infrastructure.db.models import AuthSession, User
from app.infrastructure.db.repositories import SessionRepository, UserRepository
from app.services import passwords, tokens
from app.services.audit_service import AuditService

GENERIC_LOGIN_ERROR = "Correo o contraseña incorrectos, o la cuenta está bloqueada temporalmente."
SESSION_EXPIRED = "Tu sesión expiró o no es válida. Inicia sesión de nuevo."
# Two browser tabs may refresh at the same moment; reuse inside this window is a race, not theft.
REFRESH_REUSE_GRACE = timedelta(seconds=30)


@dataclass(frozen=True, slots=True)
class IssuedSession:
    user: User
    session: AuthSession
    access_token: str
    refresh_token: str


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AuthService:
    def __init__(
        self,
        db: Session,
        settings: Settings,
        *,
        clock: Callable[[], datetime] = _utcnow,
    ) -> None:
        self._db = db
        self._settings = settings
        self._clock = clock
        self._users = UserRepository(db)
        self._sessions = SessionRepository(db)
        self._audit = AuditService(db)

    # ----- login -------------------------------------------------------------------------
    def login(
        self, email: str, password: str, *, ip_address: str | None, user_agent: str | None
    ) -> IssuedSession:
        now = self._clock()
        normalized = email.strip().lower()
        user = self._users.get_by_email(normalized)

        if user is None:
            passwords.burn_verification_time(password)
            self._fail(normalized, None, "unknown_email", ip_address)

        if user.locked_until and user.locked_until > now:
            passwords.burn_verification_time(password)  # same timing as a wrong password
            self._fail(normalized, user, "locked", ip_address)

        if not passwords.verify_password(user.password_hash, password):
            attempts = self._users.register_failed_login(user.id)
            user.failed_login_attempts = attempts
            reason = "wrong_password"
            if attempts >= self._settings.login_max_attempts:
                user.locked_until = now + timedelta(minutes=self._settings.login_lockout_minutes)
                user.failed_login_attempts = 0
                reason = "wrong_password_account_locked"
            self._fail(normalized, user, reason, ip_address)

        if not user.is_active:
            self._fail(normalized, user, "inactive", ip_address)

        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = now
        if passwords.needs_rehash(user.password_hash):
            user.password_hash = passwords.hash_password(password)
        issued = self._open_session(user, now, ip_address, user_agent)
        self._audit.record(
            "auth.login_succeeded",
            actor=user,
            entity_type="user",
            entity_id=str(user.id),
            ip_address=ip_address,
        )
        self._db.commit()
        return issued

    def _fail(self, email: str, user: User | None, reason: str, ip_address: str | None) -> NoReturn:
        self._audit.record(
            "auth.login_failed",
            outcome="failure",
            actor=user,
            actor_email=email[:254],
            entity_type="user",
            entity_id=str(user.id) if user else None,
            ip_address=ip_address,
            details={"reason": reason},
        )
        self._db.commit()
        raise InvalidCredentialsError(GENERIC_LOGIN_ERROR)

    def _open_session(
        self, user: User, now: datetime, ip_address: str | None, user_agent: str | None
    ) -> IssuedSession:
        refresh_token = tokens.new_opaque_token()
        session = self._sessions.add(
            AuthSession(
                user_id=user.id,
                refresh_token_hash=tokens.hash_token(refresh_token),
                created_at=now,
                last_used_at=now,
                expires_at=now + timedelta(days=self._settings.refresh_token_ttl_days),
                ip_address=ip_address,
                user_agent=(user_agent or "")[:255] or None,
            )
        )
        self._db.flush()
        return IssuedSession(user, session, self._access_token(user, session, now), refresh_token)

    def _access_token(self, user: User, session: AuthSession, now: datetime) -> str:
        return tokens.create_access_token(
            user_id=user.id,
            session_id=session.id,
            secret=self._settings.jwt_secret.get_secret_value(),
            ttl=timedelta(minutes=self._settings.access_token_ttl_minutes),
            now=now,
        )

    # ----- refresh -----------------------------------------------------------------------
    def refresh(self, refresh_token: str | None, *, ip_address: str | None) -> IssuedSession:
        if not refresh_token:
            raise AuthenticationError(SESSION_EXPIRED)
        now = self._clock()
        token_hash = tokens.hash_token(refresh_token)
        session = self._sessions.get_by_refresh_hash(token_hash)
        if session is None:
            self._handle_possible_reuse(token_hash, now, ip_address)
            raise AuthenticationError(SESSION_EXPIRED)
        user = self._users.get(session.user_id)
        if session.revoked_at or session.expires_at <= now or user is None or not user.is_active:
            raise AuthenticationError(SESSION_EXPIRED)

        new_refresh = tokens.new_opaque_token()
        session.previous_refresh_token_hash = token_hash
        session.refresh_token_hash = tokens.hash_token(new_refresh)
        session.rotated_at = now
        session.last_used_at = now
        self._db.commit()
        return IssuedSession(user, session, self._access_token(user, session, now), new_refresh)

    def _handle_possible_reuse(self, token_hash: str, now: datetime, ip: str | None) -> None:
        session = self._sessions.get_by_previous_refresh_hash(token_hash)
        if session is None or session.revoked_at is not None:
            return
        if session.rotated_at and now - session.rotated_at <= REFRESH_REUSE_GRACE:
            return
        # An already rotated token came back after the grace window: assume it was stolen.
        session.revoked_at = now
        self._audit.record(
            "auth.refresh_reuse_detected",
            outcome="failure",
            entity_type="session",
            entity_id=str(session.id),
            ip_address=ip,
        )
        self._db.commit()

    # ----- access, logout, password ------------------------------------------------------
    def authenticate(self, access_token: str | None) -> tuple[User, AuthSession]:
        claims = (
            tokens.decode_access_token(
                access_token, secret=self._settings.jwt_secret.get_secret_value()
            )
            if access_token
            else None
        )
        if claims is None:
            raise AuthenticationError(SESSION_EXPIRED)
        session = self._sessions.get(claims.session_id)
        now = self._clock()
        if session is None or session.user_id != claims.user_id:
            raise AuthenticationError(SESSION_EXPIRED)
        if session.revoked_at is not None or session.expires_at <= now:
            raise AuthenticationError(SESSION_EXPIRED)
        user = self._users.get(claims.user_id)
        if user is None or not user.is_active:
            raise AuthenticationError(SESSION_EXPIRED)
        return user, session

    def logout(
        self, access_token: str | None, refresh_token: str | None, *, ip_address: str | None
    ) -> None:
        """Revoke the session behind whichever cookie is still valid.

        The access cookie lives 15 minutes; after that only the refresh cookie identifies the
        session, and it must be revoked too or a reload would sign the user back in.
        """
        session: AuthSession | None
        try:
            _user, session = self.authenticate(access_token)
        except AuthenticationError:
            session = (
                self._sessions.get_by_refresh_hash(tokens.hash_token(refresh_token))
                if refresh_token
                else None
            )
        if session is None or session.revoked_at is not None:
            return
        session.revoked_at = self._clock()
        user = self._users.get(session.user_id)
        self._audit.record(
            "auth.logout",
            actor=user,
            entity_type="user",
            entity_id=str(session.user_id),
            ip_address=ip_address,
        )
        self._db.commit()

    def change_password(
        self,
        user: User,
        session: AuthSession,
        current_password: str,
        new_password: str,
        *,
        ip_address: str | None,
    ) -> None:
        if not passwords.verify_password(user.password_hash, current_password):
            raise InvalidInputError(
                "La contraseña actual no es correcta.",
                field_errors=[
                    FieldError("current_password", "La contraseña actual no es correcta.")
                ],
            )
        problems = passwords.policy_errors(new_password, user.email, field="new_password")
        if new_password == current_password:
            problems.append(
                FieldError("new_password", "Debe ser distinta de la contraseña actual.")
            )
        if problems:
            raise InvalidInputError(
                "La nueva contraseña no cumple la política.", field_errors=problems
            )
        now = self._clock()
        user.password_hash = passwords.hash_password(new_password)
        user.must_change_password = False
        user.password_changed_at = now
        self._sessions.revoke_all_for_user(user.id, now, except_id=session.id)
        self._audit.record(
            "auth.password_changed",
            actor=user,
            entity_type="user",
            entity_id=str(user.id),
            ip_address=ip_address,
        )
        self._db.commit()
