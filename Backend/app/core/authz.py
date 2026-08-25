"""Dependencias de autorización reutilizables entre routers.

Centraliza las reglas de acceso por rol para evitar duplicarlas en cada
router (`admin.py`, `carga.py`, etc.).
"""

from fastapi import Depends, HTTPException, status

from app.routers.auth import get_current_user
from app.schemas.auth import UserOut

ROLES_MANTENEDOR = ("ADMIN", "MANTENEDOR")


def require_admin(current_user: UserOut = Depends(get_current_user)) -> UserOut:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol ADMIN para ejecutar esta acción",
        )
    return current_user


def require_mantenedor(current_user: UserOut = Depends(get_current_user)) -> UserOut:
    if current_user.role not in ROLES_MANTENEDOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol ADMIN o MANTENEDOR para ejecutar esta acción",
        )
    return current_user
