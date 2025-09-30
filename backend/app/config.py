import os
from pydantic_settings import BaseSettings
from typing import List, Union

class Settings(BaseSettings):
    # Configurações da aplicação
    APP_NAME: str = "API de Otimização de Rotas"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.environ.get('DEBUG', 'False') == 'True'

    # Configurações do banco de dados
    DATABASE_URL: str = os.environ.get('DATABASE_URL', 'sqlite:///./roteirizacao.db')

    # Configurações de CORS
    CORS_ORIGINS: Union[str, List[str]] = os.environ.get('CORS_ORIGINS', '["*"]')

    # Configurações de segurança
    SECRET_KEY: str = os.environ.get('SECRET_KEY', 'super-secret-key') # Chave para JWT
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Configurações do servidor Uvicorn
    UVICORN_HOST: str = '0.0.0.0'
    UVICORN_PORT: int = 8000
    UVICORN_RELOAD: bool = DEBUG

    class Config:
        # Carrega variáveis de um arquivo .env, se existir
        env_file = ".env"
        env_file_encoding = 'utf-8'

# Instância única das configurações
settings = Settings()
