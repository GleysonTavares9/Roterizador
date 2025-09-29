from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from werkzeug.security import generate_password_hash, check_password_hash
from jose import JWTError, jwt
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, User as UserSchema, Token, TokenData

# Configurações
SECRET_KEY = "sua_chave_secreta_aqui"  # Em produção, use uma chave secreta segura e armazene em variáveis de ambiente
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 dias
REFRESH_TOKEN_EXPIRE_DAYS = 30  # 30 dias

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")
router = APIRouter()

# Usando a classe TokenData do esquema de usuário
from app.schemas.user import TokenData

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return check_password_hash(hashed_password, plain_password)

def get_password_hash(password: str) -> str:
    return generate_password_hash(password)

def create_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return create_token(to_encode, expires_delta)

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expires_delta = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return create_token(to_encode, expires_delta)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    """
    Cria um novo usuário.
    """
    try:
        print(f"Recebida solicitação de registro para o email: {user.email}")
        
        # Verifica se o email já está em uso
        db_user = db.query(User).filter(User.email == user.email).first()
        if db_user:
            print(f"Email {user.email} já está em uso")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Email já registrado"}
            )
        
        print(f"Criando novo usuário: {user.email}")
        
        # Cria o novo usuário
        db_user = User(
            email=user.email,
            name=user.name,
            is_active=user.is_active,
            is_admin=user.is_admin if hasattr(user, 'is_admin') else False
        )
        
        # Define a senha (o setter fará o hash automaticamente)
        db_user.password = user.password
        
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        print(f"Usuário {db_user.id} criado com sucesso")
        
        return db_user
        
    except HTTPException as he:
        print(f"Erro HTTP durante o registro: {he.detail}")
        raise he
    except Exception as e:
        print(f"Erro inesperado durante o registro: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Erro interno ao processar o registro"}
        )

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Gera um token de acesso para o usuário autenticado.
    """
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verifica se o usuário está ativo
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário inativo"
        )
    
    # Atualiza o último login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Cria o token de acesso e o refresh token
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "is_admin": user.is_admin}
    )
    refresh_token = create_refresh_token(
        data={"sub": user.email, "user_id": user.id, "is_admin": user.is_admin}
    )
    
    return {
        "access_token": access_token, 
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_token: str = Header(...), db: Session = Depends(get_db)):
    """
    Atualiza o token de acesso usando o refresh token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        
        # Verifica se o usuário ainda existe e está ativo
        user = db.query(User).filter(User.email == email).first()
        if user is None or not user.is_active:
            raise credentials_exception
            
        # Gera um novo access token
        access_token = create_access_token(
            data={"sub": user.email, "user_id": user.id, "is_admin": user.is_admin}
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
        
    except JWTError:
        raise credentials_exception


