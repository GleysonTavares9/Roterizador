from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, func, CheckConstraint, event
from sqlalchemy.orm import relationship, validates
from pydantic import BaseModel, validator, Field
from app.database import Base

# Constantes para limites mínimos e máximos (em metros e kg)
MIN_LENGTH = 0.01  # 1 cm
MAX_LENGTH = 20.0   # 20 metros
MIN_WEIGHT = 0.001  # 1 grama
MAX_WEIGHT = 50000  # 50 toneladas

class CubageProfileCreate(BaseModel):
    """Modelo Pydantic para validação na criação de perfis de cubagem"""
    name: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    weight: float = Field(..., gt=0, le=MAX_WEIGHT, description=f"Peso em kg (máx. {MAX_WEIGHT}kg)")
    length: float = Field(..., gt=0, le=MAX_LENGTH, description=f"Comprimento em metros (máx. {MAX_LENGTH}m)")
    width: float = Field(..., gt=0, le=MAX_LENGTH, description=f"Largura em metros (máx. {MAX_LENGTH}m)")
    height: float = Field(..., gt=0, le=MAX_LENGTH, description=f"Altura em metros (máx. {MAX_LENGTH}m)")
    is_active: bool = True
    
    @validator('weight')
    def validate_weight(cls, v):
        if v < MIN_WEIGHT:
            raise ValueError(f"O peso deve ser maior que {MIN_WEIGHT}kg")
        return round(v, 3)  # Arredonda para 3 casas decimais
    
    @validator('length', 'width', 'height')
    def validate_dimensions(cls, v):
        if v < MIN_LENGTH:
            raise ValueError(f"As dimensões devem ser maiores que {MIN_LENGTH}m")
        return round(v, 3)  # Arredonda para 3 casas decimais

