from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional, Dict, Any
from datetime import date
import logging

from .. import models, schemas
from ..database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/collection-points",
    tags=["collection-points"],
)

@router.get("", response_model=List[schemas.CollectionPoint])
async def list_collection_points(
    skip: int = 0, 
    limit: int = 100, 
    active_only: bool = True,
    city: Optional[str] = None,
    state: Optional[str] = None,
    date_filter: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db)
):
    query = db.query(models.CollectionPoint)

    if active_only:
        query = query.filter(models.CollectionPoint.is_active == True)
    if city:
        query = query.filter(models.CollectionPoint.city.ilike(f"%{city}%"))
    if state:
        query = query.filter(models.CollectionPoint.state.ilike(f"%{state}%"))

    if date_filter:
        day_of_week = date_filter.isoweekday()
        week_of_month = (date_filter.day - 1) // 7 + 1

        # Condições de frequência
        daily_cond = or_(
            models.CollectionPoint.frequency.is_(None),
            func.upper(models.CollectionPoint.frequency).in_(["DIARIO", "DIÁRIO"])
        )
        weekly_cond = and_(
            func.upper(models.CollectionPoint.frequency) == "SEMANAL",
            func.like(models.CollectionPoint.days_of_week, f"%{day_of_week}%")
        )
        monthly_cond = and_(
            func.upper(models.CollectionPoint.frequency) == "MENSAL",
            func.like(models.CollectionPoint.days_of_week, f"%{day_of_week}%"),
            func.like(models.CollectionPoint.weeks_of_month, f"%{week_of_month}%")
        )

        query = query.filter(or_(daily_cond, weekly_cond, monthly_cond))

    points = query.offset(skip).limit(limit).all()
    return points

@router.post("", response_model=schemas.CollectionPoint, status_code=status.HTTP_201_CREATED)
async def create_collection_point(point: schemas.CollectionPointCreate, db: Session = Depends(get_db)):
    existing_point = db.query(models.CollectionPoint).filter(
        func.lower(models.CollectionPoint.name) == func.lower(point.name.strip()),
        func.lower(models.CollectionPoint.city) == func.lower(point.city.strip()),
        models.CollectionPoint.is_active == True
    ).first()

    if existing_point:
        raise HTTPException(status_code=400, detail=f"Ponto de coleta com nome '{point.name}' já existe em {point.city}")

    db_point = models.CollectionPoint(**point.dict())
    db.add(db_point)
    db.commit()
    db.refresh(db_point)
    return db_point

@router.get("/{point_id}", response_model=schemas.CollectionPoint)
def get_collection_point(point_id: int, db: Session = Depends(get_db)):
    db_point = db.query(models.CollectionPoint).get(point_id)
    if not db_point:
        raise HTTPException(status_code=404, detail="Ponto de coleta não encontrado")
    return db_point

@router.put("/{point_id}", response_model=schemas.CollectionPoint)
def update_collection_point(point_id: int, point: schemas.CollectionPointUpdate, db: Session = Depends(get_db)):
    db_point = db.query(models.CollectionPoint).get(point_id)
    if not db_point:
        raise HTTPException(status_code=404, detail="Ponto de coleta não encontrado")
    
    update_data = point.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_point, key, value)
        
    db.commit()
    db.refresh(db_point)
    return db_point

@router.delete("/{point_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection_point(point_id: int, db: Session = Depends(get_db)):
    db_point = db.query(models.CollectionPoint).get(point_id)
    if not db_point:
        raise HTTPException(status_code=404, detail="Ponto de coleta não encontrado")
        
    db_point.is_active = False
    db.commit()
    return None

@router.post("/batch", status_code=status.HTTP_201_CREATED)
async def create_collection_points_batch(batch: schemas.CollectionPointBatchCreate, db: Session = Depends(get_db)):
    if not batch.points:
        raise HTTPException(status_code=400, detail="Nenhum ponto de coleta fornecido")

    created_count = 0
    updated_count = 0
    
    for point_data in batch.points:
        external_id = point_data.external_id
        if not external_id:
            continue

        existing_point = db.query(models.CollectionPoint).filter_by(external_id=external_id).first()
        if existing_point:
            for key, value in point_data.dict(exclude_unset=True).items():
                setattr(existing_point, key, value)
            updated_count += 1
        else:
            db_point = models.CollectionPoint(**point_data.dict())
            db.add(db_point)
            created_count += 1
    
    db.commit()
    return {"created": created_count, "updated": updated_count}
