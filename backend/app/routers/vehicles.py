from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from .. import models, schemas
from ..database import get_db
import logging

# Configurar logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["vehicles"],
    responses={"404": {"description": "Not found"}},
)

@router.get("/", response_model=List[schemas.Vehicle])
def list_vehicles(
    skip: int = 0, 
    limit: int = 100, 
    active_only: bool = None,  # Alterado para None para mostrar todos por padrão
    include: str = None,
    db: Session = Depends(get_db)
):
    """
    Lista todos os veículos
    
    Parâmetros:
    - skip: Número de registros a pular
    - limit: Número máximo de registros a retornar
    - active_only: Se None, retorna todos os veículos. Se True, retorna apenas ativos. Se False, retorna apenas inativos.
    - include: Relacionamentos a serem incluídos (ex: 'cubage_profile')
    """
    logger.debug("Iniciando consulta de veículos")
    
    query = db.query(models.Vehicle)
    
    # Aplica filtro de status se especificado
    if active_only is not None:
        logger.debug(f"Filtrando por active_only={active_only}")
        query = query.filter(models.Vehicle.is_active == active_only)
    
    # Carrega relacionamentos se especificado
    if include:
        logger.debug(f"Incluindo relacionamentos: {include}")
        for relation in include.split(','):
            relation = relation.strip()
            if relation == 'cubage_profile':
                query = options = query.options(joinedload(models.Vehicle.cubage_profile))
                logger.debug("Adicionando joinedload para cubage_profile")
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Relacionamento desconhecido: {relation}"
                )
    
    if active_only:
        query = query.filter(models.Vehicle.is_active == True)
        logger.debug("Filtrando apenas veículos ativos")
        
    # Executa a query e converte os resultados
    vehicles = query.offset(skip).limit(limit).all()
    logger.debug(f"Encontrados {len(vehicles)} veículos")
    
    # Converte os veículos para dicionários incluindo o cubage_profile como dicionário
    result = []
    for vehicle in vehicles:
        logger.debug(f"Processando veículo: {vehicle.name}")
        vehicle_dict = vehicle.to_dict()
        if vehicle.cubage_profile:
            logger.debug(f"Convertendo cubage_profile para veículo {vehicle.name}")
            vehicle_dict["cubage_profile"] = vehicle.cubage_profile.to_dict()
        result.append(vehicle_dict)
    
    return result

from fastapi import Response
from fastapi.responses import JSONResponse

@router.post("/", response_model=schemas.Vehicle, status_code=status.HTTP_201_CREATED)
async def create_vehicle(vehicle: schemas.VehicleCreate, db: Session = Depends(get_db)):
    """Cria um novo veículo"""
    logger.info("Iniciando criação de veículo")
    logger.info(f"Dados recebidos: {vehicle.dict()}")
    
    try:
        # Verifica se já existe um veículo com o mesmo nome
        db_vehicle = db.query(models.Vehicle).filter(
            models.Vehicle.name == vehicle.name
        ).first()
        
        logger.info(f"Verificando se já existe veículo com o nome: {vehicle.name}")
        
        if db_vehicle:
            logger.warning(f"Já existe um veículo com o nome: {vehicle.name}")
            raise HTTPException(
                status_code=400, 
                detail="Já existe um veículo com este nome"
            )
        
        logger.info("Criando novo veículo no banco de dados")
        
        # Cria o novo veículo
        vehicle_data = vehicle.dict()
        logger.info(f"Dados do veículo a serem salvos: {vehicle_data}")
        
        db_vehicle = models.Vehicle(**vehicle_data)
        db.add(db_vehicle)
        db.commit()
        db.refresh(db_vehicle)
        
        logger.info(f"Veículo criado com sucesso. ID: {db_vehicle.id}")
        
        # Busca o veículo recém-criado com o perfil de cubagem
        db_vehicle = db.query(models.Vehicle).options(
            joinedload(models.Vehicle.cubage_profile)
        ).filter(
            models.Vehicle.id == db_vehicle.id
        ).first()
        
        # Converte o veículo para dicionário
        if db_vehicle is None:
            logger.error("Erro ao buscar veículo recém-criado")
            raise HTTPException(
                status_code=500,
                detail="Erro ao recuperar veículo recém-criado"
            )
        
        vehicle_dict = db_vehicle.to_dict()
        if hasattr(db_vehicle, 'cubage_profile') and db_vehicle.cubage_profile:
            vehicle_dict["cubage_profile"] = db_vehicle.cubage_profile.to_dict()
        
        logger.info(f"Dados do veículo com perfil de cubagem: {vehicle_dict}")
        
        # Cria a resposta com os cabeçalhos CORS
        response = JSONResponse(
            content=vehicle_dict,
            status_code=status.HTTP_201_CREATED
        )
        
        # Adiciona os cabeçalhos CORS manualmente
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
        return response
        
    except HTTPException as he:
        # Re-lança exceções HTTP
        raise he
    except Exception as e:
        logger.error(f"Erro ao criar veículo: {str(e)}", exc_info=True)
        db.rollback()
        error_response = JSONResponse(
            status_code=500,
            content={"detail": f"Ocorreu um erro ao criar o veículo: {str(e)}"}
        )
        error_response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
        error_response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
        error_response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        error_response.headers["Access-Control-Allow-Credentials"] = "true"
        return error_response

