from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.persistence_models import User
from app.utils.config import get_settings
from passlib.context import CryptContext

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def _is_dev_mock_enabled() -> bool:
    env = (settings.deployment_env or "").lower()
    return settings.enable_dev_mock_user or env in {"development", "dev", "local"}


def _set_db_user_context(db: Session, user_id: int) -> None:
    # Set transaction-local context for PostgreSQL RLS policies.
    db.execute(
        text("SELECT set_config('app.current_user_id', :user_id, true)"),
        {"user_id": str(user_id)},
    )

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Handle dev mode token
    if token == "dev-mock-token" and _is_dev_mock_enabled():
        user = db.query(User).filter(User.email == "dev@test.com").first()
        if not user:
             # Create dev user if not exists
             user = User(email="dev@test.com", hashed_password="mocked_password", is_pro=True)
             db.add(user)
             db.commit()
             db.refresh(user)
        if not user.is_pro:
            user.is_pro = True
            db.commit()
        _set_db_user_context(db, user.id)
        return user

    try:
        # Supabase JWT secret is used to sign the tokens (HS256) 
        # or Public Key is used to verify them (ES256)
        key = settings.supabase_jwt_public_key if settings.supabase_jwt_algorithm == "ES256" else settings.jwt_secret
        payload = jwt.decode(
            token, 
            key, 
            algorithms=[settings.supabase_jwt_algorithm], 
            options={"verify_aud": False}
        )
        email: str = payload.get("email")
        supabase_id: str = payload.get("sub")
        if email is None or supabase_id is None:
            raise credentials_exception
    except JWTError as e:
        print(f"JWT verification failed: {e}")
        raise credentials_exception
    
    # Try to find by supabase_id first, then by email
    user = db.query(User).filter(User.supabase_id == supabase_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Link existing user with supabase_id
            user.supabase_id = supabase_id
            db.commit()
    
    if user is None:
        # Auto-provision user from Supabase
        user = User(email=email, supabase_id=supabase_id, hashed_password="external_auth_no_password")
        db.add(user)
        db.commit()
        db.refresh(user)

    _set_db_user_context(db, user.id)
    return user

def get_optional_current_user(token: Optional[str] = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)):
    """Like get_current_user but returns None instead of raising on auth failure."""
    if token is None:
        return None
    try:
        return get_current_user(token=token, db=db)
    except HTTPException:
        return None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expires_min)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm="HS256")
    return encoded_jwt
