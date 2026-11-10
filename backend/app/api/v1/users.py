"""User and role management (RF-06). Only `users:manage` (Admin in the default matrix)."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, status

from app.api.deps import Principal, client_ip, get_user_service, require_permission
from app.api.schemas.common import PROBLEM_RESPONSES, Page
from app.api.schemas.users import (
    PasswordResetOut,
    RoleOut,
    UserCreatedOut,
    UserCreateIn,
    UserOut,
    UserUpdateIn,
)
from app.domain.permissions import Permission
from app.services.user_service import UserService

router = APIRouter(tags=["users"], responses=PROBLEM_RESPONSES)

UserSort = Literal["email", "-email", "full_name", "-full_name", "created_at", "-created_at"]
_can_manage = require_permission(Permission.USERS_MANAGE)


@router.get(
    "/users",
    response_model=Page[UserOut],
    dependencies=[Depends(_can_manage)],
    summary="Listar usuarios (búsqueda, filtros y paginación)",
)
def list_users(
    search: str | None = Query(default=None, max_length=100),
    role: str | None = Query(default=None, max_length=32),
    is_active: bool | None = None,
    sort: UserSort = "email",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    service: UserService = Depends(get_user_service),
) -> Page[UserOut]:
    result = service.search(
        search=search, role=role, is_active=is_active, sort=sort, page=page, page_size=page_size
    )
    items = [UserOut.from_user(user) for user in result.items]
    return Page.build(items, total=result.total, page=page, page_size=page_size)


@router.post(
    "/users",
    response_model=UserCreatedOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_can_manage)],
    summary="Crear usuario con contraseña temporal (se muestra una sola vez)",
)
def create_user(
    body: UserCreateIn,
    request: Request,
    principal: Principal = Depends(_can_manage),
    service: UserService = Depends(get_user_service),
) -> UserCreatedOut:
    user, temporary_password = service.create(
        email=body.email,
        full_name=body.full_name,
        role=body.role,
        actor=principal.user,
        ip_address=client_ip(request),
    )
    return UserCreatedOut(user=UserOut.from_user(user), temporary_password=temporary_password)


@router.get(
    "/users/{user_id}",
    response_model=UserOut,
    dependencies=[Depends(_can_manage)],
    summary="Detalle de un usuario",
)
def get_user(user_id: uuid.UUID, service: UserService = Depends(get_user_service)) -> UserOut:
    return UserOut.from_user(service.get(user_id))


@router.patch(
    "/users/{user_id}",
    response_model=UserOut,
    dependencies=[Depends(_can_manage)],
    summary="Cambiar nombre, rol o estado (activar/desactivar) de un usuario",
)
def update_user(
    user_id: uuid.UUID,
    body: UserUpdateIn,
    request: Request,
    principal: Principal = Depends(_can_manage),
    service: UserService = Depends(get_user_service),
) -> UserOut:
    user = service.update(
        user_id,
        full_name=body.full_name,
        role=body.role,
        is_active=body.is_active,
        actor=principal.user,
        ip_address=client_ip(request),
    )
    return UserOut.from_user(user)


@router.post(
    "/users/{user_id}/reset-password",
    response_model=PasswordResetOut,
    dependencies=[Depends(_can_manage)],
    summary="Restablecer la contraseña (temporal, revoca las sesiones del usuario)",
)
def reset_password(
    user_id: uuid.UUID,
    request: Request,
    principal: Principal = Depends(_can_manage),
    service: UserService = Depends(get_user_service),
) -> PasswordResetOut:
    temporary_password = service.reset_password(
        user_id, actor=principal.user, ip_address=client_ip(request)
    )
    return PasswordResetOut(temporary_password=temporary_password)


@router.get(
    "/roles",
    response_model=list[RoleOut],
    dependencies=[Depends(_can_manage)],
    summary="Roles disponibles y sus permisos",
)
def list_roles(service: UserService = Depends(get_user_service)) -> list[RoleOut]:
    return [RoleOut.from_role(role) for role in service.list_roles()]