class CubageProfile(Base):
    """
    Modelo para armazenar perfis de cubagem, que definem as características
    dimensionais e de peso para itens de carga.
    
    Atributos:
        id (int): Identificador único do perfil
        name (str): Nome do perfil (deve ser único)
        description (str): Descrição detalhada do perfil
        weight (float): Peso em quilogramas (kg)
        length (float): Comprimento em metros (m)
        width (float): Largura em metros (m)
        height (float): Altura em metros (m)
        is_active (bool): Indica se o perfil está ativo
        created_at (datetime): Data de criação do registro
        updated_at (datetime): Data da última atualização
    """
    __tablename__ = "cubage_profiles"
    
    id = Column(Integer, primary_key=True, index=True, comment='Identificador único do perfil')
    
    # Identificação
    name = Column(
        String(100), 
        nullable=False, 
        unique=True, 
        index=True,
        comment='Nome do perfil (deve ser único)'
    )
    
    description = Column(
        String(255), 
        nullable=True,
        comment='Descrição detalhada do perfil'
    )
    
    # Dimensões e peso
    weight = Column(
        Float, 
        nullable=False,
        comment='Peso em quilogramas (kg)'
    )
    
    length = Column(
        Float, 
        nullable=False,
        comment='Comprimento em metros (m)'
    )
    
    width = Column(
        Float, 
        nullable=False,
        comment='Largura em metros (m)'
    )
    
    height = Column(
        Float, 
        nullable=False,
        comment='Altura em metros (m)'
    )
    
    # Controle
    is_active = Column(
        Boolean, 
        default=True,
        nullable=False,
        index=True,
        comment='Indica se o perfil está ativo'
    )
    
    created_at = Column(
        DateTime(timezone=True), 
        server_default=func.now(),
        nullable=False,
        comment='Data de criação do registro'
    )
    
    updated_at = Column(
        DateTime(timezone=True), 
        onupdate=func.now(),
        comment='Data da última atualização'
    )
    
    # Configurações adicionais da tabela
    __table_args__ = (
        # Garante que as dimensões e peso sejam positivos
        CheckConstraint('weight > 0', name='check_weight_positive'),
        CheckConstraint('length > 0', name='check_length_positive'),
        CheckConstraint('width > 0', name='check_width_positive'),
        CheckConstraint('height > 0', name='check_height_positive'),
        
        # Limites superiores para evitar valores absurdos
        CheckConstraint(f'weight <= {MAX_WEIGHT}', name='check_weight_max'),
        CheckConstraint(f'length <= {MAX_LENGTH}', name='check_length_max'),
        CheckConstraint(f'width <= {MAX_LENGTH}', name='check_width_max'),
        CheckConstraint(f'height <= {MAX_LENGTH}', name='check_height_max'),
        
        {'comment': 'Armazena perfis de cubagem com dimensões e pesos padronizados'},
    )
    
    # Validações
    @validates('weight')
    def validate_weight(self, key, weight):
        """Valida o peso"""
        if weight < MIN_WEIGHT:
            raise ValueError(f"O peso deve ser maior que {MIN_WEIGHT}kg")
        if weight > MAX_WEIGHT:
            raise ValueError(f"O peso não pode exceder {MAX_WEIGHT}kg")
        return round(weight, 3)  # Arredonda para 3 casas decimais
    
    @validates('length', 'width', 'height')
    def validate_dimensions(self, key, value):
        """Valida as dimensões (comprimento, largura, altura)"""
        if value < MIN_LENGTH:
            raise ValueError(f"{key} deve ser maior que {MIN_LENGTH}m")
        if value > MAX_LENGTH:
            raise ValueError(f"{key} não pode exceder {MAX_LENGTH}m")
        return round(value, 3)  # Arredonda para 3 casas decimais
    
    # Propriedades calculadas
    @property
    def volume(self) -> float:
        """
        Calcula o volume em metros cúbicos (m³).
        
        Returns:
            float: Volume em metros cúbicos (comprimento * largura * altura)
        """
        return round(self.length * self.width * self.height, 6)  # 6 casas decimais
    
    @property
    def density(self) -> float:
        """
        Calcula a densidade em quilogramas por metro cúbico (kg/m³).
        
        Returns:
            float: Densidade em kg/m³ (peso / volume)
        """
        vol = self.volume
        return round(self.weight / vol, 3) if vol > 0 else 0.0  # 3 casas decimais
    
    @property
    def dimensions(self) -> Dict[str, float]:
        """
        Retorna as dimensões como um dicionário.
        
        Returns:
            Dict[str, float]: Dicionário com as dimensões (length, width, height)
        """
        return {
            'length': self.length,
            'width': self.width,
            'height': self.height
        }
    
    def to_dict(self, include_volume: bool = True, include_density: bool = True) -> Dict[str, Any]:
        """
        Converte o objeto para um dicionário.
        
        Args:
            include_volume (bool): Se True, inclui o volume calculado
            include_density (bool): Se True, inclui a densidade calculada
            
        Returns:
            dict: Dicionário com os dados do perfil de cubagem
        """
        result = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "weight": self.weight,
            "dimensions": self.dimensions,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        
        # Adiciona propriedades calculadas conforme solicitado
        if include_volume:
            result["volume"] = self.volume
        if include_density:
            result["density"] = self.density
        
        # Remove valores None
        return {k: v for k, v in result.items() if v is not None}
    
    def can_accommodate(self, item_length: float, item_width: float, item_height: float, 
                       item_weight: float) -> bool:
        """
        Verifica se um item com as dimensões fornecidas pode ser acomodado
        neste perfil de cubagem.
        
        Args:
            item_length (float): Comprimento do item em metros
            item_width (float): Largura do item em metros
            item_height (float): Altura do item em metros
            item_weight (float): Peso do item em kg
            
        Returns:
            bool: True se o item pode ser acomodado, False caso contrário
        """
        # Verifica se o item é maior que o perfil em qualquer dimensão
        if (item_length > self.length or 
            item_width > self.width or 
            item_height > self.height):
            return False
            
        # Verifica se o peso excede a capacidade
        if item_weight > self.weight:
            return False
            
        return True
    
    def utilization_percentage(self, item_volume: float) -> float:
        """
        Calcula a porcentagem de utilização do volume.
        
        Args:
            item_volume (float): Volume do item em m³
            
        Returns:
            float: Porcentagem de utilização (0-100)
        """
        if self.volume <= 0:
            return 0.0
        return min(100.0, (item_volume / self.volume) * 100)
    
    def __repr__(self) -> str:
        return f"<CubageProfile {self.name} (ID: {self.id}, {self.length}x{self.width}x{self.height}m, {self.weight}kg)>"


@event.listens_for(CubageProfile, 'before_insert')
@event.listens_for(CubageProfile, 'before_update')
def update_timestamps(mapper, connection, target):
    """Atualiza os timestamps automaticamente"""
    now = datetime.now(timezone.utc)
    if not target.created_at:
        target.created_at = now
    target.updated_at = now
