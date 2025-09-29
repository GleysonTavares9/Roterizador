"""
Módulo de rotas para geração de relatórios.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
import pandas as pd
import io
import json
from typing import Optional

from ..database import get_db
from .. import models

router = APIRouter(
    tags=["reports"],
    responses={404: {"description": "Not found"}},
)

def get_route_report_data(db: Session, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Obtém dados para o relatório de rotas."""
    query = db.query(
        models.Route
    )
    
    # Aplicar filtros de data se fornecidos
    if start_date:
        query = query.filter(models.Route.created_at >= start_date)
    if end_date:
        query = query.filter(models.Route.created_at <= end_date)
    
    routes = query.all()
    
    # Converter para dicionário
    routes_data = []
    for route in routes:
        route_dict = {
            "id": route.id,
            "name": route.name,
            "vehicle_id": route.vehicle_id,
            "distance_km": route.distance,
            "duration_min": route.duration,
            "created_at": route.created_at.isoformat() if route.created_at else None,
            "status": route.status,
            "is_active": route.is_active
        }
        routes_data.append(route_dict)
    
    return routes_data

def get_vehicle_performance_data(db: Session, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Obtém dados para o relatório de desempenho de veículos."""
    # Consulta para obter estatísticas de rotas por veículo
    query = db.query(
        models.Vehicle,
        models.Route
    ).outerjoin(
        models.Route, models.Vehicle.id == models.Route.vehicle_id
    )
    
    # Aplicar filtros de data se fornecidos
    if start_date or end_date:
        if start_date:
            query = query.filter(models.Route.created_at >= start_date)
        if end_date:
            query = query.filter(models.Route.created_at <= end_date)
    
    results = query.all()
    
    # Processar resultados
    vehicles_data = {}
    for vehicle, route in results:
        if vehicle.id not in vehicles_data:
            vehicles_data[vehicle.id] = {
                "id": vehicle.id,
                "name": vehicle.name,
                "total_distance_km": 0,
                "total_duration_min": 0,
                "route_count": 0,
                "status": vehicle.status
            }
        
        if route:  # Se o veículo tem rotas associadas
            vehicles_data[vehicle.id]["total_distance_km"] += (route.distance or 0)
            vehicles_data[vehicle.id]["total_duration_min"] += (route.duration or 0)
            vehicles_data[vehicle.id]["route_count"] += 1
    
    return list(vehicles_data.values())

def get_collection_history_data(db: Session, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Obtém dados para o histórico de coletas."""
    # Esta é uma implementação básica - você pode ajustar conforme necessário
    query = db.query(
        models.CollectionPoint
    )
    
    # Aplicar filtros de data se fornecidos
    if start_date:
        query = query.filter(models.CollectionPoint.created_at >= start_date)
    if end_date:
        query = query.filter(models.CollectionPoint.created_at <= end_date)
    
    collection_points = query.all()
    
    # Converter para dicionário
    collection_data = []
    for point in collection_points:
        point_dict = {
            "id": point.id,
            "name": point.name,
            "address": point.address,
            "latitude": point.latitude,
            "longitude": point.longitude,
            "created_at": point.created_at.isoformat() if point.created_at else None,
            "status": point.status,
            "is_active": point.is_active
        }
        collection_data.append(point_dict)
    
    return collection_data

@router.get("/routes")
async def generate_route_report(
    format: str = "json",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Gera relatório de rotas."""
    try:
        data = get_route_report_data(db, start_date, end_date)
        
        if format == "json":
            return JSONResponse(content={"data": data})
            
        df = pd.DataFrame(data)
        
        if format == "csv":
            output = io.StringIO()
            df.to_csv(output, index=False)
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment;filename=relatorio_rotas_{datetime.now().date()}.csv"}
            )
            
        elif format == "excel":
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Rotas')
            output.seek(0)
            return StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment;filename=relatorio_rotas_{datetime.now().date()}.xlsx"}
            )
            
        else:
            raise HTTPException(status_code=400, detail="Formato inválido. Use 'json', 'csv' ou 'excel'.")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar relatório: {str(e)}")

@router.get("/vehicles/performance")
async def generate_vehicle_performance_report(
    format: str = "json",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Gera relatório de desempenho de veículos."""
    try:
        data = get_vehicle_performance_data(db, start_date, end_date)
        
        if format == "json":
            return JSONResponse(content={"data": data})
            
        df = pd.DataFrame(data)
        
        if format == "csv":
            output = io.StringIO()
            df.to_csv(output, index=False)
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment;filename=desempenho_veiculos_{datetime.now().date()}.csv"}
            )
            
        elif format == "excel":
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Desempenho Veículos')
            output.seek(0)
            return StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment;filename=desempenho_veiculos_{datetime.now().date()}.xlsx"}
            )
            
        else:
            raise HTTPException(status_code=400, detail="Formato inválido. Use 'json', 'csv' ou 'excel'.")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar relatório: {str(e)}")

@router.get("/collection-history")
async def generate_collection_history_report(
    format: str = "json",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Gera relatório de histórico de coletas."""
    try:
        data = get_collection_history_data(db, start_date, end_date)
        
        if format == "json":
            return JSONResponse(content={"data": data})
            
        df = pd.DataFrame(data)
        
        if format == "csv":
            output = io.StringIO()
            df.to_csv(output, index=False)
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment;filename=historico_coletas_{datetime.now().date()}.csv"}
            )
            
        elif format == "excel":
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Histórico Coletas')
            output.seek(0)
            return StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment;filename=historico_coletas_{datetime.now().date()}.xlsx"}
            )
            
        else:
            raise HTTPException(status_code=400, detail="Formato inválido. Use 'json', 'csv' ou 'excel'.")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar relatório: {str(e)}")
