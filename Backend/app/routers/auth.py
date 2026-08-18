from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text

from app.core.security import create_access_token, decode_access_token, verify_password
from app.db.database import engine
from app.schemas.auth import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer()

INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Usuario o contraseña incorrectos",
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> UserOut:
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )
    return UserOut(user=payload["user"], full_name=payload.get("full_name", payload["user"]), role=payload["role"])


@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest):
    query = text(
        """
        SELECT u.id_user, u.[user], u.full_name, u.password_hash, r.code AS role
        FROM dbo.TBL_USERS u
        JOIN dbo.TBL_ROLES r ON r.id_role = u.role_id
        WHERE u.[user] = :user AND u.active = 1 AND r.active = 1
        """
    )
    with engine.connect() as conn:
        row = conn.execute(query, {"user": credentials.user}).mappings().first()

        if row is None or not verify_password(credentials.password, row["password_hash"]):
            raise INVALID_CREDENTIALS

        conn.execute(
            text("UPDATE dbo.TBL_USERS SET last_login_at = :now WHERE id_user = :id_user"),
            {"now": datetime.now(timezone.utc), "id_user": row["id_user"]},
        )
        conn.commit()

    token = create_access_token(
        user_id=row["id_user"], username=row["user"], full_name=row["full_name"], role=row["role"]
    )
    return TokenResponse(
        access_token=token,
        user=row["user"],
        full_name=row["full_name"],
        role=row["role"],
    )


@router.get("/me", response_model=UserOut)
def me(current_user: UserOut = Depends(get_current_user)):
    return current_user
