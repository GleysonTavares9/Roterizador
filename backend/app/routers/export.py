import io
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import pandas as pd
from sqlalchemy.orm import Session
from datetime import datetime

from ..database import get_db
from .. import models

router = APIRouter(
    prefix="/export",
    tags=["export"],
)

EXPORT_MAPPING = {
    "vehicles": models.Vehicle,
    "collection-points": models.CollectionPoint,
    "routes": models.Route,
    "cubage-profiles": models.CubageProfile,
    "users": models.User,
}

def get_data_as_dataframe(db: Session, resource_type: str) -> pd.DataFrame:
    """Busca dados de um recurso e os retorna como um DataFrame pandas."""
    if resource_type not in EXPORT_MAPPING:
        raise ValueError(f"Tipo de recurso inválido: {resource_type}")
    
    model = EXPORT_MAPPING[resource_type]
    query = db.query(model)
    return pd.read_sql(query.statement, db.bind)

@router.get("/{resource_type}")
async def export_data(
    resource_type: str,
    format: str = "excel",
    db: Session = Depends(get_db)
):
    """
    Exporta dados de um recurso específico ou todos de uma vez.
    Formatos suportados: 'excel', 'csv'.
    """
    if format not in ["excel", "csv"]:
        raise HTTPException(status_code=400, detail="Formato inválido. Use 'excel' ou 'csv'.")

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output = io.BytesIO()

    try:
        if resource_type == "all":
            if format != "excel":
                raise HTTPException(status_code=400, detail="A exportação 'all' suporta apenas o formato 'excel'.")

            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                for name in EXPORT_MAPPING.keys():
                    df = get_data_as_dataframe(db, name)
                    df.to_excel(writer, sheet_name=name.capitalize(), index=False)
            
            filename = f"export_all_{timestamp}.xlsx"
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        elif resource_type in EXPORT_MAPPING:
            df = get_data_as_dataframe(db, resource_type)
            if format == "csv":
                df.to_csv(output, index=False, encoding='utf-8-sig')
                filename = f"export_{resource_type}_{timestamp}.csv"
                media_type = "text/csv"
            else:  # excel
                df.to_excel(output, index=False)
                filename = f"export_{resource_type}_{timestamp}.xlsx"
                media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        else:
            raise HTTPException(status_code=404, detail=f"Tipo de exportação inválido: {resource_type}")

        output.seek(0)
        return StreamingResponse(
            output, 
            media_type=media_type, 
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao exportar dados: {e}")
