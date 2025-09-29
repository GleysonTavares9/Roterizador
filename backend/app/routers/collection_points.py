from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, true as true_, false as false_
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from .. import models, schemas
from ..database import get_db
import logging
import calendar

# Configuração de logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/collection-points",
    tags=["collection-points"],
    responses={404: {"description": "Not found"}},
)

@router.get("", response_model=List[schemas.CollectionPoint], tags=["collection_points"])
async def list_collection_points(
    skip: int = 0, 
    limit: int = 100, 
    active_only: bool = True,
    city: Optional[str] = None,
    state: Optional[str] = None,
    date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    Lista todos os pontos de coleta com opções de filtro.
    
    Parâmetros:
    - date: Filtra pontos ativos para a data específica, considerando dias da semana e semanas do mês
    """
    try:
        logger.info("\n=== INÍCIO DA REQUISIÇÃO ===")
        logger.info(f"Parâmetros recebidos: skip={skip}, limit={limit}, active_only={active_only}, city={city}, state={state}, date={date}")
        
        query = db.query(models.CollectionPoint)
        
        if active_only:
            query = query.filter(models.CollectionPoint.is_active == True)
        
        if city:
            query = query.filter(models.CollectionPoint.city.ilike(f"%{city}%"))
        
        if state:
            query = query.filter(models.CollectionPoint.state == state.upper())
        
        # Inicializa as variáveis de data
        day_of_week = None
        week_of_month = None
        
        # Filtro por data
        if date:
            logger.info(f"\n=== FILTRO DE DATA ===")
            logger.info(f"Data selecionada: {date} (YYYY-MM-DD)")
            
            # Obtém o dia da semana (1=segunda, 7=domingo)
            day_of_week = date.isoweekday()
            
            # Obtém o dia do mês para calcular a semana do mês (1-5)
            day_of_month = date.day
            week_of_month = (day_of_month - 1) // 7 + 1
            
            logger.info(f"Dia da semana: {day_of_week} (1=segunda, 7=domingo)")
            logger.info(f"Dia do mês: {day_of_month}")
            logger.info(f"Semana do mês: {week_of_month} (1-5)")
            logger.info(f"Semana do ano: {date.isocalendar()[1]}")
            logger.info(f"Ano: {date.year}")
            logger.info(f"Mês: {date.month}")
            logger.info(f"Dia: {date.day}")
            logger.info("=== FIM FILTRO DE DATA ===\n")
        
        # Função auxiliar para verificar se um valor está em uma string separada por vírgulas
        def is_value_in_csv(csv_string, value):
            if not csv_string:
                return True
            return str(value) in [x.strip() for x in csv_string.split(',')]
        
        # Função para verificar se um valor está em uma lista CSV
        def csv_contains(csv_string, value):
            if not csv_string or csv_string.strip() == "":
                return False  # Retorna False se não houver valor para comparar
                
            # Converte o valor para string e remove espaços
            value_str = str(value).strip()
            if not value_str:
                return False
                
            # Divide a string CSV em valores individuais e remove espaços
            values = [v.strip() for v in csv_string.split(',')]
            
            # Verifica se o valor está na lista
            return value_str in values

        # Função para verificar se um valor está em uma lista CSV
        def build_csv_condition(column, value):
            try:
                logger.info(f"\n=== BUILD_CSV_CONDITION ===")
                logger.info(f"Coluna: {column.key if hasattr(column, 'key') else column}")
                logger.info(f"Valor recebido: {value} (tipo: {type(value)})")
                
                # Se o valor for None ou vazio, retorna sempre verdadeiro
                if value is None or (isinstance(value, str) and not value.strip()):
                    logger.info("Valor é None ou vazio, retornando condição sempre verdadeira")
                    return true_()
                
                # Converte o valor para string e remove espaços em branco
                value_str = str(value).strip()
                if not value_str:
                    return true_()
                
                # Lista para armazenar todas as condições
                conditions = []
                
                # Adiciona condições para verificar o valor em diferentes posições na string CSV
                # Usando func.trim para remover espaços em branco extras
                conditions.extend([
                    # Verifica se o valor é igual a toda a string (quando há apenas um valor)
                    func.trim(column) == value_str,
                    
                    # Verifica se o valor está no início da string CSV
                    func.trim(column).startswith(f"{value_str},"),
                    
                    # Verifica se o valor está no final da string CSV
                    func.trim(column).endswith(f",{value_str}"),
                    
                    # Verifica se o valor está no meio da string CSV
                    func.trim(column).contains(f",{value_str},"),
                    
                    # Verifica se a coluna é exatamente igual ao valor (sem trim)
                    column == value_str,
                    
                    # Verifica se a coluna começa com o valor (sem trim)
                    column.startswith(f"{value_str},"),
                    
                    # Verifica se a coluna termina com o valor (sem trim)
                    column.endswith(f",{value_str}"),
                    
                    # Verifica se a coluna contém o valor (sem trim)
                    column.contains(f",{value_str},")
                ])
                
                # Remove condições duplicadas
                unique_conditions = []
                seen = set()
                for cond in conditions:
                    cond_str = str(cond)
                    if cond_str not in seen:
                        seen.add(cond_str)
                        unique_conditions.append(cond)
                
                logger.info(f"Total de condições geradas: {len(unique_conditions)}")
                
                # Cria a condição OR final
                if not unique_conditions:
                    return true_()
                    
                # Usa or_ apenas se houver mais de uma condição
                if len(unique_conditions) == 1:
                    result = unique_conditions[0]
                else:
                    result = or_(*unique_conditions)
                
                # Log da condição gerada (apenas para depuração)
                try:
                    compiled = result.compile(compile_kwargs={'literal_binds': True})
                    logger.info(f"Condição SQL gerada: {str(compiled)}")
                except Exception as e:
                    logger.error(f"Erro ao compilar condição: {str(e)}")
                    return true_()
                
                logger.info("=== FIM BUILD_CSV_CONDITION ===\n")
                return result
                
            except Exception as e:
                logger.error(f"ERRO em build_csv_condition: {str(e)}")
                logger.error(f"Tipo do erro: {type(e).__name__}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                # Retorna uma condição sempre verdadeira em caso de erro
                return true_()
            
        # Função auxiliar para logar a consulta SQL
        def log_query(query):
            try:
                logger.info("=== CONSULTA SQL GERADA ===")
                logger.info(str(query.statement.compile(compile_kwargs={'literal_binds': True})))
                logger.info("=== FIM CONSULTA SQL ===")
            except Exception as e:
                logger.error(f"Erro ao logar consulta SQL: {str(e)}")
        
        # Função para verificar semanas quinzenais - versão simplificada e segura
        def check_biweekly_weeks(column, week_num):
            try:
                logger.info(f"\n=== CHECK_BIWEEKLY_WEEKS ===")
                logger.info(f"Coluna: {column.key if hasattr(column, 'key') else column}")
                logger.info(f"Semana recebida: {week_num} (tipo: {type(week_num)})")
                
                if week_num is None or not isinstance(week_num, int) or week_num not in [1, 2, 3, 4]:
                    logger.warning(f"Número de semana inválido: {week_num}. Deve ser 1, 2, 3 ou 4.")
                    return false_()  # Retorna uma condição sempre falsa
                
                # Condições base
                base_conditions = [
                    column.is_(None),
                    column == ""
                ]
                
                logger.info(f"Condições base: {len(base_conditions)} condições")
                
                # Verifica se é semana ímpar (1,3) ou par (2,4)
                if week_num in [1, 3]:
                    logger.info(f"Semana {week_num}: Verificando semanas 1 e 3")
                    week_conditions = [
                        func.trim(column) == '1',
                        func.trim(column).like('1,%'),
                        func.trim(column).like('%,1'),
                        func.trim(column).like('%,1,%'),
                        func.trim(column) == '3',
                        func.trim(column).like('3,%'),
                        func.trim(column).like('%,3'),
                        func.trim(column).like('%,3,%')
                    ]
                else:  # Semanas 2 e 4
                    logger.info(f"Semana {week_num}: Verificando semanas 2 e 4")
                    week_conditions = [
                        func.trim(column) == '2',
                        func.trim(column).like('2,%'),
                        func.trim(column).like('%,2'),
                        func.trim(column).like('%,2,%'),
                        func.trim(column) == '4',
                        func.trim(column).like('4,%'),
                        func.trim(column).like('%,4'),
                        func.trim(column).like('%,4,%')
                    ]
                
                # Remove condições duplicadas
                all_conditions = []
                seen = set()
                
                # Adiciona condições base
                for cond in base_conditions:
                    cond_str = str(cond)
                    if cond_str not in seen:
                        seen.add(cond_str)
                        all_conditions.append(cond)
                
                # Adiciona condições de semana
                for cond in week_conditions:
                    cond_str = str(cond)
                    if cond_str not in seen:
                        seen.add(cond_str)
                        all_conditions.append(cond)
                
                logger.info(f"Total de condições geradas: {len(all_conditions)}")
                
                # Cria a condição OR final
                if not all_conditions:
                    return false_()
                    
                # Usa or_ apenas se houver mais de uma condição
                if len(all_conditions) == 1:
                    result = all_conditions[0]
                else:
                    result = or_(*all_conditions)
                
                # Log da condição gerada (apenas para depuração)
                try:
                    compiled = result.compile(compile_kwargs={'literal_binds': True})
                    logger.info(f"Condição SQL gerada: {str(compiled)[:200]}...")
                except Exception as e:
                    logger.error(f"Erro ao compilar condição: {str(e)}")
                
                logger.info("=== FIM CHECK_BIWEEKLY_WEEKS ===\n")
                return result
                
            except Exception as e:
                logger.error(f"ERRO em check_biweekly_weeks: {str(e)}")
                logger.error(f"Tipo do erro: {type(e).__name__}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                return false_()  # Retorna uma condição sempre falsa
        
        # Para frequência SEMANAL (verifica apenas o dia da semana)
        weekly_condition = and_(
            func.upper(func.trim(models.CollectionPoint.frequency)) == 'SEMANAL',
            build_csv_condition(models.CollectionPoint.days_of_week, day_of_week)
        )
        
        # Para frequência QUINZENAL (verifica dia da semana e semana do mês)
        biweekly_condition = and_(
            func.upper(func.trim(models.CollectionPoint.frequency)) == 'QUINZENAL',
            build_csv_condition(models.CollectionPoint.days_of_week, day_of_week),
            check_biweekly_weeks(models.CollectionPoint.weeks_of_month, week_of_month)
        )
        
        # Para frequência MENSAL (verifica dia da semana e semana do mês)
        monthly_condition = and_(
            func.upper(func.trim(models.CollectionPoint.frequency)) == 'MENSAL',
            build_csv_condition(models.CollectionPoint.days_of_week, day_of_week),
            build_csv_condition(models.CollectionPoint.weeks_of_month, week_of_month)
        )
        
        # Aplica as condições de frequência apenas se uma data foi fornecida
        if date is not None:
            try:
                logger.info(f"Iniciando filtro - dia: {day_of_week}, semana: {week_of_month}")
                
                # Lista para armazenar todas as condições
                all_conditions = []
                
                # 1. Pontos diários (sem frequência definida ou frequência diária)
                daily_cond = or_(
                    models.CollectionPoint.frequency.is_(None),
                    models.CollectionPoint.frequency == "",
                    func.upper(func.trim(models.CollectionPoint.frequency)).in_(['DIARIO', 'DIÁRIO', 'DIÁRIA'])
                )
                all_conditions.append(daily_cond)
                logger.info("Condição diária adicionada")
                
                # 2. Pontos semanais
                weekly_cond = and_(
                    func.upper(func.trim(models.CollectionPoint.frequency)) == 'SEMANAL',
                    build_csv_condition(models.CollectionPoint.days_of_week, day_of_week)
                )
                all_conditions.append(weekly_cond)
                logger.info("Condição semanal adicionada")
                
                # 3. Pontos quinzenais
                biweekly_cond = and_(
                    func.upper(func.trim(models.CollectionPoint.frequency)) == 'QUINZENAL',
                    build_csv_condition(models.CollectionPoint.days_of_week, day_of_week),
                    check_biweekly_weeks(models.CollectionPoint.weeks_of_month, week_of_month)
                )
                all_conditions.append(biweekly_cond)
                logger.info("Condição quinzenal adicionada")
                
                # 4. Pontos mensais
                monthly_cond = and_(
                    func.upper(func.trim(models.CollectionPoint.frequency)) == 'MENSAL',
                    build_csv_condition(models.CollectionPoint.days_of_week, day_of_week),
                    build_csv_condition(models.CollectionPoint.weeks_of_month, week_of_month)
                )
                all_conditions.append(monthly_cond)
                logger.info("Condição mensal adicionada")
                
                # Remove condições None da lista
                valid_conditions = [cond for cond in all_conditions if cond is not None]
                
                if valid_conditions:
                    # Combina todas as condições com OR
                    final_condition = or_(*valid_conditions)
                    
                    # Aplica a condição à consulta
                    query = query.filter(final_condition)
                    logger.info("Filtro de data aplicado com sucesso")
                else:
                    logger.info("Nenhuma condição de data para aplicar")
                
            except Exception as e:
                logger.error(f"Erro ao construir condições de filtro: {str(e)}")
                logger.exception("Detalhes do erro:")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Erro ao filtrar pontos de coleta: {str(e)}"
                )
        else:
            logger.info("Nenhuma data fornecida - retornando todos os pontos ativos")
        
        # Log detalhado das condições
        logger.info("\n=== RESUMO DAS CONDIÇÕES ===")
        logger.info(f"Data: {date}")
        
        # Inicializa as variáveis para evitar erros de referência
        day_of_week_str = date.strftime('%A') if date else 'N/A'
        week_of_month_str = str(week_of_month) if 'week_of_month' in locals() and week_of_month is not None else 'N/A'
        
        logger.info(f"Dia da semana: {day_week if 'day_week' in locals() else 'N/A'} ({day_of_week_str})")
        logger.info(f"Semana do mês: {week_of_month_str}")
        
        if 'all_conditions' in locals():
            logger.info(f"Total de condições: {len(all_conditions)}")
            # Log detalhado de cada condição
            for i, cond in enumerate(all_conditions, 1):
                try:
                    compiled = cond.compile(compile_kwargs={'literal_binds': True})
                    logger.info(f"Condição {i}: {str(compiled)}")
                except Exception as e:
                    logger.error(f"Erro ao compilar condição {i}: {str(e)}")
                    logger.info(f"Condição {i}: [Não foi possível exibir a condição]")
        else:
            logger.info("Nenhuma condição de filtro aplicada")
        
        logger.info("=== FIM RESUMO DAS CONDIÇÕES ===\n")
        
        # Log da consulta SQL gerada
        log_query(query)
        
        # Log detalhado da consulta SQL final
        logger.info("\n=== CONSULTA SQL FINAL ===")
        logger.info(f"Semana do mês: {week_of_month_str}")
        
        # Conta o total de pontos na base
        total_pontos = db.query(models.CollectionPoint).count()
        logger.info(f"Total de pontos na base: {total_pontos}")
        
        # Log dos pontos específicos que estão sendo filtrados incorretamente
        logger.info("\n=== PONTOS ESPECÍFICOS ===")
        
        try:
            # Log da consulta SQL completa
            logger.info("\n=== CONSULTA SQL GERADA ===")
            sql = str(query.statement.compile(compile_kwargs={"literal_binds": True}))
            logger.info(sql[:1000])  # Limita o tamanho do log
            if len(sql) > 1000:
                logger.info("... [consulta muito longa, truncada]")
            logger.info("=== FIM CONSULTA SQL ===\n")
        except Exception as e:
            logger.error(f"Erro ao gerar log da consulta SQL: {str(e)}")
        
        # AMPHORA LTDA (MATRIZ)
        ponto_amphora = db.query(
            models.CollectionPoint.id,
            models.CollectionPoint.name,
            models.CollectionPoint.frequency,
            models.CollectionPoint.days_of_week,
            models.CollectionPoint.weeks_of_month
        ).filter(
            models.CollectionPoint.name.like('%AMPHORA%')
        ).first()
        
        if ponto_amphora:
            logger.info("\nAMPHORA LTDA (MATRIZ):")
            logger.info(f"  Frequência: {ponto_amphora.frequency}")
            logger.info(f"  Dias da semana: {ponto_amphora.days_of_week}")
            logger.info(f"  Semanas do mês: {ponto_amphora.weeks_of_month}")
            logger.info(f"  Dia da semana atual: {day_of_week} ({date.strftime('%A') if date else 'N/A'})")
            
            # Verifica se o ponto deve aparecer
            if date and hasattr(ponto_amphora, 'days_of_week') and hasattr(ponto_amphora, 'weeks_of_month'):
                dias = (ponto_amphora.days_of_week or '').split(',')
                semanas = (ponto_amphora.weeks_of_month or '').split(',')
                deve_aparecer = str(day_of_week) in dias and (not semanas or str(week_of_month) in semanas)
                logger.info(f"  Deve aparecer? {'Sim' if deve_aparecer else 'Não'}")
        
        # DROGARIA ELLER LTDA
        ponto_eller = db.query(
            models.CollectionPoint.id,
            models.CollectionPoint.name,
            models.CollectionPoint.frequency,
            models.CollectionPoint.days_of_week,
            models.CollectionPoint.weeks_of_month
        ).filter(
            models.CollectionPoint.name.like('%ELLER%')
        ).first()
        
        if ponto_eller:
            logger.info("\nDROGARIA ELLER LTDA:")
            logger.info(f"  Frequência: {ponto_eller.frequency}")
            logger.info(f"  Dias da semana: {ponto_eller.days_of_week}")
            logger.info(f"  Semanas do mês: {ponto_eller.weeks_of_month}")
            logger.info(f"  Dia da semana atual: {day_of_week} ({date.strftime('%A') if date else 'N/A'})")
            
            # Verifica se o ponto deve aparecer
            if date and hasattr(ponto_eller, 'days_of_week') and hasattr(ponto_eller, 'weeks_of_month'):
                dias = (ponto_eller.days_of_week or '').split(',')
                semanas = (ponto_eller.weeks_of_month or '').split(',')
                deve_aparecer = str(day_of_week) in dias and (not semanas or str(week_of_month) in semanas)
                logger.info(f"  Deve aparecer? {'Sim' if deve_aparecer else 'Não'}")
        
        logger.info("\n=== FIM PONTOS ESPECÍFICOS ===")
        logger.info("=== FIM PARÂMETROS ===\n")
        
        # Executa a consulta
        logger.info("\n=== EXECUTANDO CONSULTA ===")
        try:
            points = query.all()
            logger.info(f"Total de pontos retornados: {len(points)}")
            
            # Log de todos os pontos retornados (apenas IDs e nomes para não poluir muito)
            if points:
                logger.info("\nPONTOS ENCONTRADOS:")
                for p in points[:10]:  # Limita a 10 pontos para não poluir o log
                    logger.info(f"- ID: {p.id}, Nome: {p.name}, Frequência: {p.frequency}")
                
                if len(points) > 10:
                    logger.info(f"... e mais {len(points) - 10} pontos")
                
                logger.info("\n=== DETALHES DOS PONTOS ===")
        except Exception as e:
            logger.error(f"ERRO ao executar a consulta: {str(e)}")
            logger.error(f"Tipo do erro: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Se houver erro na consulta, retorna lista vazia
            points = []
        
        # Log de análise para cada ponto retornado
        if points:
            for point in points[:10]:  # Analisa apenas os primeiros 10 pontos para não poluir muito o log
                try:
                    # Garante que temos um objeto válido
                    if not hasattr(point, 'id'):
                        logger.warning("Ponto sem ID, pulando análise")
                        continue
                        
                    # Obtém os valores com tratamento para None
                    freq = str(getattr(point, 'frequency', '')).upper()
                    dias = [d.strip() for d in str(getattr(point, 'days_of_week', '')).split(',') if d.strip()]
                    semanas = [s.strip() for s in str(getattr(point, 'weeks_of_month', '')).split(',') if s.strip()]
                    nome = getattr(point, 'name', 'Sem nome')
                    
                    logger.info(f"  Frequência: {freq}")
                    logger.info(f"  Dias configurados: {dias if dias else 'Não especificado'}")
                    logger.info(f"  Semanas configuradas: {semanas if semanas else 'Não especificado'}")
                    
                    if date and day_of_week is not None:
                        logger.info(f"  Dia da semana atual: {day_of_week} ({date.strftime('%A')})")
                        if 'week_of_month' in locals() and week_of_month is not None:
                            logger.info(f"  Semana do mês: {week_of_month}")
                        else:
                            logger.info("  Semana do mês: Não disponível")
                        
                        try:
                            if freq == 'MENSAL':
                                dias_validos = not dias or str(day_of_week) in [d.strip() for d in dias if d.strip()]
                                semanas_validas = not semanas or ('week_of_month' in locals() and week_of_month is not None and str(week_of_month) in [s.strip() for s in semanas if s.strip()])
                                logger.info(f"  Verificação MENSAL: Dias válidos={dias_validos}, Semanas válidas={semanas_validas}")
                                logger.info(f"  Incluído: {'Sim' if dias_validos and semanas_validas else 'Não'}")
                                
                            elif freq == 'SEMANAL':
                                dias_validos = not dias or str(day_of_week) in [d.strip() for d in dias if d.strip()]
                                logger.info(f"  Verificação SEMANAL: Dias válidos={dias_validos}")
                                logger.info(f"  Incluído: {'Sim' if dias_validos else 'Não'}")
                                
                            elif freq == 'QUINZENAL':
                                semana_par = (date.isocalendar()[1] % 2) == 0 if date else False
                                semana_atual = '2' if semana_par else '1'
                                dias_validos = not dias or str(day_of_week) in [d.strip() for d in dias if d.strip()]
                                semanas_validas = not semanas or semana_atual in [s.strip() for s in semanas if s.strip()]
                                logger.info(f"  Verificação QUINZENAL: Dias válidos={dias_validos}, Semana atual={'par' if semana_par else 'ímpar'}")
                                logger.info(f"  Incluído: {'Sim' if dias_validos and semanas_validas else 'Não'}")
                                
                            else:  # DIÁRIO ou não especificado
                                logger.info("  Verificação DIÁRIA: Sempre incluído")
                        except Exception as e:
                            logger.error(f"  Erro ao verificar frequência: {str(e)}")
                            logger.info("  Incluído: Não (erro na verificação)")
                    else:
                        logger.info("  Sem data específica para verificação")
                except Exception as e:
                    logger.error(f"Erro ao analisar ponto {getattr(point, 'id', 'N/A')}: {str(e)}")
        
        if len(points) > 10:
            logger.info(f"\n... mais {len(points) - 10} pontos não analisados no log...")
        
        logger.info("=== FIM ANÁLISE DE PONTOS ===\n")
        
        # Aplicar paginação se necessário
        if points and (skip > 0 or limit < len(points)):
            start_idx = min(skip, len(points))
            end_idx = min(skip + limit, len(points))
            points = points[start_idx:end_idx]
            
        logger.info(f"Total de pontos a serem retornados: {len(points) if points else 0}")
        return points or []
            
    except Exception as e:
        logger.error(f"Erro ao listar pontos de coleta: {str(e)}")
        logger.error(f"Tipo do erro: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao listar pontos de coleta: {str(e)}"
        )

@router.post("", response_model=schemas.CollectionPoint, status_code=status.HTTP_201_CREATED, tags=["collection-points"])
async def create_collection_point(
    point: schemas.CollectionPointCreate, 
    db: Session = Depends(get_db)
):
    """
    Cria um novo ponto de coleta.
    """
    print(f"\n[DEBUG] Tentando criar ponto: name={point.name}, city={point.city}, external_id={point.external_id}")
    
    # Verifica se já existe um ponto com o mesmo ID externo, se fornecido
    if point.external_id:
        existing_by_external = db.query(models.CollectionPoint).filter(
            models.CollectionPoint.external_id == point.external_id
        ).first()
        
        if existing_by_external:
            error_msg = f"Já existe um ponto de coleta com o ID externo '{point.external_id}'"
            print(f"[ERRO] {error_msg}")
            raise HTTPException(
                status_code=400,
                detail=error_msg
            )
    
    # Verifica se já existe um ponto com o mesmo nome na mesma cidade (case insensitive)
    existing_by_name = db.query(models.CollectionPoint).filter(
        func.lower(models.CollectionPoint.name) == func.lower(point.name.strip()),
        func.lower(models.CollectionPoint.city) == func.lower(point.city.strip()),
        models.CollectionPoint.is_active == True
    ).first()
    
    if existing_by_name:
        error_msg = f"Já existe um ponto de coleta com o nome '{point.name}' em {point.city}"
        print(f"[ERRO] {error_msg}")
        raise HTTPException(
            status_code=400,
            detail=error_msg
        )
    
    try:
        # Cria o novo ponto de coleta
        point_data = point.dict()
        # Remove espaços em branco extras dos campos de texto
        for field in ['name', 'city', 'state', 'address', 'neighborhood']:
            if field in point_data and point_data[field]:
                point_data[field] = point_data[field].strip()
        
        db_point = models.CollectionPoint(**point_data)
        db.add(db_point)
        db.commit()
        db.refresh(db_point)
        print(f"[SUCESSO] Ponto criado com ID: {db_point.id}")
        return db_point
        
    except Exception as e:
        db.rollback()
        error_msg = f"Erro ao criar ponto de coleta: {str(e)}"
        print(f"[ERRO] {error_msg}")
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )

@router.get("/{point_id}", response_model=schemas.CollectionPoint)
def get_collection_point(
    point_id: int, 
    db: Session = Depends(get_db)
):
    """
    Obtém um ponto de coleta pelo ID.
    """
    db_point = db.query(models.CollectionPoint).filter(
        models.CollectionPoint.id == point_id
    ).first()
    
    if db_point is None:
        raise HTTPException(
            status_code=404,
            detail="Ponto de coleta não encontrado"
        )
    
    return db_point

@router.get("/external/{external_id}", response_model=schemas.CollectionPoint)
def get_collection_point_by_external_id(
    external_id: str,
    db: Session = Depends(get_db)
):
    """
    Obtém um ponto de coleta pelo ID externo.
    """
    db_point = db.query(models.CollectionPoint).filter(
        models.CollectionPoint.external_id == external_id
    ).first()
    
    if db_point is None:
        raise HTTPException(
            status_code=404,
            detail="Ponto de coleta não encontrado"
        )
    
    return db_point

@router.delete("/external/{external_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection_point_by_external_id(
    external_id: str,
    db: Session = Depends(get_db)
):
    """
    Remove um ponto de coleta pelo ID externo (soft delete).
    """
    db_point = db.query(models.CollectionPoint).filter(
        models.CollectionPoint.external_id == external_id
    ).first()
    
    if db_point is None:
        return
    
    # Soft delete
    db_point.is_active = False
    db.commit()
    return None

@router.put("/{point_id}", response_model=schemas.CollectionPoint)
def update_collection_point(
    point_id: int, 
    point: schemas.CollectionPointUpdate, 
    db: Session = Depends(get_db)
):
    """
    Atualiza um ponto de coleta existente.
    """
    db_point = db.query(models.CollectionPoint).filter(
        models.CollectionPoint.id == point_id
    ).first()
    
    if db_point is None:
        raise HTTPException(
            status_code=404,
            detail="Ponto de coleta não encontrado"
        )
    
    # Atualiza apenas os campos fornecidos
    update_data = point.dict(exclude_unset=True)
    
    # Verifica se já existe outro ponto com o mesmo nome na mesma cidade
    if 'name' in update_data or 'city' in update_data:
        name = update_data.get('name', db_point.name)
        city = update_data.get('city', db_point.city)
        
        existing_point = db.query(models.CollectionPoint).filter(
            models.CollectionPoint.name == name,
            models.CollectionPoint.city == city,
            models.CollectionPoint.id != point_id
        ).first()
        
        if existing_point:
            raise HTTPException(
                status_code=400,
                detail=f"Já existe um ponto de coleta com o nome '{name}' em {city}"
            )
    
    # Atualiza os campos
    for field, value in update_data.items():
        setattr(db_point, field, value)
    
    db.commit()
    db.refresh(db_point)
    return db_point

@router.delete("/{point_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection_point(
    point_id: int, 
    db: Session = Depends(get_db)
):
    """
    Remove um ponto de coleta (soft delete).
    """
    db_point = db.query(models.CollectionPoint).filter(
        models.CollectionPoint.id == point_id
    ).first()
    
    if db_point is None:
        raise HTTPException(
            status_code=404,
            detail="Ponto de coleta não encontrado"
        )
    
    # Soft delete (marca como inativo em vez de remover)
    db_point.is_active = False
    db.commit()
    
    return {"ok": True}

@router.post("/check-existing", response_model=Dict[str, bool])
async def check_existing_external_ids(
    external_ids: schemas.ExternalIdList,
    db: Session = Depends(get_db)
):
    """
    Verifica quais IDs externos já existem no sistema.
    
    Retorna um dicionário onde as chaves são os IDs externos fornecidos
    e os valores são booleanos indicando se o ID já existe.
    """
    try:
        if not external_ids.ids:
            return {}
            
        # Busca todos os pontos que têm os IDs fornecidos
        existing_points = db.query(models.CollectionPoint.external_id).filter(
            models.CollectionPoint.external_id.in_(external_ids.ids),
            models.CollectionPoint.is_active == True
        ).all()
        
        # Cria um conjunto com os IDs existentes para busca rápida
        existing_ids = {point.external_id for point in existing_points}
        
        # Retorna um dicionário com todos os IDs fornecidos e se existem
        return {ext_id: ext_id in existing_ids for ext_id in external_ids.ids}
        
    except Exception as e:
        logger.error(f"Erro ao verificar IDs externos: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao verificar IDs externos: {str(e)}"
        )

@router.post("/batch", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any])
async def create_collection_points_batch(
    batch: schemas.CollectionPointBatchCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Cria múltiplos pontos de coleta de uma vez em uma única transação.
    
    Esta rota aceita uma lista de pontos de coleta e os salva no banco de dados.
    Retorna estatísticas sobre a operação.
    
    Em caso de erro, nenhum ponto é salvo (atomicidade).
    """
    if not batch.points or len(batch.points) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum ponto de coleta fornecido"
        )
    
    logger.info(f"Iniciando processamento de lote com {len(batch.points)} pontos")
    
    # Inicia uma transação
    try:
        created_count = 0
        updated_count = 0
        errors = []
        
        # Validação inicial de todos os pontos
        for index, point_data in enumerate(batch.points, 1):
            point_dict = point_data.dict(exclude_unset=True)
            
            # Verifica se tem external_id
            if not point_dict.get('external_id'):
                errors.append({
                    "index": index,
                    "name": point_dict.get('name', f'Ponto {index}'),
                    "error": "external_id é obrigatório"
                })
        
        # Se houver erros de validação, retorna imediatamente
        if errors:
            logger.warning(f"Validação falhou para {len(errors)} pontos")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": "Erro de validação em um ou mais pontos",
                    "errors": errors
                }
            )
        
        # Processa todos os pontos em uma única transação
        for index, point_data in enumerate(batch.points, 1):
            try:
                point_dict = point_data.dict(exclude_unset=True)
                external_id = point_dict['external_id']
                
                # Tenta encontrar por external_id
                existing_point = db.query(models.CollectionPoint).filter(
                    models.CollectionPoint.external_id == external_id
                ).first()
                
                if existing_point:
                    # Atualiza o ponto existente
                    for key, value in point_dict.items():
                        if key != 'id':  # Não atualiza o ID primário
                            setattr(existing_point, key, value)
                    db.add(existing_point)
                    updated_count += 1
                    logger.debug(f"Ponto atualizado: {external_id}")
                else:
                    # Cria um novo ponto
                    db_point = models.CollectionPoint(**point_dict)
                    db.add(db_point)
                    created_count += 1
                    logger.debug(f"Novo ponto criado: {external_id}")
                
            except Exception as e:
                logger.error(f"Erro ao processar ponto {index} (external_id: {external_id}): {str(e)}", 
                            exc_info=True)
                db.rollback()  # Desfaz todas as alterações em caso de erro
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "message": f"Erro ao processar ponto {index} (external_id: {external_id})",
                        "error": str(e)
                    }
                )
        
        # Se chegou até aqui, faz commit de tudo
        db.commit()
        logger.info(f"Batch processado com sucesso: {created_count} criados, {updated_count} atualizados")
        
        return {
            "success": True,
            "message": "Processamento de lotes concluído com sucesso",
            "total_points": len(batch.points),
            "created": created_count,
            "updated": updated_count,
            "errors": 0
        }
        
    except HTTPException:
        # Re-lança exceções HTTP (já tratadas)
        raise
        
    except Exception as e:
        logger.error(f"Erro inesperado ao processar lote: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": "Erro inesperado ao processar lote de pontos",
                "error": str(e)
            }
        )
