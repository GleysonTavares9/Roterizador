from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union
import re
import pytz
from sqlalchemy import (
    Column, Integer, String, Boolean, JSON, DateTime, 
    event, CheckConstraint, Text, Float
)
from sqlalchemy.orm import validates
from sqlalchemy.sql import func
from pydantic import BaseModel, validator, Field, HttpUrl, EmailStr
from app.database import Base

# Constantes para validação
MAX_EMAIL_LENGTH = 100
MAX_URL_LENGTH = 255
MAX_NAME_LENGTH = 100
MAX_TEXT_LENGTH = 500

# Lista de fuso-horários suportados
SUPPORTED_TIMEZONES = pytz.all_timezones

# Modelo Pydantic para validação de configurações
class SettingsUpdate(BaseModel):
    """Modelo para validação na atualização de configurações"""
    value: Optional[Union[str, int, bool, float, dict, list]] = None
    description: Optional[str] = Field(None, max_length=500)
    is_public: Optional[bool] = None
    
    @validator('value')
    def validate_value(cls, v):
        if isinstance(v, str) and len(v) > MAX_TEXT_LENGTH:
            raise ValueError(f"O valor não pode ter mais que {MAX_TEXT_LENGTH} caracteres")
        return v

class Settings(Base):
    """
    Modelo para armazenar as configurações do sistema.
    
    Este modelo armazena configurações globais do sistema que podem ser acessadas
    por diferentes partes da aplicação. As configurações são armazenadas como pares
    chave-valor, com suporte a diferentes tipos de dados.
    
    Atributos:
        id (int): Identificador único da configuração
        key (str): Chave única que identifica a configuração
        value (str): Valor da configuração (serializado como string)
        description (str): Descrição detalhada da configuração
        is_public (bool): Indica se a configuração pode ser acessada publicamente
        created_at (datetime): Data de criação do registro
        updated_at (datetime): Data da última atualização
    """
    __tablename__ = "settings"
    
    # Identificação
    id = Column(Integer, primary_key=True, index=True, comment='Identificador único da configuração')
    key = Column(
        String(100), 
        unique=True, 
        nullable=False, 
        index=True,
        comment='Chave única que identifica a configuração'
    )
    
    # Valor e metadados
    value = Column(
        String(MAX_TEXT_LENGTH), 
        nullable=True,
        comment='Valor da configuração (serializado como string)'
    )
    
    description = Column(
        Text, 
        nullable=True,
        comment='Descrição detalhada da configuração'
    )
    
    is_public = Column(
        Boolean, 
        default=False,
        nullable=False,
        index=True,
        comment='Indica se a configuração pode ser acessada publicamente'
    )
    
    # Metadados
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
    
    # Configurações de Email
    email_server = Column(
        String(MAX_URL_LENGTH), 
        nullable=True,
        comment='Servidor SMTP para envio de e-mails'
    )
    
    email_port = Column(
        Integer, 
        nullable=True,
        comment='Porta do servidor SMTP (geralmente 465 para SSL ou 587 para TLS)'
    )
    
    email_username = Column(
        String(MAX_EMAIL_LENGTH), 
        nullable=True,
        comment='Nome de usuário para autenticação no servidor SMTP'
    )
    
    email_password = Column(
        String(100), 
        nullable=True,
        comment='Senha para autenticação no servidor SMTP (armazenada criptografada)'
    )
    
    email_from = Column(
        String(MAX_EMAIL_LENGTH), 
        nullable=True,
        comment='Endereço de e-mail remetente padrão'
    )
    
    # Configurações do Google Maps
    google_maps_api_key = Column(
        String(100), 
        nullable=True,
        comment='Chave de API do Google Maps para geocodificação e rotas'
    )
    
    # Informações da Empresa
    company_name = Column(
        String(MAX_NAME_LENGTH), 
        default="Minha Empresa",
        comment='Nome da empresa exibido no sistema'
    )
    
    company_document = Column(
        String(20), 
        nullable=True,
        comment='CNPJ ou CPF da empresa (apenas números)'
    )
    
    phone = Column(
        String(20), 
        nullable=True,
        comment='Telefone principal da empresa'
    )
    
    # Configurações de Aparência
    language = Column(
        String(10), 
        default="pt-BR",
        comment='Idioma padrão do sistema'
    )
    
    theme = Column(
        String(20), 
        default="light",
        comment='Tema de cores da interface (light, dark, system)'
    )
    
    primary_color = Column(
        String(7), 
        default="#1976D2",
        comment='Cor primária da interface (formato HEX)'
    )
    
    secondary_color = Column(
        String(7), 
        default="#424242",
        comment='Cor secundária da interface (formato HEX)'
    )
    
    # Configurações de Notificação
    notifications = Column(
        Boolean, 
        default=True,
        comment='Habilita/desabilita todas as notificações do sistema'
    )
    
    email_notifications = Column(
        Boolean, 
        default=False,
        comment='Habilita/desabilita notificações por e-mail'
    )
    
    push_notifications = Column(
        Boolean, 
        default=True,
        comment='Habilita/desabilita notificações push no navegador'
    )
    
    # Configurações de Sistema
    timezone = Column(
        String(50), 
        default="America/Sao_Paulo",
        comment='Fuso horário padrão do sistema'
    )
    
    date_format = Column(
        String(20), 
        default="dd/MM/yyyy",
        comment='Formato de data padrão (ex: dd/MM/yyyy, MM/dd/yyyy)'
    )
    
    time_format = Column(
        String(20), 
        default="HH:mm",
        comment='Formato de hora padrão (ex: HH:mm, hh:mm a)'
    )
    
    # Configurações de Rotas
    default_route_optimization = Column(Boolean, default=True)
    max_stops_per_route = Column(Integer, default=20)
    
    # Validações
    @validates('key')
    def validate_key(self, key, value):
        """Valida a chave da configuração"""
        if not value or len(value.strip()) < 3:
            raise ValueError("A chave deve ter pelo menos 3 caracteres")
        if not re.match(r'^[a-z0-9_]+$', value.lower()):
            raise ValueError("A chave deve conter apenas letras minúsculas, números e sublinhados")
        return value.lower()
    
    @validates('email_server')
    def validate_email_server(self, key, value):
        """Valida o servidor de e-mail"""
        if not value:
            return None
        if not re.match(r'^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', value):
            raise ValueError("Formato de servidor de e-mail inválido")
        return value
    
    @validates('email_port')
    def validate_email_port(self, key, value):
        """Valida a porta do servidor de e-mail"""
        if value is not None and (value < 1 or value > 65535):
            raise ValueError("A porta deve estar entre 1 e 65535")
        return value
    
    @validates('timezone')
    def validate_timezone(self, key, value):
        """Valida o fuso horário"""
        if value not in SUPPORTED_TIMEZONES:
            raise ValueError(f"Fuso horário não suportado. Use um dos valores em pytz.all_timezones")
        return value
    
    @validates('primary_color', 'secondary_color')
    def validate_hex_color(self, key, value):
        """Valida cores no formato HEX"""
        if not value or not re.match(r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$', value):
            raise ValueError("Cor inválida. Use o formato HEX (ex: #RRGGBB ou #RGB)")
        return value.upper()
    
    def to_dict(self, include_sensitive: bool = False) -> Dict[str, Any]:
        """
        Converte o objeto Settings para um dicionário.
        
        Args:
            include_sensitive (bool): Se True, inclui campos sensíveis como senhas
            
        Returns:
            dict: Dicionário com as configurações
        """
        result = {
            "id": self.id,
            "key": self.key,
            "value": self.value,
            "description": self.description,
            "is_public": self.is_public,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            
            # Configurações de Email
            "email_server": self.email_server,
            "email_port": self.email_port,
            "email_from": self.email_from,
            
            # Configurações do Google Maps
            "google_maps_api_key": self.google_maps_api_key if include_sensitive else None,
            
            # Informações da Empresa
            "company_name": self.company_name,
            "company_document": self.company_document,
            "phone": self.phone,
            
            # Configurações de Aparência
            "language": self.language,
            "theme": self.theme,
            "primary_color": self.primary_color,
            "secondary_color": self.secondary_color,
            
            # Configurações de Notificação
            "notifications": self.notifications,
            "email_notifications": self.email_notifications,
            "push_notifications": self.push_notifications,
            
            # Configurações de Sistema
            "timezone": self.timezone,
            "date_format": self.date_format,
            "time_format": self.time_format,
            
            # Configurações de Rotas
            "default_route_optimization": self.default_route_optimization,
            "max_stops_per_route": self.max_stops_per_route,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def get_defaults(cls) -> Dict[str, Any]:
        """Retorna os valores padrão para novas configurações."""
        return {
            "company_name": "Minha Empresa",
            "email": "contato@empresa.com",
            "language": "pt-BR",
            "theme": "light",
            "notifications": True,
            "primary_color": "#1976D2",
            "secondary_color": "#424242",
            "timezone": "America/Sao_Paulo",
            "date_format": "dd/MM/yyyy",
            "time_format": "HH:mm",
            "default_route_optimization": True,
            "max_stops_per_route": 20
        }
