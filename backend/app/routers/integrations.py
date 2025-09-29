"""
Roteador para gerenciar as configurações de integração.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, validator
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

try:
    import googlemaps
    GOOGLE_MAPS_AVAILABLE = True
except ImportError:
    GOOGLE_MAPS_AVAILABLE = False
    logging.warning("Google Maps API não está disponível. Instale o pacote 'googlemaps' para habilitar a funcionalidade.")

from app.database import get_db
from app.models.settings import Settings

router = APIRouter(tags=["integrations"])

# Configuração de logging
logger = logging.getLogger(__name__)

# Modelo para as configurações de integração
class IntegrationSettings(BaseModel):
    email_server: Optional[str] = Field(None, description="Servidor SMTP para envio de emails")
    email_port: Optional[int] = Field(None, description="Porta do servidor SMTP")
    email_username: Optional[str] = Field(None, description="Nome de usuário para autenticação no servidor SMTP")
    email_password: Optional[str] = Field(None, description="Senha para autenticação no servidor SMTP")
    email_from: Optional[str] = Field(None, description="Endereço de email remetente")
    google_maps_api_key: Optional[str] = Field(None, description="Chave da API do Google Maps")

    @validator('email_port')
    def validate_port(cls, v):
        if v is not None and (v <= 0 or v > 65535):
            raise ValueError('Porta inválida. Deve estar entre 1 e 65535')
        return v

# Modelo para teste de email
class EmailTestRequest(BaseModel):
    email_server: str
    email_port: int
    email_username: str
    email_password: str
    email_from: str

# Modelo para teste do Google Maps
class GoogleMapsTestRequest(BaseModel):
    api_key: str

# Rota para obter as configurações de integração
@router.get("/", response_model=Dict[str, Any])
async def get_integration_settings(db: Session = Depends(get_db)):
    """
    Obtém as configurações de integração atuais.
    """
    try:
        # Busca as configurações no banco de dados
        settings = db.query(Settings).filter(Settings.key.in_([
            'email_server', 'email_port', 'email_username', 'email_password',
            'email_from', 'google_maps_api_key'
        ])).all()
        
        # Converte para dicionário
        result = {}
        for setting in settings:
            result[setting.key] = setting.value
            
        return result
    except Exception as e:
        logger.error(f"Erro ao buscar configurações de integração: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar configurações de integração"
        )

# Rota para atualizar as configurações de integração
@router.put("/", response_model=Dict[str, str])
async def update_integration_settings(settings: IntegrationSettings, db: Session = Depends(get_db)):
    """
    Atualiza as configurações de integração.
    """
    try:
        logger.info(f"Recebidas configurações para atualização: {settings.dict()}")
        # Converte o modelo para dicionário, removendo valores None
        settings_dict = settings.dict(exclude_unset=True)
        
        for key, value in settings_dict.items():
            # Verifica se a configuração já existe
            setting = db.query(Settings).filter(Settings.key == key).first()
            
            if setting:
                # Atualiza o valor existente
                setting.value = str(value) if value is not None else None
            else:
                # Cria uma nova configuração
                setting = Settings(key=key, value=str(value) if value is not None else None)
                db.add(setting)
        
        db.commit()
        logger.info("Configurações de integração atualizadas com sucesso")
        return {"message": "Configurações de integração atualizadas com sucesso"}
    except Exception as e:
        db.rollback()
        logger.error(f"Erro ao atualizar configurações de integração: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao atualizar configurações de integração: {str(e)}"
        )

# Rota para testar a conexão com o servidor de email
@router.post("/test-email", response_model=Dict[str, str])
async def test_email_connection(settings: EmailTestRequest):
    """
    Testa a conexão com o servidor de email.
    """
    try:
        # Extrai as configurações do email
        server = settings.email_server
        port = settings.email_port
        username = settings.email_username
        password = settings.email_password
        from_email = settings.email_from
        
        if not all([server, port, username, password, from_email]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Configurações de email incompletas"
            )
        
        # Cria a mensagem de teste
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = from_email  # Envia para o próprio remetente
        msg['Subject'] = 'Teste de Conexão - Sistema de Roteirização'
        
        body = "Este é um email de teste para verificar a conexão com o servidor de email."
        msg.attach(MIMEText(body, 'plain'))
        
        # Tenta se conectar e enviar o email
        with smtplib.SMTP(server, port, timeout=10) as server:
            server.starttls()
            server.login(username, password)
            server.send_message(msg)
        
        return {"message": "Conexão com o servidor de email testada com sucesso!"}
        
    except smtplib.SMTPException as e:
        logger.error(f"Erro SMTP ao testar conexão de email: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Falha ao conectar ao servidor de email: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Erro ao testar conexão de email: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao testar conexão de email: {str(e)}"
        )

# Rota para testar a chave da API do Google Maps
@router.post("/test-google-maps", response_model=Dict[str, str])
async def test_google_maps_api_key(api_data: GoogleMapsTestRequest):
    """
    Testa a chave da API do Google Maps.
    """
    if not GOOGLE_MAPS_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="A funcionalidade do Google Maps não está disponível. Instale o pacote 'googlemaps'."
        )
        
    try:
        api_key = api_data.api_key
        
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Chave da API do Google Maps não fornecida"
            )
        
        # Tenta criar um cliente do Google Maps com a chave fornecida
        gmaps = googlemaps.Client(key=api_key)
        
        # Faz uma requisição simples para validar a chave
        try:
            # Usa uma localização conhecida para o teste (São Paulo)
            gmaps.geocode('São Paulo, SP', region='br')
            return {"message": "Chave da API do Google Maps válida!"}
        except Exception as e:
            logger.error(f"Erro ao validar chave da API do Google Maps: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Falha ao validar chave da API: {str(e)}"
            )
            
    except Exception as e:
        logger.error(f"Erro ao testar chave da API do Google Maps: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao testar chave da API do Google Maps: {str(e)}"
        )
