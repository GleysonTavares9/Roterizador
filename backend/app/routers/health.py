from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings

router = APIRouter()

class HealthCheckResponse(BaseModel):
    """Modelo de resposta para o health check."""
    status: str
    timestamp: str
    app_name: str
    app_version: str

@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """
    Verifica a saúde da API.
    
    Retorna o status atual da API e informações básicas da aplicação.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "app_name": settings.APP_NAME,
        "app_version": settings.APP_VERSION
    }
