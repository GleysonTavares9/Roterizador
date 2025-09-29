from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
from enum import Enum
import re
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, event, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
from pydantic import BaseModel, validator, Field
from app.database import Base

# Enums para valores pré-definidos
class FrequencyType(str, Enum):
    DAILY = "diaria"
    WEEKLY = "semanal"
    BIWEEKLY = "quinzenal"
    MONTHLY = "mensal"
    CUSTOM = "personalizada"

class WeekDay(int, Enum):
    SEGUNDA = 1
    TERCA = 2
    QUARTA = 3
    QUINTA = 4
    SEXTA = 5
    SABADO = 6
    DOMINGO = 7

# Validador de CEP brasileiro
def validate_cep(cep: str) -> str:
    if not cep:
        return cep
    cep = ''.join(filter(str.isdigit, cep))
    if len(cep) != 8:
        raise ValueError("CEP deve conter 8 dígitos")
    return f"{cep[:5]}-{cep[5:]}"

# Validador de UF brasileira
def validate_uf(uf: str) -> str:
    if not uf:
        return uf
    uf = uf.upper().strip()
    brazilian_states = {
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
        'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
        'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    }
    if uf not in brazilian_states:
        raise ValueError("UF inválida. Deve ser uma sigla de estado brasileiro.")
    return uf

class CollectionPoint(Base):
    """
    Modelo para armazenar informações dos pontos de coleta.
    
    Atributos:
        id (int): Identificador único do ponto de coleta
        external_id (str): ID único externo para integração com outros sistemas
        name (str): Nome do ponto de coleta
        address (str): Endereço completo
        neighborhood (str): Bairro
        city (str): Cidade
        state (str): UF (2 caracteres)
        zip_code (str): CEP (formato 00000-000)
        phone (str): Telefone para contato
        email (str): E-mail para contato
        notes (str): Observações adicionais
        latitude (float): Coordenada de latitude
        longitude (float): Coordenada de longitude
        frequency (str): Frequência de coleta
        days_of_week (str): Dias da semana para coleta
        weeks_of_month (str): Semanas do mês para coleta
        is_active (bool): Indica se o ponto está ativo
        created_at (datetime): Data de criação
        updated_at (datetime): Data da última atualização
    """
    __tablename__ = "collection_points"
    
    id = Column(Integer, primary_key=True, index=True, comment='Identificador único do ponto de coleta')
    external_id = Column(
        String(100), 
        unique=True, 
        index=True, 
        nullable=True, 
        comment='ID único externo para integração com outros sistemas'
    )
    
    # Dados de localização
    name = Column(String(100), nullable=False, comment='Nome do ponto de coleta')
    address = Column(String(255), nullable=False, comment='Endereço completo')
    neighborhood = Column(String(100), nullable=True, comment='Bairro')
    city = Column(String(100), nullable=False, comment='Cidade')
    state = Column(String(2), nullable=True, comment='UF (2 caracteres)')
    zip_code = Column(String(10), nullable=True, comment='CEP (formato 00000-000)')
    
    # Contato
    phone = Column(String(20), nullable=True, comment='Telefone para contato')
    email = Column(String(100), nullable=True, comment='E-mail para contato')
    
    # Dados adicionais
    notes = Column(Text, nullable=True, comment='Observações adicionais')
    
    # Coordenadas geográficas
    latitude = Column(Float, nullable=True, comment='Coordenada de latitude')
    longitude = Column(Float, nullable=True, comment='Coordenada de longitude')
    
    # Frequência de coleta
    frequency = Column(
        String(20), 
        nullable=True, 
        comment='Frequência de coleta (diaria, semanal, quinzenal, mensal, personalizada)'
    )
    
    days_of_week = Column(
        String(50), 
        nullable=True, 
        comment='Dias da semana (1-7, onde 1=segunda, 7=domingo), separados por vírgula'
    )
    
    weeks_of_month = Column(
        String(20), 
        nullable=True, 
        comment='Semanas do mês (1-4), separadas por vírgula'
    )
    
    # Controle
    is_active = Column(Boolean, default=True, nullable=False, comment='Indica se o ponto está ativo')
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
    
    # Relacionamentos
    # routes = relationship("Route", secondary="route_collection_points", back_populates="collection_points")
    
    __table_args__ = (
        # Garante que se tiver latitude, também deve ter longitude e vice-versa
        CheckConstraint(
            '(latitude IS NULL AND longitude IS NULL) OR '
            '(latitude IS NOT NULL AND longitude IS NOT NULL)',
            name='check_lat_lng_both_null_or_not'
        ),
        # Garante que o CEP siga o formato correto quando preenchido
        CheckConstraint(
            "zip_code IS NULL OR zip_code ~* '^\\d{5}-?\\d{3}$'",
            name='check_zip_code_format'
        ),
        # Garante que o estado seja uma UF válida quando preenchido
        CheckConstraint(
            "state IS NULL OR state ~* '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$'",
            name='check_valid_state_uf'
        ),
        {'comment': 'Armazena informações dos pontos de coleta'},
    )
    
    # Validações
    @validates('email')
    def validate_email(self, key, email):
        """Valida o formato do e-mail"""
        if email and not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
            raise ValueError("Formato de e-mail inválido")
        return email
    
    @validates('phone')
    def validate_phone(self, key, phone):
        """Valida e formata o número de telefone"""
        if not phone:
            return phone
            
        # Remove caracteres não numéricos
        digits = ''.join(filter(str.isdigit, phone))
        
        # Verifica se tem o número mínimo de dígitos (8 para fixo, 9 para celular com DDD)
        if len(digits) < 10 or len(digits) > 11:
            raise ValueError("Número de telefone inválido. Use o formato (XX) XXXX-XXXX ou (XX) 9XXXX-XXXX")
            
        # Formata o número
        if len(digits) == 10:  # Fixo
            return f"({digits[:2]}) {digits[2:6]}-{digits[6:]}"
        else:  # Celular
            return f"({digits[:2]}) {digits[2]} {digits[3:7]}-{digits[7:]}"
    
    @validates('zip_code')
    def validate_zip_code(self, key, zip_code):
        """Valida e formata o CEP"""
        if not zip_code:
            return None
        return validate_cep(zip_code)
    
    @validates('state')
    def validate_state(self, key, state):
        """Valida a UF"""
        if not state:
            return None
        return validate_uf(state)
    
    @validates('latitude', 'longitude')
    def validate_coordinates(self, key, value):
        """Valida as coordenadas geográficas"""
        if value is None:
            return None
            
        if key == 'latitude' and not -90 <= value <= 90:
            raise ValueError("A latitude deve estar entre -90 e 90 graus")
        elif key == 'longitude' and not -180 <= value <= 180:
            raise ValueError("A longitude deve estar entre -180 e 180 graus")
            
        return round(value, 6)  # Arredonda para 6 casas decimais
    
    def to_dict(self, include_routes: bool = False) -> Dict[str, Any]:
        """
        Converte o objeto CollectionPoint para um dicionário.
        
        Args:
            include_routes (bool): Se True, inclui informações das rotas associadas
            
        Returns:
            dict: Dicionário com os dados do ponto de coleta
        """
        result = {
            "id": self.id,
            "external_id": self.external_id,
            "name": self.name,
            "address": self.address,
            "neighborhood": self.neighborhood,
            "city": self.city,
            "state": self.state,
            "zip_code": self.zip_code,
            "phone": self.phone,
            "email": self.email,
            "notes": self.notes,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "frequency": self.frequency,
            "days_of_week": [int(d) for d in self.days_of_week.split(',')] if self.days_of_week else [],
            "weeks_of_month": [int(w) for w in self.weeks_of_month.split(',')] if self.weeks_of_month else [],
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_routes and hasattr(self, 'routes'):
            result["routes"] = [route.to_dict() for route in self.routes]
            
        return result
    
    def get_address_string(self) -> str:
        """Retorna o endereço completo como string"""
        parts = [
            self.address,
            f", {self.neighborhood}" if self.neighborhood else "",
            f" - {self.city}" if self.city else "",
            f"/{self.state}" if self.state else "",
            f" - CEP: {self.zip_code}" if self.zip_code else ""
        ]
        return "".join(parts).strip()
    
    def get_coordinates(self) -> Optional[Dict[str, float]]:
        """Retorna as coordenadas como dicionário, se disponíveis"""
        if self.latitude is not None and self.longitude is not None:
            return {"latitude": self.latitude, "longitude": self.longitude}
        return None
    
    def is_open_on(self, date: datetime) -> bool:
        """
        Verifica se o ponto de coleta está aberto na data fornecida.
        
        Args:
            date (datetime): Data para verificação
            
        Returns:
            bool: True se estiver aberto, False caso contrário
        """
        if not self.is_active:
            return False
            
        # Se não há informações de frequência, assume-se que está sempre aberto
        if not self.frequency:
            return True
            
        # Verifica o dia da semana (1=segunda, 7=domingo)
        weekday = date.isoweekday()
        
        # Verifica a semana do mês (1-4)
        week_of_month = (date.day - 1) // 7 + 1
        
        # Verifica os dias da semana
        if self.days_of_week:
            days = {int(d) for d in self.days_of_week.split(',')}
            if weekday not in days:
                return False
        
        # Verifica as semanas do mês
        if self.weeks_of_month:
            weeks = {int(w) for w in self.weeks_of_month.split(',')}
            if week_of_month not in weeks:
                return False
                
        # Verifica a frequência
        if self.frequency == FrequencyType.DAILY.value:
            return True
        elif self.frequency == FrequencyType.WEEKLY.value:
            return True  # Já verificamos o dia da semana
        elif self.frequency == FrequencyType.BIWEEKLY.value:
            return date.isocalendar().week % 2 == 0  # Semanas pares
        elif self.frequency == FrequencyType.MONTHLY.value:
            return date.day == 1  # Primeiro dia do mês
            
        return True
    
    def __repr__(self) -> str:
        return f"<CollectionPoint {self.name} (ID: {self.id})>"


@event.listens_for(CollectionPoint, 'before_insert')
@event.listens_for(CollectionPoint, 'before_update')
def update_timestamps(mapper, connection, target):
    """Atualiza os timestamps antes de salvar"""
    now = datetime.now(timezone.utc)
    if not target.created_at:
        target.created_at = now
    target.updated_at = now
