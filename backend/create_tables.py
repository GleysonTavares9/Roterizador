"""
Script para criar as tabelas do banco de dados.
"""
import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Adiciona o diretório atual ao PATH
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Importa os modelos para garantir que todas as tabelas sejam criadas
from app.database import Base, engine
from app.models.user import User

# Cria todas as tabelas
def create_tables():
    print("Criando tabelas...")
    try:
        Base.metadata.create_all(bind=engine)
        print("Tabelas criadas com sucesso!")
    except Exception as e:
        print(f"Erro ao criar tabelas: {e}")
        raise

if __name__ == "__main__":
    create_tables()
