"""
Rotas para upload de arquivos.

Contém as rotas para upload de planilhas de pontos de coleta e veículos.
"""
import os
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Form
from fastapi.responses import JSONResponse
from typing import List
import tempfile
import shutil

router = APIRouter()

# Diretório temporário para uploads
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Extensões permitidas
ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls"}

def allowed_file(filename: str) -> bool:
    """Verifica se a extensão do arquivo é permitida."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@router.post("/collection-points")
async def upload_collection_points(
    file: UploadFile = File(...),
    markerConfig: str = ""
):
    """
    Faz upload de um arquivo com pontos de coleta.
    
    O arquivo deve ser um CSV ou Excel com as seguintes colunas:
    - ID
    - Endereço
    - Volume (kg ou m³)
    - Janela de Início (HH:MM)
    - Janela de Fim (HH:MM)
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum arquivo enviado"
        )
    
    if not allowed_file(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de arquivo não suportado. Use: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    try:
        # Salva o arquivo temporariamente
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f".{file.filename.rsplit('.', 1)[1].lower()}")
        try:
            shutil.copyfileobj(file.file, temp_file)
            temp_file.close()
            
            # Lê o arquivo com pandas
            if file.filename.endswith('.csv'):
                df = pd.read_csv(temp_file.name)
            else:  # Excel
                df = pd.read_excel(temp_file.name)
            
            # Verifica colunas obrigatórias
            required_columns = ["ID", "Endereço", "Volume", "Janela de Início", "Janela de Fim"]
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Colunas obrigatórias ausentes: {', '.join(missing_columns)}"
                )
            
            # Processa os dados
            points = df.to_dict(orient='records')
            
            # Processa as configurações do marcador, se fornecidas
            marker_config = {}
            if markerConfig:
                try:
                    marker_config = {
                        "type": "collection",
                        "config": markerConfig
                    }
                except Exception as e:
                    print(f"Erro ao processar configurações do marcador: {str(e)}")
            
            return {
                "message": f"Arquivo processado com sucesso. {len(points)} pontos de coleta encontrados.",
                "filename": file.filename,
                "count": len(points),
                "marker_config": marker_config,
                "sample": points[0] if points else None
            }
            
        finally:
            # Remove o arquivo temporário
            os.unlink(temp_file.name)
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao processar o arquivo: {str(e)}"
        )

@router.post("/vehicles")
async def upload_vehicles(
    file: UploadFile = File(...),
    markerConfig: str = ""
):
    """
    Faz upload de um arquivo com informações dos veículos.
    
    O arquivo deve ser um CSV ou Excel com as seguintes colunas:
    - ID Veículo
    - Capacidade Máxima
    - Hora Inicial (HH:MM)
    - Hora Final (HH:MM)
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum arquivo enviado"
        )
    
    if not allowed_file(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de arquivo não suportado. Use: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    try:
        # Salva o arquivo temporariamente
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f".{file.filename.rsplit('.', 1)[1].lower()}")
        try:
            shutil.copyfileobj(file.file, temp_file)
            temp_file.close()
            
            # Lê o arquivo com pandas
            if file.filename.endswith('.csv'):
                df = pd.read_csv(temp_file.name)
            else:  # Excel
                df = pd.read_excel(temp_file.name)
            
            # Verifica colunas obrigatórias
            required_columns = ["ID Veículo", "Capacidade Máxima", "Hora Inicial", "Hora Final"]
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Colunas obrigatórias ausentes: {', '.join(missing_columns)}"
                )
            
            # Processa os dados
            vehicles = df.to_dict(orient='records')
            
            # Processa as configurações do marcador, se fornecidas
            marker_config = {}
            if markerConfig:
                try:
                    marker_config = {
                        "type": "vehicle",
                        "config": markerConfig
                    }
                except Exception as e:
                    print(f"Erro ao processar configurações do marcador: {str(e)}")
            
            return {
                "message": f"Arquivo processado com sucesso. {len(vehicles)} veículos encontrados.",
                "filename": file.filename,
                "count": len(vehicles),
                "marker_config": marker_config,
                "sample": vehicles[0] if vehicles else None
            }
            
        finally:
            # Remove o arquivo temporário
            os.unlink(temp_file.name)
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao processar o arquivo: {str(e)}"
        )
