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
from pydantic import BaseModel

from app import models, schemas
from app.database import get_db
from .optimization import RobustRouter

# Configuração de logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="",  # Removendo o prefixo aqui, pois já está sendo definido no main.py
    tags=["optimization"],
    responses={404: {"description": "Not found"}},
)

# Adicionando rota de teste
@router.get("/test")
async def test_route():
    logger.info("Rota de teste acessada com sucesso!")
    return {"message": "Rota de teste funcionando!"}

# Cache para instâncias do solver por usuário/sessão
solvers: Dict[str, RobustRouter] = {}

# Cache para resultados de otimização
optimization_cache: Dict[str, dict] = {}

class Vehicle(BaseModel):
    id: str
    name: str
    capacity: float
    max_weight: float
    volume_capacity: float
    length: float
    width: float
    height: float
    start_time: str
    end_time: str
    speed: float

class Point(BaseModel):
    id: str
    type: str
    name: str
    address: str
    lat: float
    lng: float
    order: int
    quantity: int
    weight: float
    volume: float
    time_window_start: str
    time_window_end: str
    service_time: int
    priority: int

class OptimizationOptions(BaseModel):
    max_radius_km: float = 50.0

class RouteOptimizationRequest(BaseModel):
    name: str
    description: str
    vehicles: List[Vehicle]
    points: List[Point]
    options: OptimizationOptions = None

class OptimizationStatusResponse(BaseModel):
    request_id: str
    status: str
    message: Optional[str] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None
    completed_at: Optional[str] = None

def get_solver(session_id: str) -> RobustRouter:
    """Obtém ou cria uma instância do solver para a sessão."""
    if session_id not in solvers:
        solvers[session_id] = RobustRouter()
    return solvers[session_id]

async def run_optimization(
    solver: RobustRouter, 
    request_data: dict, 
    request_id: str,
    db: Session
):
    """
    Executa a otimização em uma tarefa em segundo plano.
    
    Args:
        solver: Instância do RobustRouter para realizar a otimização
        request_data: Dados da requisição de otimização
        request_id: ID único para rastreamento da requisição
        db: Sessão do banco de dados
        
    Returns:
        None: O resultado é armazenado no cache de otimização
    """
    try:
        # Registra o início da otimização
        start_time = time.time()
        logger.info(f"[OPTIMIZE] Iniciando otimização {request_id}")
        logger.debug(f"[OPTIMIZE] Dados da requisição: {json.dumps(request_data, default=str)}")
        
        # Valida os dados de entrada
        if not request_data.get('vehicles'):
            raise ValueError("Nenhum veículo fornecido")
            
        if not request_data.get('points'):
            raise ValueError("Nenhum ponto de entrega fornecido")
        
        logger.info(f"[OPTIMIZE] Processando {len(request_data['points'])} pontos e {len(request_data['vehicles'])} veículos")
        
        try:
            # Executa a otimização usando o método solve_from_json
            # Isso irá limpar os dados anteriores, converter os dados e carregar o mapa
            result = solver.solve_from_json(request_data, method='vnd')
        except Exception as e:
            logger.error(f"[OPTIMIZE] Erro durante a solução do problema: {str(e)}", exc_info=True)
            raise ValueError(f"Erro durante a solução do problema: {str(e)}")
        
        if not result:
            error_msg = "Não foi possível encontrar uma solução viável para o problema de roteamento"
            logger.error(f"[OPTIMIZE] {error_msg}")
            raise HTTPException(
                status_code=500,
                detail=error_msg
            )
        
        # Calcula o tempo total
        total_time = time.time() - start_time
        logger.info(f"[OPTIMIZE] Otimização {request_id} concluída em {total_time:.2f} segundos")
        
        # Armazena o resultado no cache
        optimization_cache[request_id] = {
            'status': 'completed',
            'result': result,
            'execution_time': total_time,
            'completed_at': datetime.utcnow().isoformat()
        }
        
        logger.debug(f"[OPTIMIZE] Resultado armazenado em cache para a requisição {request_id}")
        
    except HTTPException:
        # Re-lança exceções HTTP
        raise
        
    except Exception as e:
        error_msg = f"Erro durante a otimização {request_id}: {str(e)}"
        logger.error(f"[OPTIMIZE] {error_msg}", exc_info=True)
        
        # Armazena o erro no cache
        optimization_cache[request_id] = {
            'status': 'error',
            'error': str(e),
            'completed_at': datetime.utcnow().isoformat()
        }
        
        # Lança uma exceção HTTP 500 com detalhes do erro
        raise HTTPException(
            status_code=500,
            detail=f"Erro durante a otimização: {str(e)}"
        )
    finally:
        # Limpa o cache após 1 hora
        await asyncio.sleep(3600)
        optimization_cache.pop(request_id, None)

