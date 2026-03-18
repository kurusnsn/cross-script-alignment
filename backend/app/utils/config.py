from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"  # Ignore extra fields in .env
    )

    database_url: str
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    jwt_secret: str
    deployment_env: str = "production"
    enable_dev_mock_user: bool = False
    jwt_expires_min: int = 10080
    
    # S3 / AWS Configuration
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: str = "us-east-1"
    s3_bucket_name: Optional[str] = None
    s3_endpoint_url: Optional[str] = None
    
    # Supabase
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    supabase_jwt_secret: Optional[str] = None
    supabase_jwt_public_key: Optional[str] = None
    supabase_jwt_algorithm: str = "HS256"
    
    # Stripe
    stripe_api_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_price_id_pro: Optional[str] = None
    
    # Observability
    sentry_dsn: Optional[str] = None
    otel_exporter_otlp_endpoint: Optional[str] = None
    otel_service_name: str = "align-backend"
    
    log_level: str = "INFO"
    use_light_translator: bool = False
    translator_max_new_tokens: int = 64
    clts_path: Optional[Path] = None
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    openai_timeout: int = 30  # 30 second timeout
    groq_api_key: Optional[str] = None
    groq_model: str = "llama-3.3-70b-versatile"
    tts_service_url: str = "http://localhost:8001"
    google_project_id: Optional[str] = None
    google_location: str = "us"
    document_ai_processor_id: Optional[str] = None
    # Redis Configuration
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_username: Optional[str] = None
    redis_password: Optional[str] = None
    redis_enabled: bool = True

    allowed_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3003",
        "http://127.0.0.1:3003",
    ]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
