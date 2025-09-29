from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from enum import Enum
from sqlalchemy import Column, Integer, String, Float, JSON, ForeignKey, Boolean, DateTime, Text, Table, event
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
from sqlalchemy.engine import Engine
from pydantic import BaseModel, validator

from app.database import Base, SQLALCHEMY_DATABASE_URL

# Enums para status da rota
class RouteStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELED = "canceled"

# Modelo Pydantic para validação de pontos
class RoutePoint(BaseModel):
    """Modelo para validação de pontos na rota"""
    id: str
    address: str
    latitude: float
    longitude: float
    sequence: int
    status: str = "pending"
    notes: Optional[str] = None
    
    @validator('latitude')
    def validate_latitude(cls, v):
        if not -90 <= v <= 90:
            raise ValueError("A latitude deve estar entre -90 e 90 graus")
        return v
    
    @validator('longitude')
    def validate_longitude(cls, v):
        if not -180 <= v <= 180:
            raise ValueError("A longitude deve estar entre -180 e 180 graus")
        return v

# Tabela de associação para relacionamento muitos-para-muitos entre rotas e veículos
route_vehicle = Table(
    'route_vehicle',
    Base.metadata,
    Column('route_id', Integer, ForeignKey('routes.id', ondelete='CASCADE'), primary_key=True, comment='ID da rota'),
    Column('vehicle_id', Integer, ForeignKey('vehicles.id', ondelete='CASCADE'), primary_key=True, comment='ID do veículo'),
    Column('created_at', DateTime(timezone=True), server_default=func.now(), nullable=False, comment='Data de criação da associação'),
    
    # Comentário para documentação da tabela
    comment='Tabela de associação entre rotas e veículos',
    
    # Índices para melhorar consultas
    # sqlite_autoincrement=True,
)

# Usa JSONB para PostgreSQL e JSON para outros bancos (como SQLite)
if SQLALCHEMY_DATABASE_URL and 'postgresql' in SQLALCHEMY_DATABASE_URL:
    from sqlalchemy.dialects.postgresql import JSONB
    JSON_TYPE = JSONB
else:
    JSON_TYPE = JSON

