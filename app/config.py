from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://user:password@localhost:5432/panda_vision_recruit"

    # Pipedrive
    pipedrive_api_key: str = ""
    pipedrive_base_url: str = "https://api.pipedrive.com/v1"

    # Azure / Microsoft Graph
    azure_tenant_id: str = ""
    azure_client_id: str = ""
    azure_client_secret: str = ""
    email_address: str = "jobs@pandatech.co.il"

    # Email scanning
    email_scan_interval_minutes: int = 30
    email_scan_limit: int = 50

    # Claude API
    anthropic_api_key: str = ""
    claude_model: str = "claude-opus-4-7"

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
