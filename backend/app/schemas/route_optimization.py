from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional
from datetime import time
import json
from uuid import UUID

class CollectionPoint(BaseModel):
    """Esquema para pontos de coleta/distribuição"""
    id: str = Field(..., description="ID único do ponto")
    type: str = Field(..., description="Tipo do ponto (start, pickup, delivery)")
    name: Optional[str] = Field(None, description="Nome do ponto")
    address: str = Field(..., description="Endereço completo")
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")
    quantity: int = Field(1, ge=0, description="Quantidade")
    weight: float = Field(0, ge=0, description="Peso em kg")
    volume: float = Field(0, ge=0, description="Volume em m³")
    time_window_start: str = Field("08:00", description="Hora de início da janela de tempo")
    time_window_end: str = Field("18:00", description="Hora de término da janela de tempo")
    service_time: int = Field(5, ge=0, description="Tempo de serviço em minutos")
    priority: int = Field(0, ge=0, description="Prioridade do ponto")
    
    @validator('time_window_start', 'time_window_end')
    def validate_time_format(cls, v):
        try:
            time.fromisoformat(v)
            return v
        except ValueError:
            raise ValueError(f"Formato de hora inválido. Use HH:MM")

class Vehicle(BaseModel):
    """Esquema para veículos"""
    id: str = Field(..., description="ID único do veículo")
    name: str = Field(..., description="Nome do veículo")
    capacity: float = Field(..., gt=0, description="Capacidade em kg")
    max_weight: float = Field(..., gt=0, description="Peso máximo em kg")
    volume_capacity: float = Field(..., gt=0, description="Volume máximo em m³")
    length: float = Field(..., gt=0, description="Comprimento em metros")
    width: float = Field(..., gt=0, description="Largura em metros")
    height: float = Field(..., gt=0, description="Altura em metros")
    start_time: str = Field("08:00", description="Hora de início")
    end_time: str = Field("18:00", description="Hora de término")
    speed: float = Field(30.0, gt=0, description="Velocidade média em km/h")
    
    @validator('start_time', 'end_time')
    def validate_time_format(cls, v):
        try:
            time.fromisoformat(v)
            return v
        except ValueError:
            raise ValueError(f"Formato de hora inválido. Use HH:MM")

class RouteGeneration(BaseModel):
    """Esquema para geração de rotas"""
    name: str = Field(..., description="Nome da rota")
    description: Optional[str] = Field(None, description="Descrição da rota")
    vehicles: List[Vehicle] = Field(..., description="Lista de veículos disponíveis")
    points: List[CollectionPoint] = Field(..., description="Lista de pontos de coleta/distribuição")
    max_routes: int = Field(10, gt=0, description="Número máximo de rotas")
    time_window_penalty: float = Field(1000, gt=0, description="Penalidade por violação de janela de tempo")
    weight_penalty: float = Field(1000, gt=0, description="Penalidade por excesso de peso")
    volume_penalty: float = Field(1000, gt=0, description="Penalidade por excesso de volume")
    
    @validator('vehicles')
    def validate_vehicles(cls, v):
        if not v:
            raise ValueError("Pelo menos um veículo deve ser fornecido")
        return v
    
    @validator('points')
    def validate_points(cls, v):
        if not v or len(v) < 2:
            raise ValueError("Pelo menos dois pontos devem ser fornecidos")
        if not any(point.get('type') == 'start' for point in v):
            raise ValueError("Um ponto de início (depot) deve ser fornecido")
        if not any(point.get('type') == 'pickup' for point in v):
            raise ValueError("Pelo menos um ponto de coleta deve ser fornecido")
        return v

class Route(BaseModel):
    """Esquema para uma rota individual"""
    vehicle_id: str = Field(..., description="ID do veículo")
    vehicle_name: str = Field(..., description="Nome do veículo")
    route: List[Dict] = Field(..., description="Sequência de pontos na rota")
    route_details: List[Dict] = Field(..., description="Detalhes de cada ponto na rota")
    distance: float = Field(..., description="Distância total da rota em km")
    duration: float = Field(..., description="Duração total da rota em minutos")
    weight: float = Field(..., description="Peso total transportado")
    volume: float = Field(..., description="Volume total transportado")
    time_window_violations: int = Field(..., description="Número de violações de janela de tempo")
    efficiency: float = Field(..., description="Eficiência da rota")

class RouteOptimizationResponse(BaseModel):
    """Esquema para resposta da otimização de rotas"""
    status: str = Field(..., description="Status da otimização")
    message: str = Field(..., description="Mensagem de resposta")
    routes: List[Route] = Field(..., description="Lista de rotas otimizadas")
    total_vehicles_used: int = Field(..., description="Número total de veículos utilizados")
    total_distance: float = Field(..., description="Distância total percorrida em km")
    total_duration: float = Field(..., description="Duração total em minutos")
    processing_time: float = Field(..., description="Tempo de processamento em segundos")
    summary: Dict = Field(..., description="Resumo detalhado da otimização")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "success",
                "message": "Rotas otimizadas com sucesso",
                "routes": [
                    {
                        "vehicle_id": "1",
                        "vehicle_name": "Caminhão 1",
                        "route": [
                            {"point_id": "depot", "sequence": 0},
                            {"point_id": "1", "sequence": 1},
                            {"point_id": "2", "sequence": 2},
                            {"point_id": "depot", "sequence": 3}
                        ],
                        "route_details": [
                            {
                                "point_id": "1",
                                "address": "Rua A",
                                "arrival_time": "09:30",
                                "departure_time": "09:40",
                                "weight": 100,
                                "volume": 1.5,
                                "time_window_start": "09:00",
                                "time_window_end": "17:00",
                                "time_window_violated": False
                            }
                        ],
                        "distance": 150.5,
                        "duration": 90,
                        "weight": 1500,
                        "volume": 3.0,
                        "time_window_violations": 0,
                        "efficiency": 0.01
                    }
                ],
                "total_vehicles_used": 1,
                "total_distance": 150.5,
                "total_duration": 90,
                "processing_time": 2.5,
                "summary": {
                    "total_distance": {
                        "km": 150.5,
                        "average_per_route": 150.5
                    },
                    "total_time": {
                        "minutes": 90,
                        "hours": 1.5,
                        "average_per_route": 90
                    },
                    "total_weight": {
                        "kg": 1500,
                        "average_per_route": 1500
                    },
                    "total_volume": {
                        "m3": 3.0,
                        "average_per_route": 3.0
                    },
                    "num_routes": 1,
                    "vehicle_efficiency": {
                        "average": 0.01,
                        "range": {
                            "min": 0.01,
                            "max": 0.01
                        }
                    },
                    "time_window_violations": {
                        "total": 0,
                        "average_per_route": 0
                    },
                    "route_metrics": {
                        "longest_distance": 150.5,
                        "shortest_distance": 150.5,
                        "heaviest_route": 1500,
                        "lightest_route": 1500,
                        "most_volume": 3.0,
                        "least_volume": 3.0
                    }
                }
            }
        }