"""
Módulo de health check da API.

Contém rotas para verificação de status e health checks.
"""
from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["Health"])

class HealthCheckResponse(BaseModel):
    """Modelo de resposta para o health check."""
    status: str
    timestamp: str
    version: str = "1.0.0"

@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """
    Verifica a saúde da API.
    
    Retorna o status atual da API e informações básicas.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

@router.get("/status")
async def get_status():
    """
    Retorna o status da API.
    
    Útil para verificar se a API está online.
    """
    return {
        "status": "online",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "Sistema de Roteirização de Coleta",
        "version": "1.0.0"
    }
