from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.utils.config import get_settings
from typing import Optional

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_supabase_token(token: str = Depends(oauth2_scheme)):
    if not settings.supabase_jwt_secret:
        # Fallback for development if not configured
        return {"sub": "dev-user", "email": "dev@example.com"}
        
    try:
        key = settings.supabase_jwt_public_key if settings.supabase_jwt_algorithm == "ES256" else settings.supabase_jwt_secret
        
        if not key:
            raise JWTError("No secret or public key configured for JWT verification")

        payload = jwt.decode(
            token, 
            key, 
            algorithms=[settings.supabase_jwt_algorithm],
            options={"verify_aud": False}
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Future: Add Supabase client initialization here if needed for DB direct access
