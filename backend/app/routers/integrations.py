from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

from ..config import settings

try:
    import googlemaps
    GOOGLE_MAPS_AVAILABLE = True
except ImportError:
    GOOGLE_MAPS_AVAILABLE = False

router = APIRouter(
    prefix="/integrations",
    tags=["integrations"],
)

logger = logging.getLogger(__name__)

class TestResponse(BaseModel):
    message: str

@router.post("/test-email", response_model=TestResponse)
async def test_email_connection():
    """Testa a conexão com o servidor de email usando as configurações do sistema."""
    if not all([settings.EMAIL_HOST, settings.EMAIL_PORT, settings.EMAIL_USER, settings.EMAIL_PASSWORD, settings.EMAIL_FROM]):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="As configurações de email não estão totalmente definidas no sistema."
        )

    msg = MIMEMultipart()
    msg['From'] = settings.EMAIL_FROM
    msg['To'] = settings.EMAIL_FROM
    msg['Subject'] = f"Teste de Conexão - {settings.APP_NAME}"
    msg.attach(MIMEText("Este é um email de teste para verificar a conexão SMTP.", 'plain'))

    try:
        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.send_message(msg)
        return {"message": "Conexão com o servidor de email bem-sucedida!"}
    except smtplib.SMTPException as e:
        logger.error(f"Erro SMTP ao testar conexão: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Falha na conexão SMTP: {e}")
    except Exception as e:
        logger.error(f"Erro inesperado ao testar email: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ocorreu um erro inesperado.")

@router.post("/test-google-maps", response_model=TestResponse)
async def test_google_maps_api():
    """Testa a chave da API do Google Maps configurada no sistema."""
    if not GOOGLE_MAPS_AVAILABLE:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="A biblioteca 'googlemaps' não está instalada.")
    
    if not settings.GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A chave da API do Google Maps não está configurada.")

    try:
        gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
        gmaps.geocode('São Paulo, SP', region='br')
        return {"message": "Chave da API do Google Maps é válida!"}
    except Exception as e:
        logger.error(f"Erro ao validar a chave da API do Google Maps: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"A chave da API é inválida ou ocorreu um erro: {e}")
