from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, event
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from sqlalchemy.orm import validates
from app.database import Base

# Constantes para validação
MIN_VEHICLE_LENGTH = 1.0  # 1 metro
MAX_VEHICLE_LENGTH = 20.0  # 20 metros
MIN_WEIGHT = 0.1  # 100 gramas
MAX_WEIGHT = 50000.0  # 50 toneladas

class Vehicle(Base):
    """
    Modelo para armazenar informações dos veículos da frota.
    
    Atributos:
        id (int): Identificador único do veículo
        name (str): Nome ou identificação do veículo
        description (str): Descrição detalhada do veículo
        capacity (float): Capacidade de carga em kg
        max_weight (float): Peso máximo suportado em kg
        length (float): Comprimento do veículo em metros
        width (float): Largura do veículo em metros
        height (float): Altura do veículo em metros
        is_active (bool): Indica se o veículo está ativo
        created_at (datetime): Data de criação do registro
        updated_at (datetime): Data da última atualização
        cubage_profile_id (int): Referência ao perfil de cubagem
    """
    __tablename__ = "vehicles"
    
    id = Column(Integer, primary_key=True, index=True, comment='Identificador único do veículo')
    name = Column(String(100), nullable=False, unique=True, index=True, 
                 comment='Nome ou identificação do veículo')
    description = Column(Text, nullable=True, comment='Descrição detalhada do veículo')
    capacity = Column(Float, nullable=False, comment='Capacidade de carga em kg')
    max_weight = Column(Float, nullable=False, comment='Peso máximo suportado em kg')
    length = Column(Float, nullable=False, comment='Comprimento do veículo em metros')
    width = Column(Float, nullable=False, comment='Largura do veículo em metros')
    height = Column(Float, nullable=False, comment='Altura do veículo em metros')
    is_active = Column(Boolean, default=True, index=True, 
                      comment='Indica se o veículo está ativo')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), 
                       nullable=False, comment='Data de criação do registro')
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(),
                      comment='Data da última atualização')
    
    # Relacionamentos
    routes = relationship(
        "Route", 
        secondary='route_vehicle', 
        back_populates="vehicles",
        lazy='dynamic',
        cascade='all, delete'
    )
    
    cubage_profile_id = Column(
        Integer, 
        ForeignKey('cubage_profiles.id', ondelete='SET NULL'), 
        nullable=True,
        comment='Referência ao perfil de cubagem associado'
    )
    
    cubage_profile = relationship(
        "CubageProfile", 
        backref=backref("vehicles", lazy=True),
        foreign_keys=[cubage_profile_id]
    )
    
    __table_args__ = (
        {'comment': 'Armazena informações dos veículos da frota'},
    )
    
    @property
    def volume(self):
        """
        Calcula o volume interno do veículo em metros cúbicos.
        
        Returns:
            float: Volume em m³
        """
        return round(self.length * self.width * self.height, 6)  # Arredonda para 6 casas decimais
    
    @validates('name')
    def validate_name(self, key, name):
        if not name or not name.strip():
            raise ValueError("O nome do veículo é obrigatório")
        if len(name) > 100:
            raise ValueError("O nome do veículo deve ter no máximo 100 caracteres")
        return name.strip()
    
    @validates('capacity', 'max_weight')
    def validate_weight(self, key, value):
        if value <= 0:
            raise ValueError(f"O valor de {key} deve ser maior que zero")
        if value > MAX_WEIGHT:
            raise ValueError(f"O valor máximo permitido para {key} é {MAX_WEIGHT} kg")
        return round(value, 3)  # Arredonda para 3 casas decimais
    
    @validates('length', 'width', 'height')
    def validate_dimensions(self, key, value):
        if value <= 0:
            raise ValueError(f"O {key} deve ser maior que zero")
        if value > MAX_VEHICLE_LENGTH:
            raise ValueError(f"O valor máximo permitido para {key} é {MAX_VEHICLE_LENGTH} metros")
        return round(value, 3)  # Arredonda para 3 casas decimais
    
    def to_dict(self, include_routes=False, include_profile=False):
        """
        Converte o objeto Vehicle para um dicionário.
        
        Args:
            include_routes (bool): Se True, inclui as rotas associadas
            include_profile (bool): Se True, inclui o perfil de cubagem completo
            
        Returns:
            dict: Dicionário com os dados do veículo
        """
        result = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "capacity": self.capacity,
            "max_weight": self.max_weight,
            "length": self.length,
            "width": self.width,
            "height": self.height,
            "volume": self.volume,
            "is_active": self.is_active,
            "cubage_profile_id": self.cubage_profile_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_routes and self.routes:
            result["routes"] = [route.to_dict() for route in self.routes]
            
        if include_profile and self.cubage_profile:
            result["cubage_profile"] = self.cubage_profile.to_dict()
            
        return result
    
    def __repr__(self):
        return f"<Vehicle {self.name} (ID: {self.id})>"


@event.listens_for(Vehicle, 'before_insert')
@event.listens_for(Vehicle, 'before_update')
def validate_vehicle_dimensions(mapper, connection, target):
    """Valida as dimensões do veículo antes de salvar"""
    if target.length < MIN_VEHICLE_LENGTH or target.length > MAX_VEHICLE_LENGTH:
        raise ValueError(
            f"O comprimento deve estar entre {MIN_VEHICLE_LENGTH} e {MAX_VEHICLE_LENGTH} metros"
        )
        
    if target.width < MIN_VEHICLE_LENGTH or target.width > MAX_VEHICLE_LENGTH:
        raise ValueError(
            f"A largura deve estar entre {MIN_VEHICLE_LENGTH} e {MAX_VEHICLE_LENGTH} metros"
        )
        
    if target.height < MIN_VEHICLE_LENGTH or target.height > MAX_VEHICLE_LENGTH:
        raise ValueError(
            f"A altura deve estar entre {MIN_VEHICLE_LENGTH} e {MAX_VEHICLE_LENGTH} metros"
        )
        
    if target.capacity > target.max_weight:
        raise ValueError(
            "A capacidade não pode ser maior que o peso máximo suportado"
        )