@router.get("/{vehicle_id}", response_model=schemas.Vehicle)
def get_vehicle(
    vehicle_id: int, 
    include: str = None,
    db: Session = Depends(get_db)
):
    """
    Obtém um veículo pelo ID
    
    Parâmetros:
    - vehicle_id: ID do veículo
    - include: Relacionamentos a serem incluídos (ex: 'cubage_profile')
    """
    query = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id)
    
    # Carrega relacionamentos se especificado
    if include:
        for relation in include.split(','):
            if relation.strip() == 'cubage_profile':
                query = query.options(joinedload(models.Vehicle.cubage_profile))
    
    db_vehicle = query.first()
    
    if db_vehicle is None:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    
    # Converte o veículo para dicionário e adiciona o cubage_profile se existir
    vehicle_dict = db_vehicle.to_dict()
    if hasattr(db_vehicle, 'cubage_profile') and db_vehicle.cubage_profile:
        vehicle_dict["cubage_profile"] = db_vehicle.cubage_profile.to_dict()
    
    return vehicle_dict

@router.put("/{vehicle_id}", response_model=schemas.Vehicle)
def update_vehicle(
    vehicle_id: int, 
    vehicle: schemas.VehicleUpdate, 
    db: Session = Depends(get_db)
):
    """Atualiza um veículo existente"""
    try:
        logger.info(f"Iniciando atualização do veículo ID: {vehicle_id}")
        logger.info(f"Dados recebidos: {vehicle.dict()}")
        
        # Busca o veículo existente
        db_vehicle = db.query(models.Vehicle).filter(
            models.Vehicle.id == vehicle_id
        ).first()
        
        if db_vehicle is None:
            logger.warning(f"Veículo com ID {vehicle_id} não encontrado")
            raise HTTPException(status_code=404, detail="Veículo não encontrado")
        
        # Verifica se o novo nome já está em uso por outro veículo
        if vehicle.name and vehicle.name != db_vehicle.name:
            logger.info(f"Verificando se o nome '{vehicle.name}' já está em uso")
            existing_vehicle = db.query(models.Vehicle).filter(
                models.Vehicle.name == vehicle.name,
                models.Vehicle.id != vehicle_id
            ).first()
            if existing_vehicle:
                logger.warning(f"Já existe um veículo com o nome: {vehicle.name}")
                raise HTTPException(
                    status_code=400, 
                    detail="Já existe um veículo com este nome"
                )
        
        # Atualiza os campos fornecidos
        update_data = vehicle.dict(exclude_unset=True)
        logger.info(f"Campos a serem atualizados: {update_data}")
        
        # Atualiza os atributos do veículo
        for key, value in update_data.items():
            setattr(db_vehicle, key, value)
        
        # Atualiza a data de atualização
        db_vehicle.updated_at = datetime.utcnow()
        
        # Salva as alterações no banco de dados
        db.commit()
        db.refresh(db_vehicle)
        
        logger.info(f"Veículo ID {vehicle_id} atualizado com sucesso")
        
        # Retorna o veículo atualizado
        vehicle_dict = db_vehicle.to_dict()
        if hasattr(db_vehicle, 'cubage_profile') and db_vehicle.cubage_profile:
            vehicle_dict["cubage_profile"] = db_vehicle.cubage_profile.to_dict()
            
        return vehicle_dict
        
    except HTTPException as he:
        # Re-lança exceções HTTP
        raise he
    except Exception as e:
        # Loga o erro e retorna 500
        logger.error(f"Erro ao atualizar veículo ID {vehicle_id}: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Ocorreu um erro ao atualizar o veículo: {str(e)}"
        )
        error_response.headers["Access-Control-Allow-Origin"] = "*"
        error_response.headers["Access-Control-Allow-Methods"] = "PUT, OPTIONS"
        error_response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        error_response.headers["Access-Control-Allow-Credentials"] = "true"
        return error_response

@router.delete("/{vehicle_id}", status_code=status.HTTP_200_OK, response_model=dict)
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    """
    Remove permanentemente um veículo do banco de dados
    
    Retorna um objeto JSON com a confirmação da operação
    """
    try:
        logger.info(f"Iniciando exclusão permanente do veículo ID: {vehicle_id}")
        
        # Busca o veículo existente
        db_vehicle = db.query(models.Vehicle).filter(
            models.Vehicle.id == vehicle_id
        ).first()
        
        if db_vehicle is None:
            logger.warning(f"Veículo com ID {vehicle_id} não encontrado")
            raise HTTPException(status_code=404, detail="Veículo não encontrado")
        
        # Remove o veículo do banco de dados
        logger.info(f"Removendo permanentemente o veículo ID: {vehicle_id}")
        db.delete(db_vehicle)
        db.commit()
        
        logger.info(f"Veículo ID {vehicle_id} removido permanentemente com sucesso")
        return {
            "success": True,
            "message": "Veículo removido permanentemente com sucesso",
            "vehicle_id": vehicle_id
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Erro ao remover veículo ID {vehicle_id}: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Ocorreu um erro ao remover o veículo: {str(e)}"
        )
