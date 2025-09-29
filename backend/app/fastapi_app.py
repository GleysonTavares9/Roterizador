"""
Ponto de entrada principal da aplicação FastAPI.
"""
import os
import logging
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
import os

# Configuração do logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("route_optimization.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Importa os roteadores
from app.routers import (
    auth,
    vehicles,
    collection_points,
    routes,
    health,
    settings,
    cubage_profiles,
    reports,
    export,
    integrations,
    upload,
    optimize,
    auth_router as auth
)

# Importa o banco de dados
from app.database import Base, engine, get_db

def create_app():
    """Cria e configura a aplicação FastAPI."""
    # Cria a aplicação FastAPI
    app = FastAPI(
        title="Sistema de Roteirização de Coleta de Resíduos",
        description="API para otimização de rotas de coleta de resíduos",
        version="1.0.0"
    )
    
    # Configuração do CORS para desenvolvimento
    # Em produção, substitua "*" por uma lista de origens permitidas
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],  # Permite apenas o frontend em desenvolvimento
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=600,  # 10 minutos
    )
    
    # Middleware para log de requisições
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        logger.info(f"Recebida requisição: {request.method} {request.url}")
        logger.info(f"Headers: {request.headers}")
        response = await call_next(request)
        return response

    # Inicialização do banco de dados
    @app.on_event("startup")
    async def startup():
        try:
            # Cria as tabelas se não existirem
            Base.metadata.create_all(bind=engine)
            logger.info("Banco de dados inicializado com sucesso")
        except Exception as e:
            logger.error(f"Erro ao inicializar o banco de dados: {e}")
            raise

    # Configuração para servir arquivos estáticos
    app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")
    
    # Rota para o favicon
    @app.get("/favicon.ico", include_in_schema=False)
    async def get_favicon():
        favicon_path = os.path.join(os.path.dirname(__file__), "static", "favicon.svg")
        if os.path.exists(favicon_path):
            return FileResponse(favicon_path, media_type="image/svg+xml")
        raise HTTPException(status_code=404, detail="Favicon não encontrado")
    
    # Rota raiz
    @app.get("/")
    async def root():
        """Rota raiz da API."""
        return {"message": "Bem-vindo à API de Roteirização de Coleta de Resíduos"}

    # Rota de saúde
    @app.get("/api/v1/health", tags=["health"])
    @app.get("/health", include_in_schema=False)
    async def health_check(db: Session = Depends(get_db)):
        """Verifica a saúde da API e a conexão com o banco de dados."""
        try:
            # Testa a conexão com o banco de dados
            db.execute(text("SELECT 1"))
            response = JSONResponse(
                content={
                    "status": "healthy",
                    "database": "connected"
                },
                status_code=200
            )
            # Adiciona cabeçalhos CORS manualmente
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            return response
        except Exception as e:
            logger.error(f"Erro na verificação de saúde: {e}")
            error_response = JSONResponse(
                status_code=500,
                content={"detail": "Erro na conexão com o banco de dados"}
            )
            error_response.headers["Access-Control-Allow-Origin"] = "*"
            error_response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            error_response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            return error_response

    # Inclui os roteadores na aplicação
    from app.routers.auth import router as auth_router
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["authentication"])
    app.include_router(vehicles.router, prefix="/api/v1/vehicles", tags=["vehicles"])
    app.include_router(cubage_profiles.router, prefix="/api/v1/cubage-profiles", tags=["cubage-profiles"])
    app.include_router(collection_points.router, prefix="/api/v1/collection-points", tags=["collection-points"])
    
    # Outros roteadores
    app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
    app.include_router(settings.router, prefix="/api/v1/settings", tags=["settings"])
    app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
    app.include_router(export.router, prefix="/api/v1/export", tags=["export"])
    app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["integrations"])
    app.include_router(upload.router, prefix="/api/v1/upload", tags=["upload"])
    app.include_router(optimize.router, prefix="/api/v1/optimize", tags=["optimize"])

    # Middleware para log de requisições
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        logger.info(f"Requisição recebida: {request.method} {request.url}")
        try:
            response = await call_next(request)
            logger.info(f"Resposta: {response.status_code}")
            return response
        except Exception as e:
            logger.error(f"Erro na requisição: {str(e)}")
            return JSONResponse(
                status_code=500,
                content={"detail": "Erro interno do servidor"}
            )

    return app

# Cria a instância do aplicativo
app = create_app()

# Executa o servidor de desenvolvimento se este arquivo for executado diretamente
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.fastapi_app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
