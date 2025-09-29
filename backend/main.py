"""
Ponto de entrada principal da aplicação.
"""
import os
import sys
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.routers import (
    routes_router,
    auth_router,
    vehicles_router,
    collection_points_router,
    cubage_profiles_router,
    settings_router,
    export_router,
    reports_router,
    health_router,
    integrations_router
)
from app.routers.optimize import router as optimize_router
from app.database import get_db
import time
import logging
from typing import Generator
from sqlalchemy.orm import Session

# Adiciona o diretório atual ao PATH
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="API de Otimização de Rotas",
    description="API para otimização de rotas com múltiplas restrições",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Configuração do CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, substituir por origens específicas
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600,  # 10 minutos
)

# Middleware para log de requisições
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    logger.info(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.2f}ms")
    return response

# Tratamento de erros
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Erro de validação: {exc}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

# Inclui os roteadores
app.include_router(
    routes_router,
    prefix="/api/v1",
    tags=["routes"],
    responses={404: {"description": "Não encontrado"}}
)

app.include_router(
    auth_router,
    prefix="/api/v1/auth",
    tags=["auth"],
    responses={401: {"description": "Não autorizado"}}
)

# Otimização de rotas
app.include_router(
    optimize_router,
    prefix="/api/v1/optimize",
    tags=["optimize"],
    responses={500: {"description": "Erro interno do servidor"}}
)

# Outros roteadores da aplicação
app.include_router(
    vehicles_router,
    prefix="/api/v1/vehicles",
    tags=["vehicles"],
    responses={404: {"description": "Veículo não encontrado"}}
)

app.include_router(
    collection_points_router,
    prefix="/api/v1",  # The /collection-points prefix is now in the router
    tags=["collection-points"],
    responses={404: {"description": "Ponto de coleta não encontrado"}}
)

app.include_router(
    cubage_profiles_router,
    prefix="/api/v1/cubage-profiles",
    tags=["cubage-profiles"],
    responses={404: {"description": "Perfil de cubagem não encontrado"}}
)

app.include_router(
    settings_router,
    prefix="/api/v1/settings",
    tags=["settings"],
    responses={404: {"description": "Configuração não encontrada"}}
)

app.include_router(
    export_router,
    prefix="/api/v1/export",
    tags=["export"],
    responses={500: {"description": "Erro ao exportar dados"}}
)

app.include_router(
    reports_router,
    prefix="/api/v1/reports",
    tags=["reports"],
    responses={500: {"description": "Erro ao gerar relatório"}}
)

app.include_router(
    health_router.router,
    prefix="/api/v1/health",
    tags=["health"],
    responses={200: {"description": "Serviço saudável"}}
)

app.include_router(
    integrations_router,
    prefix="/api/v1/integrations",
    tags=["integrations"],
    responses={500: {"description": "Erro na integração"}}
)

# Permite executar com: python main.py
def log_routes(app: FastAPI):
    """Log all registered routes for debugging"""
    print("\n=== REGISTERED ROUTES ===")
    for route in app.routes:
        if hasattr(route, 'methods'):
            print(f"{', '.join(route.methods)} {route.path}")
    print("======================\n")

# Log all routes when the application starts
log_routes(app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["app"],
        log_level="info"
    )
