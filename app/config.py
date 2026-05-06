from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://user:password@localhost:5432/panda_vision_recruit"

    # Pipedrive
    pipedrive_api_key: str = ""
    pipedrive_base_url: str = "https://api.pipedrive.com/v1"

    # Application
    app_name: str = "Panda-Vision Recruit"
    app_version: str = "0.1.0"
    debug: bool = False

    # Logging
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
