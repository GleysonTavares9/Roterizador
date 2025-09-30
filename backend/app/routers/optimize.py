import asyncio
import time
import logging
import hashlib
import json
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator

from app.database import get_db
from app.Roterizador.optimization import RobustRouter

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/optimize",
    tags=["optimization"],
    responses={404: {"description": "Not found"}},
)

# Cache para instâncias do solver e resultados
solvers: Dict[str, RobustRouter] = {}
optimization_cache: Dict[str, dict] = {}

# Modelos Pydantic com validação aprimorada
class Vehicle(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    capacity: float = Field(..., gt=0)  # gt = greater than
    max_weight: float = Field(..., gt=0)
    volume_capacity: float = Field(..., gt=0)
    length: float = Field(..., gt=0)
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)
    start_time: str = Field(..., pattern=r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$")
    end_time: str = Field(..., pattern=r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$")
    speed: float = Field(..., gt=0)

class Point(BaseModel):
    id: str = Field(..., min_length=1)
    type: str
    name: str
    address: str
    lat: float
    lng: float
    order: int
    quantity: int = Field(..., ge=0) # ge = greater than or equal to
    weight: float = Field(..., ge=0)
    volume: float = Field(..., ge=0)
    time_window_start: str = Field(..., pattern=r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$")
    time_window_end: str = Field(..., pattern=r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$")
    service_time: int = Field(..., ge=0)
    priority: int

class OptimizationOptions(BaseModel):
    max_radius_km: float = Field(default=50.0, gt=0)

class RouteOptimizationRequest(BaseModel):
    name: str
    description: str
    vehicles: List[Vehicle]
    points: List[Point]
    options: Optional[OptimizationOptions] = None

    @validator('vehicles', 'points')
    def check_not_empty(cls, v):
        if not v:
            raise HTTPException(status_code=422, detail="A lista não pode estar vazia.")
        return v

class OptimizationStatusResponse(BaseModel):
    request_id: str
    status: str
    message: Optional[str] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None


def get_solver(session_id: str) -> RobustRouter:
    """Obtém ou cria uma instância do solver para a sessão."""
    if session_id not in solvers:
        solvers[session_id] = RobustRouter()
    return solvers[session_id]

async def run_optimization(solver: RobustRouter, request_data: dict, request_id: str):
    """Executa a otimização em segundo plano."""
    try:
        start_time = time.time()
        logger.info(f"[OPTIMIZE] Iniciando otimização {request_id}")
        
        result = solver.solve_from_json(request_data, method='vnd')
        if not result or result.get("error"):
            raise ValueError(result.get("error", "Solução não encontrada."))

        total_time = time.time() - start_time
        optimization_cache[request_id] = {
            'status': 'completed',
            'result': result,
            'execution_time': total_time
        }
        logger.info(f"[OPTIMIZE] Otimização {request_id} concluída em {total_time:.2f}s")

    except Exception as e:
        logger.error(f"[OPTIMIZE] Erro na otimização {request_id}: {e}", exc_info=True)
        optimization_cache[request_id] = {'status': 'error', 'error': str(e)}

@router.post("", response_model=OptimizationStatusResponse)
async def start_optimization(
    optimization_request: RouteOptimizationRequest,
    background_tasks: BackgroundTasks,
    request: Request
):
    """Inicia o processo de otimização de rotas."""
    try:
        session_id = request.headers.get('x-session-id', 'default')
        solver = get_solver(session_id)

        request_hash = hashlib.md5(json.dumps(optimization_request.dict(), sort_keys=True).encode()).hexdigest()
        request_id = f"opt_{int(time.time())}_{request_hash[:8]}"

        background_tasks.add_task(run_optimization, solver, optimization_request.dict(), request_id)
        
        optimization_cache[request_id] = {'status': 'processing'}
        
        logger.info(f"[OPTIMIZE] Requisição {request_id} recebida e em processamento.")
        return OptimizationStatusResponse(request_id=request_id, status="processing", message="Otimização em andamento")

    except Exception as e:
        logger.error(f"Erro ao iniciar otimização: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Erro interno ao iniciar a otimização.")

@router.get("/{request_id}/status", response_model=OptimizationStatusResponse)
async def check_optimization_status(request_id: str):
    """Verifica o status de uma otimização."""
    status = optimization_cache.get(request_id)
    if not status:
        raise HTTPException(status_code=404, detail="Requisição não encontrada.")
    return OptimizationStatusResponse(request_id=request_id, **status)
