from app.database import Base
from .vehicle import Vehicle
from .cubage_profile import CubageProfile
from .collection_point import CollectionPoint
from .route import Route
from .settings import Settings
from .user import User

# Exporta os modelos para serem importados de app.models
__all__ = [
    'Base', 
    'Vehicle', 
    'CubageProfile', 
    'CollectionPoint',
    'Route', 
    'Settings',
    'User'
]
