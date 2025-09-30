from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/routes",
    tags=["routes"],
)

@router.get("", response_model=List[schemas.Route])
async def list_routes(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    vehicle_id: Optional[int] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    """Lista todas as rotas com filtros opcionais."""
    query = db.query(models.Route)
    
    if vehicle_id:
        query = query.filter(models.Route.vehicle_id == vehicle_id)
    if status:
        query = query.filter(models.Route.status.ilike(f"%{status}%"))
    if start_date:
        query = query.filter(models.Route.start_time >= start_date)
    if end_date:
        query = query.filter(models.Route.end_time <= end_date)
        
    routes = query.offset(skip).limit(limit).all()
    return routes

@router.post("", response_model=schemas.Route, status_code=status.HTTP_201_CREATED)
async def create_route(route: schemas.RouteCreate, db: Session = Depends(get_db)):
    """Cria uma nova rota no banco de dados."""
    db_route = models.Route(**route.dict())
    db.add(db_route)
    db.commit()
    db.refresh(db_route)
    return db_route

@router.get("/{route_id}", response_model=schemas.Route)
async def get_route(route_id: int, db: Session = Depends(get_db)):
    """Obtém os detalhes de uma rota específica."""
    db_route = db.get(models.Route, route_id)
    if not db_route:
        raise HTTPException(status_code=404, detail="Rota não encontrada")
    return db_route

@router.put("/{route_id}", response_model=schemas.Route)
async def update_route(route_id: int, route: schemas.RouteUpdate, db: Session = Depends(get_db)):
    """Atualiza uma rota existente."""
    db_route = db.get(models.Route, route_id)
    if not db_route:
        raise HTTPException(status_code=404, detail="Rota não encontrada")

    update_data = route.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_route, key, value)
        
    db.commit()
    db.refresh(db_route)
    return db_route

@router.delete("/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_route(route_id: int, db: Session = Depends(get_db)):
    """Desativa uma rota (soft delete)."""
    db_route = db.get(models.Route, route_id)
    if db_route:
        db_route.is_active = False
        db.commit()
    return

@router.post("/{route_id}/status", response_model=schemas.Route)
async def update_route_status(
    route_id: int, 
    status_update: schemas.RouteStatusUpdate, 
    db: Session = Depends(get_db)
):
    """Atualiza o status de uma rota (ex: iniciar, completar)."""
    db_route = db.get(models.Route, route_id)
    if not db_route:
        raise HTTPException(status_code=404, detail="Rota não encontrada")

    db_route.status = status_update.status
    db.commit()
    db.refresh(db_route)
    return db_route