class Route(Base):
    """
    Modelo para armazenar informações das rotas de coleta.
    
    Atributos:
        id (int): Identificador único da rota
        name (str): Nome ou identificação da rota
        description (str): Descrição detalhada da rota
        status (str): Status atual da rota (pending, in_progress, completed, canceled)
        points (List[Dict]): Lista de pontos da rota com coordenadas e metadados
        distance (float): Distância total da rota em quilômetros
        duration (float): Duração estimada da rota em minutos
        start_time (datetime): Data e hora de início da rota
        end_time (datetime): Data e hora de conclusão da rota
        optimized (bool): Indica se a rota foi otimizada
        is_active (bool): Indica se a rota está ativa
        created_at (datetime): Data de criação do registro
        updated_at (datetime): Data da última atualização
    """
    __tablename__ = "routes"
    
    id = Column(Integer, primary_key=True, index=True, comment='Identificador único da rota')
    name = Column(String(100), nullable=False, index=True, comment='Nome ou identificação da rota')
    description = Column(Text, nullable=True, comment='Descrição detalhada da rota')
    status = Column(
        String(20), 
        nullable=False, 
        default=RouteStatus.PENDING.value, 
        index=True, 
        comment='Status atual da rota (pending, in_progress, completed, canceled)'
    )
    
    points = Column(
        JSON_TYPE, 
        nullable=False, 
        default=list, 
        comment='Lista de pontos da rota com coordenadas e metadados'
    )
    
    distance = Column(Float, nullable=True, comment='Distância total da rota em quilômetros')
    duration = Column(Float, nullable=True, comment='Duração estimada da rota em minutos')
    start_time = Column(DateTime(timezone=True), nullable=True, index=True, comment='Data e hora de início da rota')
    end_time = Column(DateTime(timezone=True), nullable=True, comment='Data e hora de conclusão da rota')
    optimized = Column(Boolean, default=False, nullable=False, comment='Indica se a rota foi otimizada')
    is_active = Column(Boolean, default=True, nullable=False, index=True, comment='Indica se a rota está ativa')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), 
                       nullable=False, comment='Data de criação do registro')
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), 
                       comment='Data da última atualização')
    
    # Relacionamentos
    vehicles = relationship(
        "Vehicle",
        secondary=route_vehicle,
        back_populates="routes",
        lazy='dynamic',
        cascade='all, delete',
        passive_deletes=True
    )
    
    __table_args__ = (
        {'comment': 'Armazena informações das rotas de coleta'},
    )
    
    # Validações
    @validates('status')
    def validate_status(self, key, status):
        """Valida se o status é um valor válido"""
        valid_statuses = [s.value for s in RouteStatus]
        if status not in valid_statuses:
            raise ValueError(f"Status inválido. Deve ser um dos seguintes: {', '.join(valid_statuses)}")
        return status
    
    @validates('points')
    def validate_points(self, key, points):
        """Valida a estrutura dos pontos da rota"""
        if not isinstance(points, list):
            raise ValueError("Os pontos devem ser uma lista")
            
        # Valida cada ponto usando o modelo Pydantic
        for point in points:
            try:
                RoutePoint(**point)
            except Exception as e:
                raise ValueError(f"Ponto inválido: {str(e)}")
                
        return points
    
    @validates('distance', 'duration')
    def validate_positive_numbers(self, key, value):
        """Valida que distância e duração são números positivos"""
        if value is not None and value < 0:
            raise ValueError(f"O valor de {key} não pode ser negativo")
        return value
    
    def to_dict(self, include_vehicles: bool = False) -> Dict[str, Any]:
        """
        Converte o objeto Route para um dicionário.
        
        Args:
            include_vehicles (bool): Se True, inclui informações dos veículos associados
            
        Returns:
            dict: Dicionário com os dados da rota
        """
        result = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "points": self.points,
            "distance": self.distance,
            "duration": self.duration,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "optimized": self.optimized,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "vehicles": []
        }
        
        if include_vehicles and self.vehicles:
            result["vehicles"] = [vehicle.to_dict() for vehicle in self.vehicles]
            
        return result
    
    def update_status(self, new_status: str, db_session) -> bool:
        """
        Atualiza o status da rota e executa ações relacionadas.
        
        Args:
            new_status (str): Novo status para a rota
            db_session: Sessão do banco de dados
            
        Returns:
            bool: True se a atualização foi bem-sucedida, False caso contrário
        """
        if new_status not in [s.value for s in RouteStatus]:
            raise ValueError(f"Status inválido: {new_status}")
            
        self.status = new_status
        now = datetime.now(timezone.utc)
        
        # Atualiza os timestamps com base no status
        if new_status == RouteStatus.IN_PROGRESS.value and not self.start_time:
            self.start_time = now
        elif new_status in [RouteStatus.COMPLETED.value, RouteStatus.CANCELED.value] and not self.end_time:
            self.end_time = now
        
        db_session.add(self)
        
        try:
            db_session.commit()
            return True
        except Exception as e:
            db_session.rollback()
            raise e
    
    def calculate_metrics(self) -> Dict[str, float]:
        """
        Calcula métricas da rota com base nos pontos.
        
        Returns:
            dict: Dicionário com as métricas calculadas
        """
        if not self.points or len(self.points) < 2:
            return {"distance": 0, "duration": 0, "stops": 0}
            
        # Aqui você pode implementar a lógica para calcular distância e duração
        # entre os pontos usando uma API de roteamento como OSRM, Google Maps, etc.
        # Por enquanto, retornamos os valores atuais
        
        return {
            "distance": self.distance or 0,
            "duration": self.duration or 0,
            "stops": len(self.points)
        }
    
    def __repr__(self) -> str:
        return f"<Route {self.name} (ID: {self.id}, Status: {self.status})>"


@event.listens_for(Route, 'before_update')
def update_timestamps(mapper, connection, target):
    """Atualiza o timestamp de atualização antes de salvar"""
    target.updated_at = datetime.now(timezone.utc)


@event.listens_for(Route, 'before_insert')
def set_initial_values(mapper, connection, target):
    """Define valores iniciais ao criar uma nova rota"""
    if not target.status:
        target.status = RouteStatus.PENDING.value
    if not target.created_at:
        target.created_at = datetime.now(timezone.utc)
