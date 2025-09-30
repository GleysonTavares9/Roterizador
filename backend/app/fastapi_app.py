import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .config import settings
from .routers import (
    auth,
    vehicles,
    collection_points,
    cubage_profiles,
    routes,
    optimization,
    health,
    integrations,
    export,
    reports,
    settings as app_settings, # Renomeado para evitar conflito
    upload,
)

# Configuração de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_app() -> FastAPI:
    """Cria e configura a aplicação FastAPI."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="API para otimização de rotas de coleta de resíduos.",
    )

    # Configuração do CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS or ["*"],  # Fallback para permitir tudo
        allow_credentials=True,
        allow_methods=["*"]
        ,
        allow_headers=["*"],
    )

    # Evento de startup para criar tabelas no banco de dados
    @app.on_event("startup")
    def on_startup():
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Tabelas do banco de dados criadas com sucesso.")
        except Exception as e:
            logger.error(f"Erro ao criar tabelas do banco de dados: {e}")

    # Endpoint raiz
    @app.get("/", tags=["Root"])
    async def read_root():
        return {"message": f"Bem-vindo à {settings.APP_NAME}"}

    # Inclusão dos roteadores da API
    API_PREFIX = "/api/v1"
    app.include_router(health.router, prefix=API_PREFIX) # Roteador de health sem prefixo de tag
    app.include_router(auth.router, prefix=f"{API_PREFIX}/auth")
    app.include_router(vehicles.router, prefix=f"{API_PREFIX}/vehicles")
    app.include_router(collection_points.router, prefix=f"{API_PREFIX}/collection-points")
    app.include_router(cubage_profiles.router, prefix=f"{API_PREFIX}/cubage-profiles")
    app.include_router(routes.router, prefix=f"{API_PREFIX}/routes")
    app.include_router(optimization.router, prefix=f"{API_PREFIX}/optimization")
    app.include_router(integrations.router, prefix=f"{API_PREFIX}/integrations")
    app.include_router(export.router, prefix=f"{API_PREFIX}/export")
    app.include_router(reports.router, prefix=f"{API_PREFIX}/reports")
    app.include_router(app_settings.router, prefix=f"{API_PREFIX}/settings")
    app.include_router(upload.router, prefix=f"{API_PREFIX}/upload")

    return app

# Cria a instância da aplicação
app = create_app()

# Bloco para execução em modo de desenvolvimento
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
