"""
Script para adicionar um usuário ao banco de dados.
"""
import sys
import os
from datetime import datetime

# Adiciona o diretório atual ao PATH
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from werkzeug.security import generate_password_hash
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, SQLALCHEMY_DATABASE_URL
from app.models.user import User

# Cria a engine e a sessão
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def add_user(name, email, password, is_admin=False):
    db = SessionLocal()
    try:
        # Verifica se o usuário já existe
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"Usuário com email {email} já existe.")
            return
        
        # Cria o novo usuário
        user = User(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            is_admin=is_admin,
            is_active=True,
            created_at=datetime.utcnow()
        )
        
        db.add(user)
        db.commit()
        print(f"Usuário {name} criado com sucesso!")
        
    except Exception as e:
        db.rollback()
        print(f"Erro ao criar usuário: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # Adiciona um usuário administrador padrão
    add_user(
        name="Administrador",
        email="admin@example.com",
        password="admin123",
        is_admin=True
    )