@router.post("", response_model=OptimizationStatusResponse)
async def start_optimization(
    request: Request,
    optimization_request: RouteOptimizationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Inicia o processo de otimização de rotas.
    
    Args:
        request: Objeto de requisição HTTP
        optimization_request: Dados para otimização
        background_tasks: Gerenciador de tarefas em segundo plano
        db: Sessão do banco de dados
        
    Returns:
        dict: ID da requisição e status inicial
    """
    logger.info("[OPTIMIZE] Iniciando nova requisição de otimização")
    
    try:
        # Valida os dados de entrada
        if not optimization_request.vehicles:
            error_msg = "Nenhum veículo fornecido para otimização"
            logger.error(f"[OPTIMIZE] {error_msg}")
            raise HTTPException(
                status_code=400,
                detail=error_msg
            )
            
        if not optimization_request.points:
            error_msg = "Nenhum ponto de entrega fornecido para otimização"
            logger.error(f"[OPTIMIZE] {error_msg}")
            raise HTTPException(
                status_code=400,
                detail=error_msg
            )
        
        # Gera um ID único para a requisição
        request_hash = hashlib.md5(str(optimization_request.dict()).encode()).hexdigest()
        request_id = f"opt_{int(time.time())}_{request_hash[:8]}"
        
        # Obtém o ID da sessão do header ou usa um valor padrão
        session_id = request.headers.get('x-session-id', 'default')
        
        logger.info(f"[OPTIMIZE] Nova requisição {request_id} na sessão {session_id}")
        logger.debug(f"[OPTIMIZE] Dados da requisição: {optimization_request.dict()}")
        
        # Obtém ou cria uma instância do solver para a sessão
        logger.debug(f"[OPTIMIZE] Obtendo solver para a sessão {session_id}")
        solver = get_solver(session_id)
        
        # Adiciona a tarefa em segundo plano
        logger.debug(f"[OPTIMIZE] Adicionando tarefa em segundo plano para a requisição {request_id}")
        background_tasks.add_task(
            run_optimization,
            solver=solver,
            request_data=optimization_request.dict(),
            request_id=request_id,
            db=db
        )
        
        # Armazena os dados iniciais no cache
        optimization_cache[request_id] = {
            'status': 'processing',
            'started_at': datetime.utcnow().isoformat(),
            'vehicles': [v.dict() for v in optimization_request.vehicles],
            'points': [p.dict() for p in optimization_request.points],
            'options': optimization_request.options.dict() if optimization_request.options else {}
        }
        
        logger.info(f"[OPTIMIZE] Otimização {request_id} iniciada com sucesso")
        
        return {
            "request_id": request_id,
            "status": "processing",
            "message": "Otimização em andamento",
            "started_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        # Re-lança exceções HTTP
        raise
        
    except Exception as e:
        error_msg = f"Erro ao iniciar otimização: {str(e)}"
        logger.error(f"[OPTIMIZE] {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )

@router.get("/{request_id}/status", response_model=OptimizationStatusResponse)
async def check_optimization_status(request_id: str):
    logger.info(f"Verificando status da requisição: {request_id}")
    """
    Verifica o status de uma otimização em andamento.
    
    Args:
        request_id: ID da requisição de otimização
        
    Returns:
        dict: Status da otimização com os resultados ou mensagem de erro
    """
    logger.info(f"[STATUS] Verificando status da requisição {request_id}")
    
    try:
        # Obtém o resultado do cache
        result = optimization_cache.get(request_id)
        
        if not result:
            error_msg = f"Requisição {request_id} não encontrada ou expirada"
            logger.warning(f"[STATUS] {error_msg}")
            raise HTTPException(
                status_code=404, 
                detail=error_msg
            )
        
        logger.debug(f"[STATUS] Status da requisição {request_id}: {result.get('status')}")
        
        # Retorna o status apropriado
        if result['status'] == 'completed':
            response = {
                "request_id": request_id,
                "status": "completed",
                "result": result.get('result', {}),
                "execution_time": result.get('execution_time'),
                "completed_at": result.get('completed_at')
            }
            logger.info(f"[STATUS] Requisição {request_id} concluída com sucesso")
            return response
            
        elif result['status'] == 'error':
            error_msg = result.get('error', 'Erro desconhecido durante a otimização')
            response = {
                "request_id": request_id,
                "status": "error",
                "error": error_msg,
                "completed_at": result.get('completed_at')
            }
            logger.error(f"[STATUS] Erro na requisição {request_id}: {error_msg}")
            return response
            
        else:
            response = {
                "request_id": request_id,
                "status": "processing",
                "message": "Otimização em andamento"
            }
            logger.debug(f"[STATUS] Requisição {request_id} ainda em processamento")
            return response
            
    except HTTPException:
        # Re-lança exceções HTTP
        raise
        
    except Exception as e:
        error_msg = f"Erro ao verificar status da requisição {request_id}: {str(e)}"
        logger.error(f"[STATUS] {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )

# Exporta o router para ser usado no FastAPI app
# O router já está definido e configurado no início do arquivo
__all__ = ['router']
