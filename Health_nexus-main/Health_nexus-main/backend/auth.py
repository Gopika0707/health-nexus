"""
=============================================
HEALTH NEXUS — JWT Authentication Module

- bcrypt password hashing
- JWT token creation & verification
- Role-based middleware
=============================================
"""

import os
import jwt
import base64
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from backend.env_loader import load_env

try:
    import bcrypt  # type: ignore
except ImportError:  # pragma: no cover
    bcrypt = None

load_env()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "CHANGE_IN_PRODUCTION_USE_256BIT_RANDOM_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours

security = HTTPBearer()


# ── Schemas ───────────────────────────────────
class TokenPayload(BaseModel):
    user_id: str
    role: str   # "patient" | "doctor" | "admin"
    patient_id: Optional[str] = None
    doctor_id: Optional[str] = None


class LoginRequest(BaseModel):
    user_id: str
    password: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Password Hashing ──────────────────────────
def hash_password(plain: str) -> str:
    """Hash a password using bcrypt."""
    if bcrypt is not None:
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(plain.encode(), salt).decode()
    digest = hashlib.sha256(plain.encode()).digest()
    return "sha256$" + base64.b64encode(digest).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    if hashed.startswith("sha256$"):
        digest = hashlib.sha256(plain.encode()).digest()
        expected = "sha256$" + base64.b64encode(digest).decode()
        return hashed == expected
    if bcrypt is None:
        return False
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── Token Operations ──────────────────────────
def create_access_token(payload: TokenPayload) -> str:
    """Create a signed JWT token valid for ACCESS_TOKEN_EXPIRE_MINUTES."""
    data = payload.dict()
    data["exp"] = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    data["iat"] = datetime.utcnow()
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenPayload:
    """FastAPI dependency — validate JWT and return payload."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenPayload(**payload)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired. Please log in again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )


# ── Role Guards ───────────────────────────────
def require_patient(token: TokenPayload = Depends(verify_token)) -> TokenPayload:
    if token.role != "patient":
        raise HTTPException(status_code=403, detail="Patient access required.")
    return token


def require_doctor(token: TokenPayload = Depends(verify_token)) -> TokenPayload:
    if token.role not in ("doctor", "admin"):
        raise HTTPException(status_code=403, detail="Doctor access required.")
    return token


def require_admin(token: TokenPayload = Depends(verify_token)) -> TokenPayload:
    if token.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return token
