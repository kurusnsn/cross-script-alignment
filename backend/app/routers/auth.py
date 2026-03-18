from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.persistence_models import User
from app.services.auth_service import verify_password, get_password_hash, create_access_token
from pydantic import BaseModel, EmailStr, field_validator
from app.utils.rate_limit import limiter, RateLimits
from app.utils.tracing import trace_span, SpanNames

router = APIRouter(prefix="/auth", tags=["auth"])

class UserCreate(BaseModel):
    email: EmailStr
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/register", response_model=Token)
@limiter.limit(RateLimits.REGISTER)
def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    with trace_span(SpanNames.AUTH_PASSWORD_HASH):
        hashed_password = get_password_hash(user_data.password)
    
    new_user = User(email=user_data.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    with trace_span(SpanNames.AUTH_VERIFY_TOKEN):
        access_token = create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
@limiter.limit(RateLimits.LOGIN)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    
    with trace_span(SpanNames.AUTH_PASSWORD_VERIFY):
        password_verified = verify_password(form_data.password, user.hashed_password) if user else False
    
    if not user or not password_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    with trace_span(SpanNames.AUTH_VERIFY_TOKEN):
        access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}
