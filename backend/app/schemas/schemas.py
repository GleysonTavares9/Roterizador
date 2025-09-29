from pydantic import BaseModel, Field, validator, EmailStr, Json, confloat
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, time
import re
import json

class ExternalIdList(BaseModel):
    """Esquema para lista de IDs externos para verificação"""
    ids: List[str] = Field(..., description="Lista de IDs externos para verificação")

class VehicleBase(BaseModel):
    """Esquema base para veículos"""
    name: str = Field(..., max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    capacity: float = Field(..., gt=0, description="Capacidade em kg")
    max_weight: float = Field(..., gt=0, description="Peso máximo em kg")
    length: float = Field(..., gt=0, description="Comprimento em metros")
    width: float = Field(..., gt=0, description="Largura em metros")
    height: float = Field(..., gt=0, description="Altura em metros")
    cubage_profile_id: Optional[int] = Field(None, description="ID do perfil de cubagem associado")
    is_active: Optional[bool] = True

class VehicleCreate(VehicleBase):
    """Esquema para criação de veículos"""
    pass

class VehicleUpdate(BaseModel):
    """Esquema para atualização de veículos"""
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    capacity: Optional[float] = Field(None, gt=0, description="Capacidade em kg")
    max_weight: Optional[float] = Field(None, gt=0, description="Peso máximo em kg")
    length: Optional[float] = Field(None, gt=0, description="Comprimento em metros")
    width: Optional[float] = Field(None, gt=0, description="Largura em metros")
    height: Optional[float] = Field(None, gt=0, description="Altura em metros")
    cubage_profile_id: Optional[int] = Field(None, description="ID do perfil de cubagem associado")
    is_active: Optional[bool] = None

class Vehicle(VehicleBase):
    """Esquema para retorno de veículos"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    cubage_profile: Optional[Dict[str, Any]] = Field(None, description="Dados do perfil de cubagem associado")

    class Config:
        from_attributes = True
        
    @classmethod
    def model_validate(cls, obj, **kwargs):
        # Converte o objeto CubageProfile para dicionário se existir
        if hasattr(obj, 'cubage_profile') and obj.cubage_profile:
            if isinstance(obj.cubage_profile, dict):
                # Já é um dicionário, mantém como está
                pass
            elif hasattr(obj.cubage_profile, 'to_dict'):
                # Tem método to_dict, usa ele
                obj.cubage_profile = obj.cubage_profile.to_dict()
            else:
                # Se não tem método to_dict, tenta converter manualmente
                obj.cubage_profile = {
                    'id': getattr(obj.cubage_profile, 'id', None),
                    'name': getattr(obj.cubage_profile, 'name', None),
                    'description': getattr(obj.cubage_profile, 'description', None),
                    'weight': getattr(obj.cubage_profile, 'weight', None),
                    'length': getattr(obj.cubage_profile, 'length', None),
                    'width': getattr(obj.cubage_profile, 'width', None),
                    'height': getattr(obj.cubage_profile, 'height', None),
                    'volume': getattr(obj.cubage_profile, 'volume', None),
                    'density': getattr(obj.cubage_profile, 'density', None),
                    'is_active': getattr(obj.cubage_profile, 'is_active', True),
                    'created_at': getattr(obj.cubage_profile, 'created_at', None),
                    'updated_at': getattr(obj.cubage_profile, 'updated_at', None)
                }
                # Converte datas para string
                if obj.cubage_profile['created_at']:
                    obj.cubage_profile['created_at'] = obj.cubage_profile['created_at'].isoformat()
                if obj.cubage_profile['updated_at']:
                    obj.cubage_profile['updated_at'] = obj.cubage_profile['updated_at'].isoformat()
        return super().model_validate(obj, **kwargs)

class CubageProfileBase(BaseModel):
    """Esquema base para perfis de cubagem"""
    name: str = Field(..., max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    weight: float = Field(..., gt=0, description="Peso em kg")
    length: float = Field(..., gt=0, description="Comprimento em metros")
    width: float = Field(..., gt=0, description="Largura em metros")
    height: float = Field(..., gt=0, description="Altura em metros")
    is_active: Optional[bool] = True

class CubageProfileCreate(CubageProfileBase):
    """Esquema para criação de perfis de cubagem"""
    pass

class CubageProfileUpdate(BaseModel):
    """Esquema para atualização de perfis de cubagem"""
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    weight: Optional[float] = Field(None, gt=0, description="Peso em kg")
    length: Optional[float] = Field(None, gt=0, description="Comprimento em metros")
    width: Optional[float] = Field(None, gt=0, description="Largura em metros")
    height: Optional[float] = Field(None, gt=0, description="Altura em metros")
    is_active: Optional[bool] = None

class CubageProfile(CubageProfileBase):
    """Esquema para retorno de perfis de cubagem"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    volume: float = Field(..., description="Volume em metros cúbicos")
    density: float = Field(..., description="Densidade em kg/m³")

    class Config:
        from_attributes = True

    @validator('volume', pre=True, always=True)
    def calculate_volume(cls, v, values):
        if isinstance(v, (int, float)):
            return v
        return values['length'] * values['width'] * values['height']
    
    @validator('density', pre=True, always=True)
    def calculate_density(cls, v, values):
        if isinstance(v, (int, float)):
            return v
        volume = values.get('volume')
        if volume is None:
            volume = values['length'] * values['width'] * values['height']
        return values['weight'] / volume if volume > 0 else 0

class CollectionPointBase(BaseModel):
    """Esquema base para pontos de coleta"""
    external_id: Optional[str] = Field(None, max_length=100, description="ID único externo para evitar duplicações")
    name: str = Field(..., max_length=100, description="Nome do ponto de coleta")
    address: str = Field(..., max_length=255, description="Endereço completo")
    neighborhood: str = Field(..., max_length=100, description="Bairro")
    city: str = Field(..., max_length=100, description="Cidade")
    state: Optional[str] = Field(None, max_length=2, description="UF (2 caracteres)")
    zip_code: Optional[str] = Field(None, max_length=10, description="CEP (formato: 00000-000)")
    phone: Optional[str] = Field(None, max_length=20, description="Telefone para contato")
    email: Optional[EmailStr] = Field(None, description="E-mail para contato")
    notes: Optional[str] = Field(None, description="Observações adicionais")
    latitude: Optional[float] = Field(None, description="Coordenada de latitude")
    longitude: Optional[float] = Field(None, description="Coordenada de longitude")
    days_of_week: Optional[str] = Field(
        None, 
        description="Dias da semana (ex: 1,2,3,4,5 para segunda a sexta)",
        pattern=r'^([1-7])(,[1-7])*$|^$',
        example="1,2,3,4,5"
    )
    weeks_of_month: Optional[str] = Field(
        None, 
        description="Semanas do mês (ex: 1,2,3,4 para todas as semanas, ou 1,3 para 1ª e 3ª semanas)",
        pattern=r'^([1-4])(,[1-4])*$|^$',
        example="1,2,3,4"
    )
    is_active: Optional[bool] = Field(True, description="Indica se o ponto está ativo")

    @validator('zip_code')
    def validate_zip_code(cls, v):
        if v is None:
            return v
        # Remove caracteres não numéricos
        zip_clean = re.sub(r'\D', '', v)
        # Formato: 00000000 ou 00000-000
        if not re.match(r'^\d{8}$|^\d{5}-\d{3}$', zip_clean):
            raise ValueError('Formato de CEP inválido. Use 00000-000 ou 00000000')
        # Formata para o padrão 00000-000
        if '-' not in zip_clean and len(zip_clean) == 8:
            return f"{zip_clean[:5]}-{zip_clean[5:]}"
        return v

    @validator('state')
    def validate_state(cls, v):
        if v is None:
            return v
        if len(v) != 2 or not v.isalpha():
            raise ValueError('UF deve ter exatamente 2 letras')
        return v.upper()

class CollectionPointCreate(CollectionPointBase):
    """Esquema para criação de pontos de coleta"""
    pass

class CollectionPointBatchCreate(BaseModel):
    """Esquema para criação em lote de pontos de coleta"""
    points: List[CollectionPointCreate] = Field(..., description="Lista de pontos de coleta para criar")
    
    class Config:
        json_schema_extra = {
            "example": {
                "points": [
                    {
                        "name": "Ponto de Coleta 1",
                        "address": "Rua Exemplo 123",
                        "neighborhood": "Centro",
                        "city": "São Paulo",
                        "state": "SP",
                        "zip_code": "01001000",
                        "phone": "11999999999",
                        "reference": "Próximo ao mercado",
                        "latitude": -23.5505,
                        "longitude": -46.6333,
                        "days_of_week": "1,2,3,4,5",
                        "weeks_of_month": "1,2,3,4",
                        "is_active": True
                    },
                    {
                        "name": "Ponto de Coleta 2",
                        "address": "Avenida Teste 456",
                        "neighborhood": "Vila Mariana",
                        "city": "São Paulo",
                        "state": "SP",
                        "zip_code": "04001000",
                        "phone": "11888888888",
                        "reference": "Em frente ao banco",
                        "latitude": -23.5605,
                        "longitude": -46.6433,
                        "days_of_week": "2,4,6",
                        "weeks_of_month": "1,3",
                        "is_active": True
                    }
                ]
            }
        }

class CollectionPointUpdate(BaseModel):
    """Esquema para atualização de pontos de coleta"""
    external_id: Optional[str] = Field(None, max_length=100, description="ID único externo para evitar duplicações")
    name: Optional[str] = Field(None, max_length=100, description="Nome do ponto de coleta")
    address: Optional[str] = Field(None, max_length=255, description="Endereço completo")
    neighborhood: Optional[str] = Field(None, max_length=100, description="Bairro")
    city: Optional[str] = Field(None, max_length=100, description="Cidade")
    state: Optional[str] = Field(None, max_length=2, description="UF (2 caracteres)")
    zip_code: Optional[str] = Field(None, max_length=10, description="CEP (formato: 00000-000)")
    phone: Optional[str] = Field(None, max_length=20, description="Telefone para contato")
    email: Optional[EmailStr] = Field(None, description="E-mail para contato")
    notes: Optional[str] = Field(None, description="Observações adicionais")
    frequency: Optional[str] = Field(None, max_length=50, description="Frequência de coleta (ex: Semanal, Quinzenal, Mensal)")
    latitude: Optional[float] = Field(None, description="Coordenada de latitude")
    longitude: Optional[float] = Field(None, description="Coordenada de longitude")
    days_of_week: Optional[str] = Field(
        None, 
        description="Dias da semana (ex: 1,2,3,4,5 para segunda a sexta)",
        pattern=r'^([1-7])(,[1-7])*$|^$',
        example="1,2,3,4,5"
    )
    weeks_of_month: Optional[str] = Field(
        None, 
        description="Semanas do mês (ex: 1,2,3,4 para todas as semanas, ou 1,3 para 1ª e 3ª semanas)",
        pattern=r'^([1-4])(,[1-4])*$|^$',
        example="1,2,3,4"
    )
    is_active: Optional[bool] = Field(None, description="Indica se o ponto está ativo")

    class Config:
        extra = 'ignore'

class CollectionPoint(CollectionPointBase):
    """Esquema para retorno de pontos de coleta"""
    id: int
    external_id: Optional[str] = Field(None, description="ID único externo para evitar duplicações")
    frequency: Optional[str] = Field(None, max_length=50, description="Frequência de coleta (ex: Semanal, Quinzenal, Mensal)")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
    
    @classmethod
    def model_validate(cls, obj, **kwargs):
        # Converte o objeto SQLAlchemy para dicionário e garante que todos os campos sejam serializáveis
        data = {c.name: getattr(obj, c.name, None) for c in obj.__table__.columns}
        # Garante que os campos opcionais estejam no dicionário, mesmo que sejam None
        for field in ['external_id', 'frequency']:
            if field not in data:
                data[field] = None
        return cls(**data)

class RouteBase(BaseModel):
    """Esquema base para rotas"""
    name: str = Field(..., max_length=100, description="Nome da rota")
    description: Optional[str] = Field(None, max_length=255, description="Descrição da rota")
    vehicle_id: Optional[int] = Field(None, description="ID do veículo atribuído à rota")
    status: str = Field("pending", description="Status da rota (pending, in_progress, completed, canceled)")
    distance: Optional[float] = Field(None, ge=0, description="Distância total da rota em quilômetros")
    duration: Optional[float] = Field(None, ge=0, description="Duração total da rota em minutos")
    start_time: Optional[datetime] = Field(None, description="Data e hora de início da rota")
    end_time: Optional[datetime] = Field(None, description="Data e hora de conclusão da rota")
    optimized: bool = Field(False, description="Indica se a rota foi otimizada")
    is_active: bool = Field(True, description="Indica se a rota está ativa")

    @validator('status')
    def validate_status(cls, v):
        valid_statuses = ["pending", "in_progress", "completed", "canceled"]
        if v not in valid_statuses:
            raise ValueError(f"Status deve ser um dos seguintes: {', '.join(valid_statuses)}")
        return v

class RouteCreate(RouteBase):
    """Esquema para criação de rotas"""
    pass

class RouteUpdate(BaseModel):
    """Esquema para atualização de rotas"""
    name: Optional[str] = Field(None, max_length=100, description="Nome da rota")
    description: Optional[str] = Field(None, max_length=255, description="Descrição da rota")
    vehicle_id: Optional[int] = Field(None, description="ID do veículo atribuído à rota")
    status: Optional[str] = Field(None, description="Status da rota (pending, in_progress, completed, canceled)")
    distance: Optional[float] = Field(None, ge=0, description="Distância total da rota em quilômetros")
    duration: Optional[float] = Field(None, ge=0, description="Duração total da rota em minutos")
    start_time: Optional[datetime] = Field(None, description="Data e hora de início da rota")
    end_time: Optional[datetime] = Field(None, description="Data e hora de conclusão da rota")
    optimized: Optional[bool] = Field(None, description="Indica se a rota foi otimizada")
    is_active: Optional[bool] = Field(None, description="Indica se a rota está ativa")

    class Config:
        extra = 'ignore'

class Route(RouteBase):
    """Esquema para retorno de rotas"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    points: List[Dict[str, Any]] = Field(default_factory=list, description="Pontos da rota")

    class Config:
        from_attributes = True

class RouteGeneration(BaseModel):
    """Esquema para geração de rotas"""
    name: str = Field(..., max_length=100, description="Nome da rota")
    description: Optional[str] = Field(None, max_length=255, description="Descrição da rota")
    vehicles: List[Dict[str, Any]] = Field(..., description="Lista de veículos para a rota")
    points: List[Dict[str, Any]] = Field(..., description="Lista de pontos da rota")
    
    @validator('points', each_item=True)
    def validate_point_coordinates(cls, point):
        """Valida as coordenadas de cada ponto da rota"""
        if 'lat' not in point or 'lng' not in point:
            raise ValueError("Cada ponto deve conter 'lat' e 'lng'")
            
        try:
            # Tenta converter para float
            lat = float(point['lat'])
            lng = float(point['lng'])
            
            # Valida os intervalos
            if not (-90 <= lat <= 90):
                raise ValueError(f"Latitude inválida: {lat}. Deve estar entre -90 e 90 graus.")
                
            if not (-180 <= lng <= 180):
                raise ValueError(f"Longitude inválida: {lng}. Deve estar entre -180 e 180 graus.")
                
            # Atualiza os valores convertidos
            point['lat'] = round(lat, 6)
            point['lng'] = round(lng, 6)
            
        except (ValueError, TypeError) as e:
            raise ValueError(f"Coordenadas inválidas no ponto {point.get('id', 'desconhecido')}: {str(e)}")
            
        return point

    @validator('points')
    def validate_points(cls, v):
        if not v or len(v) < 2:
            raise ValueError("A rota deve ter pelo menos 2 pontos")
        return v
        
    @validator('vehicles')
    def validate_vehicles(cls, v):
        if not v:
            raise ValueError("Pelo menos um veículo deve ser fornecido")
        return v

class RouteStop(BaseModel):
    """Esquema para uma parada na rota"""
    name: str = Field(..., description="Nome da parada")
    lat: float = Field(..., ge=-90, le=90, description="Latitude da parada")
    lng: float = Field(..., ge=-180, le=180, description="Longitude da parada")
    address: str = Field(..., description="Endereço da parada")
    type: str = Field(..., description="Tipo de parada (depot, pickup, delivery)")
    arrival_time: str = Field(..., description="Horário de chegada (HH:MM)")
    departure_time: str = Field(..., description="Horário de saída (HH:MM)")
    volume: float = Field(0, ge=0, description="Volume em m³")
    weight: float = Field(0, ge=0, description="Peso em kg")
    time_window: Optional[str] = Field(None, description="Janela de tempo (HH:MM - HH:MM)")

class OptimizedRoute(BaseModel):
    """Esquema para uma rota otimizada"""
    id: str = Field(..., description="ID único da rota")
    vehicle: str = Field(..., description="Nome do veículo")
    distance: float = Field(0, ge=0, description="Distância total da rota em metros")
    stops: List[RouteStop] = Field(..., description="Lista de paradas na rota")
    total_volume: float = Field(0, ge=0, description="Volume total transportado em m³")
    total_weight: float = Field(0, ge=0, description="Peso total transportado em kg")

class RouteOptimizationResponse(BaseModel):
    """Resposta da otimização de rotas"""
    routes: List[OptimizedRoute] = Field(..., description="Lista de rotas otimizadas")
    total_distance: float = Field(0, ge=0, description="Distância total percorrida em metros")
    total_volume: float = Field(0, ge=0, description="Volume total transportado em m³")
    total_weight: float = Field(0, ge=0, description="Peso total transportado em kg")
    num_vehicles_used: int = Field(0, ge=0, description="Número de veículos utilizados")
    num_stops: int = Field(0, ge=0, description="Número total de paradas")
