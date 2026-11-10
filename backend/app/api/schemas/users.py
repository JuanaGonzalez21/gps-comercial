"""User management and role contracts (RF-06)."""

from pydantic import BaseModel

from app.api.schemas.auth import RoleRefOut
from app.api.schemas.common import UtcDateTime
from app.api.schemas.fields import Email, FullName, RoleCodeText
from app.infrastructure.db.models import Role, User


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: RoleRefOut
    is_active: bool
    must_change_password: bool
    last_login_at: UtcDateTime | None
    created_at: UtcDateTime

    @classmethod
    def from_user(cls, user: User) -> "UserOut":
        return cls(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            role=RoleRefOut(code=user.role.code, name=user.role.name),
            is_active=user.is_active,
            must_change_password=user.must_change_password,
            last_login_at=user.last_login_at,
            created_at=user.created_at,
        )


class UserCreateIn(BaseModel):
    email: Email
    full_name: FullName
    role: RoleCodeText


class UserUpdateIn(BaseModel):
    """PATCH: only the fields present are changed."""

    full_name: FullName | None = None
    role: RoleCodeText | None = None
    is_active: bool | None = None


class UserCreatedOut(BaseModel):
    user: UserOut
    # Shown once to the administrator; only its Argon2id hash is stored.
    temporary_password: str


class PasswordResetOut(BaseModel):
    temporary_password: str


class RoleOut(BaseModel):
    code: str
    name: str
    permissions: list[str]

    @classmethod
    def from_role(cls, role: Role) -> "RoleOut":
        return cls(
            code=role.code,
            name=role.name,
            permissions=sorted(permission.code for permission in role.permissions),
        )
