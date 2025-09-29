from typing import Generator
from sqlalchemy.orm import Session
from ..database import SessionLocal

def get_db() -> Generator[Session, None, None]:
    """
    Gera uma sessão do banco de dados para cada requisição.
    
    Yields:
        Session: Sessão do banco de dados
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Exporta as funções e classes necessárias
__all__ = ['get_db']
