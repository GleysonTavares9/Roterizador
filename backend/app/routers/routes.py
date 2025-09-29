from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Dict, Any

router = APIRouter(
    prefix="/api/routes",
    tags=["routes"],
    responses={404: {"description": "Not found"}},
)

# Modelo de dados para uma rota
class RoutePoint(BaseModel):
    id: str
    address: str
    lat: float
    lng: float
    sequence: int
    estimated_arrival: Optional[str] = None
    estimated_departure: Optional[str] = None

class RouteCreate(BaseModel):
    name: str
    vehicle_id: str
    driver_id: Optional[str] = None
    start_time: str
    end_time: str
    points: List[RoutePoint]
    metadata: Optional[Dict[str, Any]] = None

class RouteResponse(RouteCreate):
    id: str
    status: str
    created_at: datetime
    updated_at: datetime
    total_distance: float
    total_duration: float

# Dados de exemplo (em um cenário real, isso viria de um banco de dados)
routes_db = {}

@router.get("/", response_model=List[RouteResponse])
async def list_routes(
    status: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Lista todas as rotas, com opções de filtro.
    """
    # Em uma implementação real, isso buscaria do banco de dados
    filtered_routes = list(routes_db.values())
    
    if status:
        filtered_routes = [r for r in filtered_routes if r['status'].lower() == status.lower()]
    if vehicle_id:
        filtered_routes = [r for r in filtered_routes if r['vehicle_id'] == vehicle_id]
    
    return filtered_routes

@router.post("/", response_model=RouteResponse, status_code=status.HTTP_201_CREATED)
async def create_route(route: RouteCreate):
    """
    Cria uma nova rota.
    """
    route_id = f"route_{len(routes_db) + 1}"
    now = datetime.utcnow()
    
    # Em uma implementação real, isso salvaria no banco de dados
    route_data = {
        **route.dict(),
        "id": route_id,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "total_distance": 0.0,  # Seria calculado
        "total_duration": 0.0,  # Seria calculado
    }
    
    routes_db[route_id] = route_data
    return route_data

@router.get("/{route_id}", response_model=RouteResponse)
async def get_route(route_id: str):
    """
    Obtém detalhes de uma rota específica.
    """
    if route_id not in routes_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rota com ID {route_id} não encontrada"
        )
    return routes_db[route_id]

@router.put("/{route_id}", response_model=RouteResponse)
async def update_route(route_id: str, route_update: RouteCreate):
    """
    Atualiza uma rota existente.
    """
    if route_id not in routes_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rota com ID {route_id} não encontrada"
        )
    
    # Em uma implementação real, isso atualizaria no banco de dados
    updated_route = {
        **route_update.dict(),
        "id": route_id,
        "status": routes_db[route_id]["status"],  # Mantém o status atual
        "created_at": routes_db[route_id]["created_at"],
        "updated_at": datetime.utcnow(),
        "total_distance": routes_db[route_id]["total_distance"],  # Mantém a distância atual
        "total_duration": routes_db[route_id]["total_duration"],  # Mantém a duração atual
    }
    
    routes_db[route_id] = updated_route
    return updated_route

@router.delete("/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_route(route_id: str):
    """
    Remove uma rota.
    """
    if route_id not in routes_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rota com ID {route_id} não encontrada"
        )
    
    # Em uma implementação real, isso removeria do banco de dados
    del routes_db[route_id]
    return None

@router.post("/{route_id}/start", response_model=RouteResponse)
async def start_route(route_id: str):
    """
    Inicia uma rota, alterando seu status para 'in_progress'.
    """
    if route_id not in routes_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rota com ID {route_id} não encontrada"
        )
    
    route = routes_db[route_id]
    route["status"] = "in_progress"
    route["updated_at"] = datetime.utcnow()
    
    return route

@router.post("/{route_id}/complete", response_model=RouteResponse)
async def complete_route(route_id: str):
    """
    Marca uma rota como concluída.
    """
    if route_id not in routes_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rota com ID {route_id} não encontrada"
        )
    
    route = routes_db[route_id]
    route["status"] = "completed"
    route["updated_at"] = datetime.utcnow()
    
    return route
