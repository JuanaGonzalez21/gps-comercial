"""Authentication contracts."""

from pydantic import BaseModel, Field

from app.infrastructure.db.models import User


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)


class RoleRefOut(BaseModel):
    code: str
    name: str


class MeOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: RoleRefOut
    permissions: list[str]
    must_change_password: bool

    @classmethod
    def from_user(cls, user: User) -> "MeOut":
        return cls(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            role=RoleRefOut(code=user.role.code, name=user.role.name),
            permissions=sorted(user.permission_codes),
            must_change_password=user.must_change_password,
        )


class AuthResponse(BaseModel):
    user: MeOut
