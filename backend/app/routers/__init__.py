from .vehicles import router as vehicles_router
from .cubage_profiles import router as cubage_profiles_router
from .collection_points import router as collection_points_router
from .settings import router as settings_router
from .export import router as export_router
from .reports import router as reports_router
from . import health as health_router
from .integrations import router as integrations_router
from .auth import router as auth_router
from .routes import router as routes_router
from .optimize import router as optimize_router
# Exporta os roteadores para facilitar as importações
__all__ = [
    'vehicles_router',
    'cubage_profiles_router',
    'collection_points_router',
    'settings_router',
    'export_router',
    'reports_router',
    'health_router',
    'integrations_router',
    'auth_router',  # Mantendo o nome antigo para compatibilidade
    'routes_router',
    'optimize_router'
]
