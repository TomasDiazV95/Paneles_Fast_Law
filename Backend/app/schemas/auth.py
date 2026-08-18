from pydantic import BaseModel


class LoginRequest(BaseModel):
    user: str
    password: str


class UserOut(BaseModel):
    user: str
    full_name: str
    role: str


class TokenResponse(UserOut):
    access_token: str
    token_type: str = "bearer"
