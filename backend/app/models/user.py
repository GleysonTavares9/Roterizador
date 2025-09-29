from sqlalchemy import Column, Integer, String, Boolean, DateTime, event
from sqlalchemy.sql import func
from werkzeug.security import generate_password_hash, check_password_hash
import re
from datetime import datetime
from app.database import Base

# Expressão regular para validação de e-mail
EMAIL_REGEX = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

class User(Base):
    """
    Modelo para armazenar informações dos usuários do sistema.
    
    Atributos:
        id (int): Identificador único do usuário
        name (str): Nome completo do usuário
        email (str): E-mail único do usuário
        password_hash (str): Hash da senha do usuário
        is_active (bool): Indica se o usuário está ativo
        is_admin (bool): Indica se o usuário tem privilégios de administrador
        last_login (datetime): Data e hora do último login
        created_at (datetime): Data e hora de criação do usuário
        updated_at (datetime): Data e hora da última atualização
    """
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, comment='Identificador único do usuário')
    name = Column(String(100), nullable=False, comment='Nome completo do usuário')
    email = Column(String(100), unique=True, nullable=False, index=True, 
                  comment='E-mail único do usuário')
    password_hash = Column(String(200), nullable=False, comment='Hash da senha')
    is_active = Column(Boolean, default=True, comment='Indica se o usuário está ativo')
    is_admin = Column(Boolean, default=False, comment='Indica se é administrador')
    last_login = Column(DateTime, nullable=True, comment='Data do último login')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), 
                       comment='Data de criação do registro')
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(),
                       comment='Data da última atualização')
    
    __table_args__ = (
        {'comment': 'Armazena informações dos usuários do sistema'},
    )
    
    @property
    def password(self):
        """Impede o acesso direto à senha"""
        raise AttributeError('A senha não é um atributo legível')
    
    @password.setter
    def password(self, password):
        """Define o hash da senha"""
        if not password:
            raise ValueError('A senha não pode ser vazia')
        if len(password) < 8:
            raise ValueError('A senha deve ter pelo menos 8 caracteres')
        self.password_hash = generate_password_hash(password)
    
    def verify_password(self, password):
        """
        Verifica se a senha fornecida corresponde ao hash armazenado
        
        Args:
            password (str): Senha a ser verificada
            
        Returns:
            bool: True se a senha estiver correta, False caso contrário
        """
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self, include_sensitive=False):
        """
        Converte o objeto User para um dicionário
        
        Args:
            include_sensitive (bool): Se True, inclui campos sensíveis
            
        Returns:
            dict: Dicionário com os dados do usuário
        """
        result = {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "is_active": self.is_active,
            "is_admin": self.is_admin,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_sensitive:
            result.update({
                # Incluir campos sensíveis se necessário
            })
            
        return result
        
    def __repr__(self):
        return f"<User {self.email}>"


@event.listens_for(User, 'before_insert')
@event.listens_for(User, 'before_update')
def validate_user(mapper, connection, target):
    """Valida os dados do usuário antes de salvar"""
    if not target.name or not target.name.strip():
        raise ValueError("O nome não pode estar vazio")
        
    if not target.email or not re.match(EMAIL_REGEX, target.email):
        raise ValueError("E-mail inválido")
        
    if not target.password_hash and not hasattr(target, '_password_already_hashed'):
        raise ValueError("A senha é obrigatória")
