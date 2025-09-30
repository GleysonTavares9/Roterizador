from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from fastapi import Request

from app.config import settings

# Cria a engine do SQLAlchemy usando a URL do banco de dados das configurações
engine = create_engine(
    settings.DATABASE_URL,
    # connect_args é específico para SQLite e necessário para permitir o uso em múltiplos threads
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

# Cria uma fábrica de sessões
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Classe base para os modelos do SQLAlchemy
Base = declarative_base()

def get_db(request: Request) -> Session:
    """
    Dependência do FastAPI que fornece uma sessão de banco de dados por requisição.
    A sessão é obtida do estado da requisição, que é gerenciado por um middleware.
    """
    return request.state.db
