"""
Roteador para gerenciar as configurações do sistema.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime

from app.database import get_db
from app.models.settings import Settings

# Modelo Pydantic para validação de entrada
class SettingsUpdate(BaseModel):
    company_name: Optional[str] = Field(None, max_length=100)
    company_document: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    language: Optional[str] = Field(None, max_length=10)
    theme: Optional[str] = Field(None, max_length=20)
    primary_color: Optional[str] = Field(None, max_length=7)
    secondary_color: Optional[str] = Field(None, max_length=7)
    notifications: Optional[bool] = None
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    timezone: Optional[str] = Field(None, max_length=50)
    date_format: Optional[str] = Field(None, max_length=20)
    time_format: Optional[str] = Field(None, max_length=20)
    default_route_optimization: Optional[bool] = None
    max_stops_per_route: Optional[int] = Field(None, ge=1, le=100)
    
    class Config:
        schema_extra = {
            "example": {
                "company_name": "Empresa Exemplo Ltda",
                "email": "contato@empresa.com",
                "theme": "light",
                "language": "pt-BR",
                "timezone": "America/Sao_Paulo"
            }
        }

router = APIRouter(
    tags=["settings"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=Dict[str, Any])
async def get_settings(db: Session = Depends(get_db)):
    """
    Obtém as configurações atuais do sistema.
    Se não existirem configurações, cria um registro padrão.
    """
    settings = db.query(Settings).first()
    
    if not settings:
        # Cria configurações padrão se não existirem
        settings = Settings(**Settings.get_defaults())
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return settings.to_dict()

@router.put("/", response_model=Dict[str, Any])
async def update_settings(
    settings_update: SettingsUpdate,
    db: Session = Depends(get_db)
):
    """
    Atualiza as configurações do sistema.
    Apenas os campos fornecidos serão atualizados.
    """
    # Obtém as configurações atuais ou cria um novo registro com valores padrão
    settings = db.query(Settings).first()
    
    if not settings:
        settings = Settings(**Settings.get_defaults())
        db.add(settings)
    
    # Converte o modelo Pydantic para dicionário, removendo campos não definidos (None)
    update_data = settings_update.dict(exclude_unset=True)
    
    # Atualiza apenas os campos fornecidos
    for key, value in update_data.items():
        if hasattr(settings, key):
            setattr(settings, key, value)
    
    db.commit()
    db.refresh(settings)
    
    return settings.to_dict()

@router.post("/reset-defaults", response_model=Dict[str, Any])
async def reset_to_defaults(db: Session = Depends(get_db)):
    """
    Redefine todas as configurações para os valores padrão.
    """
    settings = db.query(Settings).first()
    
    if not settings:
        settings = Settings(**Settings.get_defaults())
        db.add(settings)
    else:
        # Atualiza com valores padrão, mantendo o ID
        for key, value in Settings.get_defaults().items():
            if hasattr(settings, key):
                setattr(settings, key, value)
    
    db.commit()
    db.refresh(settings)
    
    return settings.to_dict()
