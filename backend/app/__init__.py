"""
Módulo principal da aplicação.

Este módulo contém a configuração básica da aplicação e suas dependências.
"""

# Importação de todos os esquemas do pacote schemas
from .schemas import (
    # Esquemas de usuário
    User,
    UserCreate,
    UserInDB,
    Token,
    TokenData,
    # Demais esquemas
    Vehicle,
    VehicleCreate,
    VehicleUpdate,
    CubageProfile,
    CubageProfileCreate,
    CubageProfileUpdate,
    CollectionPoint,
    CollectionPointCreate,
    CollectionPointUpdate,
    Route,
    RouteCreate,
    RouteUpdate,
    RouteGeneration,
    RouteOptimizationResponse
)

# Importa os roteadores
from .routers import (
    auth,
    vehicles,
    cubage_profiles,
    collection_points,
    routes
)

def create_app():
    """Cria e retorna a instância do aplicativo FastAPI."""
    from .fastapi_app import app
    # Inclui os roteadores
    from .routers import routes as router_routes
    app.include_router(router_routes.router, prefix="/api/v1/routes", tags=["routes"])
    return app

__all__ = [
    'create_app',
    # Esquemas de usuário
    'User',
    'UserCreate',
    'UserInDB',
    'Token',
    'TokenData',
    # Demais esquemas
    'Vehicle',
    'VehicleCreate',
    'VehicleUpdate',
    'CubageProfile',
    'CubageProfileCreate',
    'CubageProfileUpdate',
    'CollectionPoint',
    'CollectionPointCreate',
    'CollectionPointUpdate',
    'Route',
    'RouteCreate',
    'RouteUpdate',
    'RouteGeneration',
    'RouteOptimizationResponse',
]
