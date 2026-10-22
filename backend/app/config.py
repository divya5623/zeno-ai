import os
from typing import List, Union
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    DATABASE_URL: str = "sqlite:///./solvely.db"
    SECRET_KEY: str = "solvely-super-secret-jwt-key-2026-production-ready"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_MINI_MODEL: str = "gpt-4o-mini"

    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"

    PINECONE_API_KEY: str = ""
    PINECONE_ENVIRONMENT: str = "us-east-1"
    PINECONE_INDEX_NAME: str = "solvely-knowledge-base"

    CORS_ORIGINS: Union[List[str], str] = ["*"]

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

def get_settings() -> Settings:
    return settings
