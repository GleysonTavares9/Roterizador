"""
Módulo de rotas para exportação de dados.
"""
import io
from fastapi import APIRouter, HTTPException, Response, Depends
from fastapi.responses import StreamingResponse
import pandas as pd
from sqlalchemy.orm import Session
from datetime import datetime

from ..database import get_db
from .. import models

router = APIRouter(
    tags=["export"],
    responses={404: {"description": "Not found"}},
)

# Mapeamento de tipos de exportação para modelos e consultas
EXPORT_MAPPING = {
    "vehicles": {
        "model": models.Vehicle,
        "query": None,  # Usará query padrão
    },
    "collection-points": {
        "model": models.CollectionPoint,
        "query": None,
    },
    "routes": {
        "model": models.Route,
        "query": None,
    },
    "cubage-profiles": {
        "model": models.CubageProfile,
        "query": None,
    },
    "users": {
        "model": models.User,
        "query": None,
    },
    "all": {
        "model": None,
        "query": None,
    }
}

def dataframe_to_io(df, format_type="excel"):
    """Converte um DataFrame para o formato solicitado em um buffer de memória."""
    output = io.BytesIO()
    
    if format_type == "csv":
        df.to_csv(output, index=False, encoding='utf-8-sig')
        media_type = "text/csv"
        file_extension = "csv"
    elif format_type == "pdf":
        # Para PDF, usamos o Excel como fallback, já que pandas não suporta PDF diretamente
        df.to_excel(output, index=False)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        file_extension = "xlsx"
    else:  # excel
        df.to_excel(output, index=False)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        file_extension = "xlsx"
    
    output.seek(0)
    return output, media_type, file_extension

def get_export_data(export_type: str, db: Session):
    """Obtém os dados para exportação com base no tipo."""
    if export_type not in EXPORT_MAPPING:
        raise ValueError(f"Tipo de exportação inválido: {export_type}")
    
    config = EXPORT_MAPPING[export_type]
    
    if export_type == "all":
        # Para 'all', exportamos todos os dados de todas as tabelas
        all_data = {}
        for key, cfg in EXPORT_MAPPING.items():
            if key != "all" and cfg["model"] is not None:
                query = db.query(cfg["model"])
                if cfg["query"] is not None:
                    query = cfg["query"](query)
                df = pd.read_sql(query.statement, query.session.bind)
                all_data[key] = df
        return all_data
    else:
        # Para um tipo específico
        query = db.query(config["model"])
        if config["query"] is not None:
            query = config["query"](query)
        return {export_type: pd.read_sql(query.statement, query.session.bind)}

@router.get("/{export_type}")
async def export_data(
    export_type: str,
    format: str = "excel",
    db: Session = Depends(get_db)
):
    """
    Exporta dados no formato especificado.
    
    Args:
        export_type: Tipo de dados para exportar (vehicles, collection-points, etc.)
        format: Formato de saída (excel, csv, pdf)
    """
    if export_type not in EXPORT_MAPPING:
        raise HTTPException(status_code=400, detail=f"Tipo de exportação inválido: {export_type}")
    
    if format not in ["excel", "csv", "pdf"]:
        raise HTTPException(status_code=400, detail="Formato inválido. Use 'excel', 'csv' ou 'pdf'.")
    
    try:
        data = get_export_data(export_type, db)
        
        if export_type == "all":
            # Para múltiplas planilhas, usamos Excel mesmo se o formato for PDF
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                for sheet_name, df in data.items():
                    df.to_excel(writer, sheet_name=sheet_name[:31], index=False)
            output.seek(0)
            
            filename = f"export_all_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        else:
            # Para uma única planilha
            df = data[export_type]
            output, media_type, file_extension = dataframe_to_io(df, format)
            
            filename = f"export_{export_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{file_extension}"
            return Response(
                content=output.getvalue(),
                media_type=media_type,
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao exportar dados: {str(e)}")
