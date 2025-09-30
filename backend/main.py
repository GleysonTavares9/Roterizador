import logging
import time
from fastapi import FastAPI, Request, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.routers import (
    auth, 
    collection_points, 
    routes, 
    vehicles, 
    cubage_profiles, 
    settings as app_settings,
    export, 
    reports, 
    health, 
    integrations,
    optimize
)

# Configuração do logging
logging.basicConfig(level=logging.INFO if settings.DEBUG else logging.WARNING)
logger = logging.getLogger(__name__)

def create_app() -> FastAPI:
    """Cria e configura a instância da aplicação FastAPI."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json"
    )

    # Configura o CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"]
    )

    # Middleware para gerenciar a sessão do banco de dados
    @app.middleware("http")
    async def db_session_middleware(request: Request, call_next):
        request.state.db = SessionLocal()
        try:
            response = await call_next(request)
        finally:
            request.state.db.close()
        return response

    # Middleware para log de requisições
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        logger.info(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.2f}ms")
        return response

    # Tratador de exceção global
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Erro inesperado: {exc} - na rota {request.url.path}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Ocorreu um erro interno no servidor."}
        )

    # Inclusão dos roteadores
    api_prefix = "/api/v1"
    app.include_router(auth.router, prefix=f"{api_prefix}/auth", tags=["auth"])
    app.include_router(collection_points.router, prefix=api_prefix, tags=["collection-points"])
    app.include_router(routes.router, prefix=api_prefix, tags=["routes"])
    app.include_router(vehicles.router, prefix=api_prefix, tags=["vehicles"])
    app.include_router(cubage_profiles.router, prefix=api_prefix, tags=["cubage-profiles"])
    app.include_router(app_settings.router, prefix=api_prefix, tags=["settings"])
    app.include_router(export.router, prefix=api_prefix, tags=["export"])
    app.include_router(reports.router, prefix=api_prefix, tags=["reports"])
    app.include_router(health.router, prefix=api_prefix, tags=["health"])
    app.include_router(integrations.router, prefix=api_prefix, tags=["integrations"])
    app.include_router(optimize.router, prefix=api_prefix, tags=["optimize"])

    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.UVICORN_HOST,
        port=settings.UVICORN_PORT,
        reload=settings.UVICORN_RELOAD
    )
