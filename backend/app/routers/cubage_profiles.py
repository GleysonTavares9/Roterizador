from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/cubage-profiles",
    tags=["cubage-profiles"],
)

@router.get("/", response_model=List[schemas.CubageProfile])
async def list_cubage_profiles(
    skip: int = 0, 
    limit: int = 100, 
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Lista todos os perfis de cubagem."""
    query = db.query(models.CubageProfile)
    if active_only:
        query = query.filter(models.CubageProfile.is_active == True)
    profiles = query.order_by(models.CubageProfile.name.asc()).offset(skip).limit(limit).all()
    return profiles

@router.post("/", response_model=schemas.CubageProfile, status_code=status.HTTP_201_CREATED)
async def create_cubage_profile(
    profile: schemas.CubageProfileCreate, 
    db: Session = Depends(get_db)
):
    """Cria um novo perfil de cubagem."""
    db_profile = db.query(models.CubageProfile).filter(
        models.CubageProfile.name.ilike(profile.name.strip())
    ).first()
    
    if db_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Já existe um perfil com este nome"
        )
    
    profile_data = profile.dict()
    db_profile = models.CubageProfile(**profile_data)
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    return db_profile

@router.get("/{profile_id}", response_model=schemas.CubageProfile)
def get_cubage_profile(profile_id: int, db: Session = Depends(get_db)):
    """Obtém um perfil de cubagem pelo ID."""
    db_profile = db.get(models.CubageProfile, profile_id)
    if not db_profile:
        raise HTTPException(status_code=status.HTTP_404, detail="Perfil de cubagem não encontrado")
    return db_profile

@router.put("/{profile_id}", response_model=schemas.CubageProfile)
async def update_cubage_profile(
    profile_id: int, 
    profile: schemas.CubageProfileUpdate, 
    db: Session = Depends(get_db)
):
    """Atualiza um perfil de cubagem existente."""
    db_profile = db.get(models.CubageProfile, profile_id)
    if not db_profile:
        raise HTTPException(status_code=status.HTTP_404, detail="Perfil de cubagem não encontrado")

    if profile.name and profile.name.lower() != db_profile.name.lower():
        existing = db.query(models.CubageProfile).filter(
            models.CubageProfile.name.ilike(profile.name.strip()),
            models.CubageProfile.id != profile_id
        ).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Já existe um perfil com este nome")

    update_data = profile.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_profile, key, value)
        
    db.commit()
    db.refresh(db_profile)
    return db_profile

@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cubage_profile(profile_id: int, db: Session = Depends(get_db)):
    """Desativa um perfil de cubagem (soft delete)."""
    db_profile = db.get(models.CubageProfile, profile_id)
    if db_profile:
        db_profile.is_active = False
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
