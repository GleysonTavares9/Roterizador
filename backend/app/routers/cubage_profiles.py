from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Dict, Any
from .. import models, schemas
from ..database import get_db, engine

router = APIRouter(
    tags=["cubage-profiles"],
    responses={404: {"description": "Not found"}},
)

@router.get("/check", response_model=Dict[str, Any])
async def check_cubage_profiles(db: Session = Depends(get_db)):
    """Verifica a integridade da tabela de perfis de cubagem"""
    try:
        # Verifica se a tabela existe (versão para SQLite)
        try:
            # Tenta contar os registros da tabela
            db.execute(text("SELECT COUNT(*) FROM cubage_profiles")).scalar()
            table_exists = True
        except:
            table_exists = False
        
        if not table_exists:
            return {
                "table_exists": False,
                "error": "A tabela 'cubage_profiles' não existe no banco de dados"
            }
        
        # Conta o número de registros
        count = db.query(models.CubageProfile).count()
        
        # Pega alguns registros de exemplo
        profiles = db.query(models.CubageProfile).limit(5).all()
        
        return {
            "table_exists": True,
            "count": count,
            "sample_profiles": [
                {
                    "id": p.id,
                    "name": p.name,
                    "description": p.description,
                    "weight": p.weight,
                    "length": p.length,
                    "width": p.width,
                    "height": p.height,
                    "is_active": p.is_active
                } for p in profiles
            ]
        }
        
    except Exception as e:
        return {
            "table_exists": False,
            "error": str(e)
        }

@router.get("/", response_model=List[schemas.CubageProfile])
async def list_cubage_profiles(
    skip: int = 0, 
    limit: int = 100, 
    active_only: bool = False,  # Alterado para False por padrão
    db: Session = Depends(get_db)
):
    """Lista todos os perfis de cubagem"""
    try:
        # Log da requisição
        print(f"Listando perfis - skip: {skip}, limit: {limit}, active_only: {active_only}")
        
        # Constrói a query base
        query = db.query(models.CubageProfile)
        
        # Aplica filtro de ativos se necessário
        if active_only:
            query = query.filter(models.CubageProfile.is_active == True)
        
        # Ordena por nome
        query = query.order_by(models.CubageProfile.name.asc())
        
        # Aplica paginação
        profiles = query.offset(skip).limit(limit).all()
        
        # Log do resultado
        print(f"Encontrados {len(profiles)} perfis")
        
        return profiles
        
    except Exception as e:
        print(f"Erro ao listar perfis: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao listar perfis: {str(e)}"
        )

@router.post("/", response_model=schemas.CubageProfile, status_code=status.HTTP_201_CREATED)
async def create_cubage_profile(
    profile: schemas.CubageProfileCreate, 
    db: Session = Depends(get_db)
):
    """Cria um novo perfil de cubagem"""
    import json
    
    # Log dos dados recebidos
    print("Dados recebidos na requisição:", json.dumps(profile.dict(), default=str))
    
    # Verifica se já existe um perfil com o mesmo nome (case-insensitive)
    db_profile = db.query(models.CubageProfile).filter(
        models.CubageProfile.name.ilike(profile.name.strip())
    ).first()
    
    if db_profile:
        print(f"Já existe um perfil com o nome: {profile.name}")
        raise HTTPException(
            status_code=400, 
            detail="Já existe um perfil com este nome"
        )
    
    try:
        # Prepara os dados para criação
        profile_data = profile.dict()
        
        # Garante que os valores numéricos sejam float
        for field in ['weight', 'length', 'width', 'height']:
            if field in profile_data and profile_data[field] is not None:
                try:
                    # Converte para string, substitui vírgula por ponto e converte para float
                    profile_data[field] = float(str(profile_data[field]).replace(',', '.'))
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Valor inválido para {field}. Deve ser um número."
                    )
        
        # Cria o novo perfil
        db_profile = models.CubageProfile(**profile_data)
        db.add(db_profile)
        db.commit()
        db.refresh(db_profile)
        
        print(f"Perfil criado com sucesso: {db_profile.id}")
        return db_profile
        
    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        print(f"Erro ao criar perfil: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Erro ao criar perfil: {str(e)}"
        )

@router.get("/{profile_id}", response_model=schemas.CubageProfile)
def get_cubage_profile(profile_id: int, db: Session = Depends(get_db)):
    """Obtém um perfil de cubagem pelo ID"""
    db_profile = db.query(models.CubageProfile).filter(
        models.CubageProfile.id == profile_id
    ).first()
    if db_profile is None:
        raise HTTPException(status_code=404, detail="Perfil de cubagem não encontrado")
    return db_profile

@router.put("/{profile_id}", response_model=schemas.CubageProfile)
async def update_cubage_profile(
    profile_id: int, 
    profile: schemas.CubageProfileUpdate, 
    db: Session = Depends(get_db)
):
    """Atualiza um perfil de cubagem existente"""
    import json
    
    # Log dos dados recebidos
    print(f"Atualizando perfil {profile_id} com dados:", json.dumps(profile.dict(exclude_unset=True), default=str))
    
    # Busca o perfil existente
    db_profile = db.query(models.CubageProfile).filter(
        models.CubageProfile.id == profile_id
    ).first()
    
    if db_profile is None:
        raise HTTPException(status_code=404, detail="Perfil de cubagem não encontrado")
    
    # Verifica se o novo nome já está em uso por outro perfil (case-insensitive)
    if profile.name and profile.name.lower() != db_profile.name.lower():
        existing_profile = db.query(models.CubageProfile).filter(
            models.CubageProfile.name.ilike(profile.name.strip()),
            models.CubageProfile.id != profile_id
        ).first()
        if existing_profile:
            raise HTTPException(
                status_code=400, 
                detail="Já existe um perfil com este nome"
            )
    
    try:
        # Prepara os dados para atualização
        update_data = profile.dict(exclude_unset=True)
        
        # Processa campos numéricos
        for field in ['weight', 'length', 'width', 'height']:
            if field in update_data and update_data[field] is not None:
                try:
                    # Converte para string, substitui vírgula por ponto e converte para float
                    update_data[field] = float(str(update_data[field]).replace(',', '.'))
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Valor inválido para {field}. Deve ser um número."
                    )
        
        # Atualiza os campos fornecidos
        for key, value in update_data.items():
            setattr(db_profile, key, value)
        
        db.commit()
        db.refresh(db_profile)
        
        print(f"Perfil {profile_id} atualizado com sucesso")
        return db_profile
        
    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        print(f"Erro ao atualizar perfil {profile_id}: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Erro ao atualizar perfil: {str(e)}"
        )

@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cubage_profile(profile_id: int, db: Session = Depends(get_db)):
    """Remove permanentemente um perfil de cubagem do banco de dados"""
    db_profile = db.query(models.CubageProfile).filter(
        models.CubageProfile.id == profile_id
    ).first()
    
    if db_profile is None:
        raise HTTPException(status_code=404, detail="Perfil de cubagem não encontrado")
    
    # Remove o registro do banco de dados
    db.delete(db_profile)
    db.commit()
    
    # Retorna 204 No Content em caso de sucesso
    return
