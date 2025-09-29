"""
RobustRouter - Sistema Avançado de Roteirização
-----------------------------------------------
Combina mapas reais do OpenStreetMap com meta-heurísticas avançadas
para otimização de rotas com múltiplas restrições.

Melhorias em relação às versões anteriores:
1. Estrutura de dados robusta com Pydantic
2. Suporte a cache de mapas offline
3. Múltiplas estratégias de otimização (VND, Tabu, GRASP)
4. Tratamento de erros aprimorado
5. Visualização avançada de rotas
"""

import os
import json
import math
import time
import uuid
import hashlib
import logging
import bisect
import concurrent.futures
import networkx as nx
import osmnx as ox
import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional, Any, Set
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field, validator
from datetime import datetime, time as dt_time
from geopy.distance import great_circle
from pathlib import Path

# Configura o logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Lista de servidores Overpass alternativos (em ordem de preferência)
OVERPASS_SERVERS = [
    'https://overpass.kumi.systems/api/interpreter',  # Servidor alternativo 1
    'https://lz4.overpass-api.de/api/interpreter',    # Servidor alternativo 2
    'https://overpass-api.de/api/interpreter'         # Servidor principal (última opção)
]

# Configura o OSMnx
ox.settings.use_cache = True
ox.settings.log_console = False  # Reduz o log
ox.settings.timeout = 600  # 10 minutos de timeout
ox.settings.cache_folder = "cache/osmnx"  # Pasta específica para cache
ox.settings.overpass_settings = {
    'endpoint': OVERPASS_SERVERS[0],  # Usa o primeiro servidor por padrão
    'timeout': 600,  # 10 minutos
    'memory': None,  # Sem limite de memória
    'max_retry_count': 3,  # Número de tentativas
    'retry_timeout': 60  # Tempo entre tentativas
}

# Configurações de requisição HTTP
ox.settings.requests_kwargs = {
    'timeout': 600,  # 10 minutos
    'headers': {
        'User-Agent': 'RobustRouter/1.0 (https://github.com/seu-usuario/seu-repositorio)',
        'Accept-Encoding': 'gzip, deflate'
    }
}

# Configurações personalizadas para lidar com rate limit
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 60  # segundos
MAX_RETRY_DELAY = 300  # 5 minutos
CURRENT_OVERLAP_SERVER_INDEX = 0  # Índice do servidor Overpass atual

# Cria diretório de cache se não existir
Path(ox.settings.cache_folder).mkdir(parents=True, exist_ok=True)

import random
import copy
import logging
import hashlib
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set, Deque, Tuple
from collections import defaultdict, deque
from datetime import datetime, time as dt_time
from pathlib import Path

import numpy as np
import pandas as pd
import networkx as nx
import osmnx as ox
import folium
from folium import plugins
from pydantic import BaseModel, Field, validator
from geopy.distance import geodesic
from geopy.geocoders import Nominatim
from shapely.geometry import Point as ShapelyPoint

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('router.log')
    ]
)
logger = logging.getLogger(__name__)

# Constantes
MAX_ITERATIONS = 200
TABU_TENURE = 30
GRASP_ITERATIONS = 50
CACHE_DIR = Path(__file__).parent / 'map_cache'
DEFAULT_SPEED_KMH = 40.0  # Velocidade padrão em km/h

# Configuração do OSMNX
ox.settings.use_cache = True
ox.settings.log_console = True
ox.settings.timeout = 300  # 5 minutos

class Point(BaseModel):
    """Modelo para um ponto de coleta/entrega com restrições."""
    id: str
    type: str = Field(..., pattern='^(start|pickup|delivery|depot)$')
    name: str = ""
    address: str = ""
    lat: float
    lng: float
    order: int = 0
    quantity: int = 1
    weight: float = 0.0
    volume: float = 0.0
    time_window_start: str = "08:00"
    time_window_end: str = "18:00"
    service_time: int = 5  # minutos
    priority: int = 1
    required_skills: Set[str] = set()
    notes: str = ""

    @validator('lat')
    def validate_lat(cls, v):
        if not -90 <= v <= 90:
            raise ValueError('Latitude deve estar entre -90 e 90')
        return v

    @validator('lng')
    def validate_lng(cls, v):
        if not -180 <= v <= 180:
            raise ValueError('Longitude deve estar entre -180 e 180')
        return v

    @validator('time_window_start', 'time_window_end')
    def validate_time_format(cls, v):
        try:
            dt_time.fromisoformat(v)
            return v
        except ValueError:
            raise ValueError('Formato de hora inválido. Use HH:MM')

class Vehicle(BaseModel):
    """Modelo para um veículo com restrições e capacidades."""
    id: str
    name: str = ""
    capacity: float = 0.0  # em kg
    max_weight: float = 0.0  # em kg
    volume_capacity: float = 0.0  # em m³
    length: float = 6.0  # em metros
    width: float = 2.0   # em metros
    height: float = 2.0  # em metros
    start_time: str = "08:00"
    end_time: str = "18:00"
    speed: float = DEFAULT_SPEED_KMH  # em km/h
    cost_per_km: float = 10.0
    fixed_cost: float = 100.0
    skills: Set[str] = set()
    driver_name: str = ""
    driver_phone: str = ""

    @property
    def speed_mps(self) -> float:
        """Retorna a velocidade em metros/segundo."""
        return (self.speed * 1000) / 3600  # km/h -> m/s

    @validator('start_time', 'end_time')
    def validate_time_format(cls, v):
        try:
            dt_time.fromisoformat(v)
            return v
        except ValueError:
            raise ValueError('Formato de hora inválido. Use HH:MM')

class Route:
    """Classe para representar uma rota com métricas de desempenho."""
    
    def __init__(self, vehicle: Vehicle):
        self.vehicle = vehicle
        self.points: List[Point] = []
        self.distance: float = 0.0  # em metros
        self.duration: float = 0.0  # em segundos
        self.cost: float = 0.0
        self.load: float = 0.0  # em kg
        self.volume: float = 0.0  # em m³
        self.time_windows_violation: float = 0.0
        self.capacity_violation: float = 0.0
        self.skill_requirements: Set[str] = set()
    
    def add_point(self, point: Point, distance: float, duration: float):
        """Adiciona um ponto à rota e atualiza as métricas."""
        self.points.append(point)
        self.distance += distance
        self.duration += duration
        self.load += point.weight
        self.volume += point.volume
        self.skill_requirements.update(point.required_skills)
        
        # Verifica violações de capacidade
        if self.load > self.vehicle.max_weight:
            self.capacity_violation += (self.load - self.vehicle.max_weight)
        if self.volume > self.vehicle.volume_capacity:
            self.capacity_violation += (self.volume - self.vehicle.volume_capacity)
        
        # Atualiza o custo
        self.cost = self.distance * self.vehicle.cost_per_km / 1000  # Converte para km
        if not self.points:  # Custo fixo apenas para a primeira parada
            self.cost += self.vehicle.fixed_cost


class RobustRouter:
    """Classe principal para otimização de rotas com múltiplas restrições."""
    
    def __init__(self, cache_dir: str = None):
        """Inicializa o roteirizador com configurações padrão."""
        self.cache_dir = Path(cache_dir) if cache_dir else CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.graph = None
        self.distance_matrix = {}
        self.time_matrix = {}
        self.points = {}
        self.vehicles = {}
        self.logger = logging.getLogger(__name__)
    
    async def load_map(self, location: str, network_type: str = 'drive') -> bool:
        """Carrega o mapa da localização especificada."""
        cache_file = self.cache_dir / f"{hashlib.md5(location.encode()).hexdigest()}.graphml"
        
        try:
            # Tenta carregar do cache primeiro
            if cache_file.exists():
                self.graph = ox.load_graphml(cache_file)
                self.logger.info(f"Mapa carregado do cache: {cache_file}")
                return True
                
            # Se não estiver em cache, baixa do OSM
            self.logger.info(f"Baixando mapa para: {location}")
            self.graph = ox.graph_from_place(location, network_type=network_type)
            
            # Salva no cache para uso futuro
            ox.save_graphml(self.graph, cache_file)
            self.logger.info(f"Mapa salvo no cache: {cache_file}")
            return True
            
        except Exception as e:
            self.logger.error(f"Erro ao carregar o mapa: {str(e)}")
            return False
    
    def add_points(self, points: List[Point]):
        """Adiciona pontos ao roteirizador."""
        for point in points:
            self.points[point.id] = point
    
    def add_vehicles(self, vehicles: List[Vehicle]):
        """Adiciona veículos ao roteirizador."""
        for vehicle in vehicles:
            self.vehicles[vehicle.id] = vehicle
    
    def _create_distance_time_matrices(self):
        """Cria matrizes de distância e tempo entre todos os pontos."""
        try:
            if not hasattr(self, 'graph') or self.graph is None:
                error_msg = "Erro: self.graph não está definido"
                self.logger.error(error_msg)
                raise ValueError(error_msg)
                
            if not hasattr(self, 'points') or not self.points:
                error_msg = "Erro: self.points não está definido ou está vazio"
                self.logger.error(error_msg)
                raise ValueError(error_msg)
            
            self.logger.info(f"Iniciando criação de matrizes para {len(self.points)} pontos")
            
            point_ids = list(self.points.keys())
            n = len(point_ids)
            
            # Inicializa matrizes
            self.distance_matrix = {i: {} for i in point_ids}
            self.time_matrix = {i: {} for i in point_ids}
            
            # Configuração de velocidade padrão (30 km/h em m/s)
            default_speed = 30 * 1000 / 3600
            speed = default_speed
            
            # Obtém a velocidade do veículo se disponível
            if hasattr(self, 'vehicles') and self.vehicles:
                try:
                    vehicle = next(iter(self.vehicles.values()))
                    if hasattr(vehicle, 'speed_mps'):
                        speed = vehicle.speed_mps
                        self.logger.info(f"Usando velocidade do veículo: {speed*3.6:.2f} km/h")
                except Exception as e:
                    self.logger.warning(f"Erro ao obter velocidade do veículo, usando padrão: {str(e)}")
            else:
                self.logger.warning(f"Nenhum veículo definido, usando velocidade padrão: {speed*3.6:.2f} km/h")
            
            # Preenche as matrizes
            for i in range(n):
                origin_id = point_ids[i]
                origin = self.points[origin_id]
                
                for j in range(n):
                    dest_id = point_ids[j]
                    
                    if i == j:
                        self.distance_matrix[origin_id][dest_id] = 0
                        self.time_matrix[origin_id][dest_id] = 0
                        continue
                    
                    dest = self.points[dest_id]
                    
                    try:
                        # Calcula os nós mais próximos no grafo
                        orig_node = ox.distance.nearest_nodes(
                            self.graph, 
                            origin.lng, 
                            origin.lat
                        )
                        dest_node = ox.distance.nearest_nodes(
                            self.graph, 
                            dest.lng, 
                            dest.lat
                        )
                        
                        # Calcula o caminho mais curto
                        path = nx.shortest_path(
                            self.graph, 
                            orig_node, 
                            dest_node, 
                            weight='length',
                            method='dijkstra'
                        )
                        
                        # Calcula distância total
                        distance = sum(
                            self.graph[path[k]][path[k+1]][0]['length'] 
                            for k in range(len(path)-1)
                        )
                        
                        # Calcula o tempo de viagem
                        time = distance / speed if speed > 0 else float('inf')
                        
                        self.distance_matrix[origin_id][dest_id] = distance
                        self.time_matrix[origin_id][dest_id] = time
                        
                    except nx.NetworkXNoPath:
                        self.logger.warning(f"Nenhum caminho encontrado entre {origin_id} e {dest_id}")
                        self.distance_matrix[origin_id][dest_id] = float('inf')
                        self.time_matrix[origin_id][dest_id] = float('inf')
                    except Exception as e:
                        self.logger.error(f"Erro ao calcular rota entre {origin_id} e {dest_id}: {str(e)}")
                        self.distance_matrix[origin_id][dest_id] = float('inf')
                        self.time_matrix[origin_id][dest_id] = float('inf')
            
            self.logger.info("Matrizes de distância e tempo criadas com sucesso")
            return True
            
        except Exception as e:
            self.logger.error(f"Erro crítico ao criar matrizes: {str(e)}", exc_info=True)
            raise
    
    def _check_points_in_map(self) -> bool:
        """Verifica se todos os pontos estão dentro da área coberta pelo mapa carregado.
        
        Returns:
            bool: True se todos os pontos estiverem dentro do mapa, False caso contrário
        """
        if not self.graph:
            self.logger.warning("Nenhum mapa carregado para verificação dos pontos")
            return False
            
        # Obtém os limites do grafo
        nodes = ox.graph_to_gdfs(self.graph, nodes=True, edges=False)
        min_lat, max_lat = nodes.y.min(), nodes.y.max()
        min_lon, max_lon = nodes.x.min(), nodes.x.max()
        
        # Verifica cada ponto
        all_inside = True
        for point_id, point in self.points.items():
            if not (min_lat <= point.lat <= max_lat and min_lon <= point.lng <= max_lon):
                self.logger.warning(
                    f"Ponto {point_id} ({point.lat}, {point.lng}) está fora dos limites do mapa: "
                    f"Latitude [{min_lat:.6f}, {max_lat:.6f}], "
                    f"Longitude [{min_lon:.6f}, {max_lon:.6f}]"
                )
                all_inside = False
                
        return all_inside
    
    def solve_vrp(self, method: str = 'vnd', **kwargs) -> Dict[str, Any]:
        """Resolve o problema de roteamento de veículos.
        
        Args:
            method: Método de otimização ('vnd', 'tabu', 'grasp')
            **kwargs: Parâmetros adicionais para os métodos de otimização
            
        Returns:
            Dicionário com as rotas e métricas
            
        Raises:
            ValueError: Se não for possível resolver o problema de roteamento
        """
        try:
            if not self.points:
                raise ValueError("Nenhum ponto de entrega/coleta fornecido para otimização")
                
            if not self.vehicles:
                raise ValueError("Nenhum veículo disponível para realizar as entregas/coletas")
            
            # Verifica se há pontos fora da área de cobertura do mapa
            if not self._check_points_in_map():
                raise ValueError(
                    "Alguns pontos estão fora da área de cobertura do mapa. "
                    "Verifique se as coordenadas dos pontos estão corretas e se o mapa foi carregado corretamente."
                )
            
            # Cria as matrizes de distância e tempo
            self._create_distance_time_matrices()
            
            # Seleciona o método de otimização
            try:
                if method == 'vnd':
                    return self._solve_with_vnd(**kwargs)
                elif method == 'tabu':
                    return self._solve_with_tabu_search(**kwargs)
                elif method == 'grasp':
                    return self._solve_with_grasp(**kwargs)
                else:
                    raise ValueError(f"Método de otimização não suportado: {method}")
                    
            except ValueError as ve:
                # Propaga erros de validação específicos
                raise ve
            except Exception as e:
                self.logger.error(f"Erro durante a otimização com método {method}: {str(e)}")
                raise ValueError(
                    f"Falha ao executar a otimização com o método {method}. "
                    "Verifique os dados de entrada e tente novamente."
                ) from e
                
        except ValueError as ve:
            # Log do erro e propaga para cima
            self.logger.error(f"Erro na validação dos dados para otimização: {str(ve)}")
            raise ve
        except Exception as e:
            self.logger.error(f"Erro inesperado durante a otimização: {str(e)}", exc_info=True)
            raise ValueError(
                "Ocorreu um erro inesperado durante a otimização das rotas. "
                "Por favor, verifique os dados de entrada e tente novamente."
            ) from e
    
    def _solve_with_vnd(self, max_iterations: int = MAX_ITERATIONS, **kwargs) -> Dict[str, Any]:
        """Resolve usando Variable Neighborhood Descent."""
        try:
            # Gera solução inicial
            routes = self._generate_initial_solution()
            
            # Verifica se alguma rota tem pontos atribuídos
            if not any(route.points for route in routes):
                raise ValueError(
                    "Não foi possível criar rotas iniciais. "
                    "Verifique se existem veículos disponíveis e se os pontos podem ser atendidos por eles."
                )
                
            best_routes = copy.deepcopy(routes)
            best_cost = self._calculate_solution_cost(best_routes)
            
            # Estruturas de vizinhança
            neighborhoods = [
                self._relocate_neighborhood,
                self._exchange_neighborhood,
                self._two_opt_neighborhood
            ]
            
            # Loop principal do VND
            improved = True
            iteration = 0
            
            while improved and iteration < max_iterations:
                improved = False
                
                for neighborhood in neighborhoods:
                    # Gera vizinhança
                    new_routes = neighborhood(routes)
                    
                    # Verifica se a vizinhança retornou alguma rota válida
                    if not new_routes or not any(route.points for route in new_routes):
                        continue
                        
                    new_cost = self._calculate_solution_cost(new_routes)
                    
                    # Se encontrou uma solução melhor, atualiza
                    if new_cost < best_cost:
                        best_routes = copy.deepcopy(new_routes)
                        best_cost = new_cost
                        routes = new_routes
                        improved = True
                        break  # Volta para a primeira vizinhança
                
                iteration += 1
            
            # Verifica se encontrou alguma solução válida
            if not best_routes or not any(route.points for route in best_routes):
                raise ValueError(
                    "Não foi possível encontrar uma solução viável. "
                    "Verifique as restrições de capacidade, habilidades e janelas de tempo dos veículos."
                )
            
            return self._format_solution(best_routes)
            
        except Exception as e:
            self.logger.error(f"Erro na otimização VND: {str(e)}")
            raise ValueError(f"Falha na otimização: {str(e)}")
    
    def _solve_with_tabu_search(self, max_iterations: int = MAX_ITERATIONS, 
                              tabu_tenure: int = TABU_TENURE, **kwargs) -> Dict[str, Any]:
        """Resolve usando Busca Tabu."""
        current_solution = self._generate_initial_solution()
        best_solution = copy.deepcopy(current_solution)
        best_cost = self._calculate_solution_cost(best_solution)
        
        tabu_list = deque(maxlen=tabu_tenure)
        
        for _ in range(max_iterations):
            # Gera vizinhos
            neighbors = []
            for _ in range(10):  # Número de vizinhos a gerar
                neighbor = self._generate_neighbor(current_solution)
                neighbors.append((neighbor, self._calculate_solution_cost(neighbor)))
            
            # Ordena vizinhos por custo
            neighbors.sort(key=lambda x: x[1])
            
            # Encontra o melhor vizinho não tabu
            best_neighbor = None
            for neighbor, cost in neighbors:
                if neighbor not in tabu_list:
                    best_neighbor = neighbor
                    break
            
            # Se não encontrou vizinho não tabu, usa o melhor disponível
            if best_neighbor is None and neighbors:
                best_neighbor = neighbors[0][0]
            
            if best_neighbor is not None:
                current_solution = best_neighbor
                tabu_list.append(current_solution)
                
                # Atualiza a melhor solução
                current_cost = self._calculate_solution_cost(current_solution)
                if current_cost < best_cost:
                    best_solution = copy.deepcopy(current_solution)
                    best_cost = current_cost
        
        return self._format_solution(best_solution)
    
    def _solve_with_grasp(self, max_iterations: int = GRASP_ITERATIONS, **kwargs) -> Dict[str, Any]:
        """Resolve usando GRASP (Greedy Randomized Adaptive Search Procedure)."""
        best_solution = None
        best_cost = float('inf')
        alpha = kwargs.get('alpha', 0.3)  # Parâmetro de aleatoriedade
        
        for _ in range(max_iterations):
            # Fase de construção
            solution = self._grasp_construction(alpha)
            
            # Busca local
            improved_solution = self._local_search(solution)
            
            # Atualiza a melhor solução
            current_cost = self._calculate_solution_cost(improved_solution)
            if current_cost < best_cost:
                best_solution = improved_solution
                best_cost = current_cost
        
        return self._format_solution(best_solution)
    
    def _grasp_construction(self, alpha: float) -> List[Route]:
        """Fase de construção do GRASP."""
        # Implementação simplificada
        routes = []
        unassigned_points = list(self.points.values())
        
        # Cria uma rota para cada veículo
        for vehicle in self.vehicles.values():
            route = Route(vehicle)
            routes.append(route)
            
            # Tenta adicionar pontos à rota respeitando as restrições
            while unassigned_points:
                # Calcula os custos de inserção para todos os pontos não atribuídos
                candidates = []
                for point in unassigned_points:
                    if self._can_add_point(route, point):
                        cost = self._calculate_insertion_cost(route, point)
                        candidates.append((point, cost))
                
                if not candidates:
                    break  # Não há mais pontos que possam ser adicionados
                
                # Ordena os candidatos por custo
                candidates.sort(key=lambda x: x[1])
                
                # Seleciona aleatoriamente entre os melhores candidatos
                max_index = max(1, int(len(candidates) * alpha))
                selected = random.choice(candidates[:max_index])
                
                # Adiciona o ponto selecionado à rota
                point, _ = selected
                route.add_point(point, 0, 0)  # Distância e duração serão calculadas depois
                unassigned_points.remove(point)
        
        return routes
    
    def _local_search(self, solution: List[Route]) -> List[Route]:
        """Aplica busca local a uma solução."""
        # Implementação simplificada usando VND
        best_solution = copy.deepcopy(solution)
        best_cost = self._calculate_solution_cost(best_solution)
        
        # Estruturas de vizinhança
        neighborhoods = [
            self._relocate_neighborhood,
            self._exchange_neighborhood,
            self._two_opt_neighborhood
        ]
        
        improved = True
        while improved:
            improved = False
            
            for neighborhood in neighborhoods:
                # Gera vizinhança
                new_solution = neighborhood(best_solution)
                new_cost = self._calculate_solution_cost(new_solution)
                
                # Se encontrou uma solução melhor, atualiza
                if new_cost < best_cost:
                    best_solution = copy.deepcopy(new_solution)
                    best_cost = new_cost
                    improved = True
                    break  # Volta para a primeira vizinhança
        
        return best_solution
    
    def _calculate_insertion_cost(self, route: Route, point: Point) -> float:
        """Calcula o custo de inserção de um ponto em uma rota."""
        # Implementação simplificada
        # Em uma implementação real, isso consideraria a posição ótima na rota
        if not route.points:
            return 0
        
        # Custo de inserção no final da rota
        last_point = route.points[-1]
        return self.distance_matrix[last_point.id][point.id]
    
    def _can_add_point(self, route: Route, point: Point) -> bool:
        """Verifica se um ponto pode ser adicionado à rota respeitando as restrições."""
        # Verifica capacidade de peso
        if route.load + point.weight > route.vehicle.max_weight:
            return False
            
        # Verifica capacidade de volume
        if route.volume + point.volume > route.vehicle.volume_capacity:
            return False
            
        # Verifica habilidades necessárias
        if point.required_skills and not point.required_skills.issubset(route.vehicle.skills):
            return False
            
        return True
    
    def _generate_initial_solution(self) -> List[Route]:
        """Gera uma solução inicial usando uma heurística gulosa."""
        routes = []
        unassigned_points = list(self.points.values())
        total_points = len(unassigned_points)
        
        if total_points == 0:
            raise ValueError("Nenhum ponto de entrega/coleta fornecido para otimização")
        
        # Cria uma rota para cada veículo
        for vehicle in self.vehicles.values():
            route = Route(vehicle)
            routes.append(route)
            
            # Tenta adicionar pontos à rota respeitando as restrições
            for point in unassigned_points[:]:
                if self._can_add_point(route, point):
                    route.add_point(point, 0, 0)  # Distância e duração serão calculadas depois
                    unassigned_points.remove(point)
        
        # Verifica se algum ponto foi atribuído
        assigned_points = total_points - len(unassigned_points)
        if assigned_points == 0:
            # Nenhum ponto pôde ser atribuído a nenhum veículo
            raise ValueError(
                "Não foi possível atribuir nenhum ponto aos veículos. "
                "Verifique as restrições de capacidade, habilidades e janelas de tempo dos veículos."
            )
        elif len(unassigned_points) > 0:
            self.logger.warning(
                f"Atenção: {len(unassigned_points)} de {total_points} pontos não puderam ser atribuídos a nenhum veículo. "
                "Verifique as restrições de capacidade, habilidades e janelas de tempo dos veículos."
            )
        
        return routes
    
    def _calculate_solution_cost(self, routes: List[Route]) -> float:
        """Calcula o custo total de uma solução."""
        total_cost = 0
        for route in routes:
            total_cost += route.cost
            # Adiciona penalidades por violações
            total_cost += route.capacity_violation * 1000  # Penalidade alta para violações
            total_cost += route.time_windows_violation * 100
        return total_cost
    
    def _format_solution(self, routes: List[Route]) -> Dict[str, Any]:
        """Formata a solução para retorno."""
        formatted_routes = []
        
        for i, route in enumerate(routes):
            if not route.points:
                continue  # Ignora rotas vazias
                
            formatted_route = {
                'vehicle_id': route.vehicle.id,
                'points': [{
                    'id': p.id,
                    'type': p.type,
                    'lat': p.lat,
                    'lng': p.lng
                } for p in route.points],
                'distance': route.distance / 1000,  # Converte para km
                'duration': route.duration / 60,    # Converte para minutos
                'cost': route.cost,
                'load': route.load,
                'volume': route.volume
            }
            formatted_routes.append(formatted_route)
        
        return {
            'routes': formatted_routes,
            'total_distance': sum(r.distance for r in routes) / 1000,  # km
            'total_duration': sum(r.duration for r in routes) / 60,    # minutos
            'total_cost': sum(r.cost for r in routes),
            'vehicles_used': len([r for r in routes if r.points])
        }
    
    # ====================================
    # Métodos de Vizinhança
    # ====================================
    
    def _relocate_neighborhood(self, solution: List[Route]) -> List[Route]:
        """Gera vizinhança movendo um ponto de uma rota para outra."""
        if len(solution) < 2:
            return copy.deepcopy(solution)
            
        new_solution = copy.deepcopy(solution)
        
        # Seleciona aleatoriamente uma rota de origem e um ponto
        from_route_idx = random.randint(0, len(new_solution) - 1)
        from_route = new_solution[from_route_idx]
        
        if not from_route.points:
            return new_solution  # Rota vazia, não há o que mover
            
        point_idx = random.randint(0, len(from_route.points) - 1)
        point = from_route.points[point_idx]
        
        # Remove o ponto da rota de origem
        from_route.points.pop(point_idx)
        
        # Tenta adicionar o ponto a outra rota
        for to_route_idx in range(len(new_solution)):
            if to_route_idx == from_route_idx:
                continue
                
            to_route = new_solution[to_route_idx]
            
            if self._can_add_point(to_route, point):
                # Encontra a melhor posição para inserir o ponto
                best_pos = 0
                min_cost = float('inf')
                
                for pos in range(len(to_route.points) + 1):
                    to_route.points.insert(pos, point)
                    cost = self._calculate_route_cost(to_route)
                    to_route.points.pop(pos)
                    
                    if cost < min_cost:
                        min_cost = cost
                        best_pos = pos
                
                # Insere o ponto na melhor posição
                to_route.points.insert(best_pos, point)
                return new_solution
        
        # Se não conseguiu adicionar a outra rota, volta o ponto para a rota original
        from_route.points.insert(point_idx, point)
        return new_solution
    
    def _exchange_neighborhood(self, solution: List[Route]) -> List[Route]:
        """Gera vizinhança trocando dois pontos de rotas diferentes."""
        if len(solution) < 2:
            return copy.deepcopy(solution)
            
        new_solution = copy.deepcopy(solution)
        
        # Seleciona duas rotas diferentes aleatoriamente
        route1_idx, route2_idx = random.sample(range(len(new_solution)), 2)
        route1 = new_solution[route1_idx]
        route2 = new_solution[route2_idx]
        
        if not route1.points or not route2.points:
            return new_solution  # Pelo menos uma rota está vazia
        
        # Seleciona um ponto de cada rota
        point1_idx = random.randint(0, len(route1.points) - 1)
        point2_idx = random.randint(0, len(route2.points) - 1)
        
        point1 = route1.points[point1_idx]
        point2 = route2.points[point2_idx]
        
        # Verifica se a troca é viável
        temp_route1 = copy.deepcopy(route1)
        temp_route2 = copy.deepcopy(route2)
        
        # Remove os pontos atuais
        temp_route1.points.pop(point1_idx)
        temp_route2.points.pop(point2_idx)
        
        # Verifica se os pontos podem ser adicionados às rotas opostas
        if (self._can_add_point(temp_route1, point2) and 
            self._can_add_point(temp_route2, point1)):
            
            # Realiza a troca
            route1.points[point1_idx] = point2
            route2.points[point2_idx] = point1
        
        return new_solution
    
    def _two_opt_neighborhood(self, solution: List[Route]) -> List[Route]:
        """Gera vizinhança invertendo uma subsequência de pontos em uma rota (2-opt)."""
        new_solution = copy.deepcopy(solution)
        
        # Seleciona uma rota aleatória
        route_idx = random.randint(0, len(new_solution) - 1)
        route = new_solution[route_idx]
        
        if len(route.points) < 2:
            return new_solution  # Não há pontos suficientes para inverter
        
        # Seleciona dois índices aleatórios
        i, j = sorted(random.sample(range(len(route.points)), 2))
        
        # Inverte a subsequência entre i e j
        route.points[i:j+1] = reversed(route.points[i:j+1])
        
        return new_solution
    
    def _generate_neighbor(self, solution: List[Route]) -> List[Route]:
        """Gera um vizinho aleatório usando um dos operadores de vizinhança."""
        operators = [
            self._relocate_neighborhood,
            self._exchange_neighborhood,
            self._two_opt_neighborhood
        ]
        
        # Seleciona um operador aleatório
        operator = random.choice(operators)
        return operator(solution)
    
    def _calculate_route_cost(self, route: Route) -> float:
        """Calcula o custo de uma única rota."""
        if not route.points:
            return 0
            
        total_distance = 0
        total_duration = 0
        
        # Calcula a distância e duração entre pontos consecutivos
        for i in range(len(route.points) - 1):
            from_point = route.points[i]
            to_point = route.points[i + 1]
            
            distance = self.distance_matrix[from_point.id][to_point.id]
            duration = self.time_matrix[from_point.id][to_point.id]
            
            total_distance += distance
            total_duration += duration
        
        # Calcula o custo total
        cost = (total_distance / 1000) * route.vehicle.cost_per_km
        if route.points:  # Custo fixo apenas para rotas não vazias
            cost += route.vehicle.fixed_cost
        
        return cost
        
    def from_json(self, data: Dict) -> Tuple[List[Point], List[Vehicle]]:
        """Converte os dados de entrada do formato JSON para os modelos internos.
        
        Aceita qualquer estrutura de JSON, apenas validando os campos obrigatórios.
        """
        try:
            self.logger.info("Iniciando processamento dos dados de entrada...")
            
            # Processa veículos
            vehicles = []
            for v in data.get('vehicles', []):
                try:
                    # Cria um dicionário com os campos fornecidos
                    vehicle_data = {
                        'id': str(v.get('id', f'vehicle_{len(vehicles) + 1}')),
                        'name': str(v.get('name', f'Veículo {len(vehicles) + 1}')),
                        'capacity': float(v.get('capacity', v.get('max_weight', 1000))),
                        'max_weight': float(v.get('max_weight', v.get('capacity', 1000))),
                        'volume_capacity': float(v.get('volume_capacity', 10)),
                        'length': float(v.get('length', 5)),
                        'width': float(v.get('width', 2)),
                        'height': float(v.get('height', 2)),
                        'start_time': str(v.get('start_time', '08:00')),
                        'end_time': str(v.get('end_time', '18:00')),
                        'speed': float(v.get('speed', 40)),
                        'cost_per_km': float(v.get('cost_per_km', 1.0)),
                        'fixed_cost': float(v.get('fixed_cost', 0.0))
                    }
                    
                    # Adiciona campos adicionais que não estão no modelo padrão
                    for key, value in v.items():
                        if key not in vehicle_data:
                            vehicle_data[key] = value
                    
                    vehicle = Vehicle(**vehicle_data)
                    vehicles.append(vehicle)
                    self.logger.info(f"Veículo processado: {vehicle.name} (ID: {vehicle.id})")
                    
                except Exception as ve:
                    self.logger.error(f"Erro ao processar veículo: {str(ve)}")
                    raise ValueError(f"Erro no veículo {v.get('id', '')}: {str(ve)}")
            
            # Processa pontos
            points = []
            for p in data.get('points', []):
                try:
                    # Cria um dicionário com os campos fornecidos
                    point_data = {
                        'id': str(p.get('id', f'point_{len(points) + 1}')),
                        'type': str(p.get('type', 'delivery')).lower(),
                        'name': str(p.get('name', f'Ponto {len(points) + 1}')),
                        'address': str(p.get('address', '')),
                        'lat': float(p['lat']) if 'lat' in p else 0.0,
                        'lng': float(p['lng']) if 'lng' in p else 0.0,
                        'order': int(p.get('order', len(points))),
                        'quantity': int(p.get('quantity', 1)),
                        'weight': float(p.get('weight', 0)),
                        'volume': float(p.get('volume', 0)),
                        'time_window_start': str(p.get('time_window_start', '08:00')),
                        'time_window_end': str(p.get('time_window_end', '18:00')),
                        'service_time': int(p.get('service_time', 5)),
                        'priority': int(p.get('priority', 1))
                    }
                    
                    # Adiciona campos adicionais que não estão no modelo padrão
                    for key, value in p.items():
                        if key not in point_data:
                            point_data[key] = value
                    
                    # Converte 'start' para 'depot' se necessário
                    if point_data['type'] == 'start':
                        point_data['type'] = 'depot'
                    
                    point = Point(**point_data)
                    points.append(point)
                    self.logger.info(f"Ponto processado: {point.name} (Tipo: {point.type}, ID: {point.id})")
                    
                except Exception as pe:
                    self.logger.error(f"Erro ao processar ponto: {str(pe)}")
                    raise ValueError(f"Erro no ponto {p.get('id', '')}: {str(pe)}")
            
            if not points:
                raise ValueError("Nenhum ponto de entrega ou coleta fornecido")
            
            self.logger.info(f"Processamento concluído: {len(points)} pontos e {len(vehicles)} veículos processados.")
            return points, vehicles
            
        except Exception as e:
            self.logger.error(f"Erro ao processar dados de entrada: {str(e)}")
            raise ValueError(f"Erro ao processar dados de entrada: {str(e)}")
    
    def _get_cell_cache_key(self, cell_north: float, cell_south: float, cell_east: float, cell_west: float) -> str:
        """Gera uma chave única para o cache de uma célula."""
        precision = 6  # 6 casas decimais (~10cm de precisão)
        key = (
            f"{round(cell_north, precision)}_{round(cell_south, precision)}_"
            f"{round(cell_east, precision)}_{round(cell_west, precision)}"
        )
        return hashlib.md5(key.encode()).hexdigest()
        
    def _get_next_overpass_server(self) -> str:
        """
        Obtém o próximo servidor Overpass disponível na lista de servidores.
        
        Returns:
            str: URL do próximo servidor Overpass a ser usado
        """
        global CURRENT_OVERLAP_SERVER_INDEX
        
        # Obtém o próximo servidor na lista (com wrap-around)
        server = OVERPASS_SERVERS[CURRENT_OVERLAP_SERVER_INDEX]
        CURRENT_OVERLAP_SERVER_INDEX = (CURRENT_OVERLAP_SERVER_INDEX + 1) % len(OVERPASS_SERVERS)
        
        self.logger.info(f"Usando servidor Overpass: {server}")
        return server
    
    def _download_cell_with_retry(self, north: float, south: float, east: float, west: float) -> Optional[nx.MultiDiGraph]:
        """
        Baixa uma célula do mapa com retentativa, alternando entre servidores Overpass em caso de falha.
        
        Args:
            north: Limite norte da célula
            south: Limite sul da célula
            east: Limite leste da célula
            west: Limite oeste da célula
            
        Returns:
            nx.MultiDiGraph: Grafo da célula ou None em caso de falha
        """
        retry_delay = INITIAL_RETRY_DELAY
        server_attempts = 0
        max_server_attempts = len(OVERPASS_SERVERS) * 2  # Tenta cada servidor até 2x
        
        while server_attempts < max_server_attempts:
            # Obtém o próximo servidor
            current_server = self._get_next_overpass_server()
            
            # Atualiza as configurações do OSMnx para usar o servidor atual
            ox.settings.overpass_settings['endpoint'] = current_server
            
            for attempt in range(MAX_RETRIES):
                try:
                    self.logger.info(
                        f"Tentativa {attempt + 1}/{MAX_RETRIES} - Baixando célula "
                        f"N:{north:.6f}, S:{south:.6f}, E:{east:.6f}, W:{west:.6f} "
                        f"(Servidor: {current_server})"
                    )
                    
                    # Prepara os argumentos para graph_from_bbox
                    graph_args = {
                        'north': north,
                        'south': south,
                        'east': east,
                        'west': west,
                        'network_type': 'drive',
                        'simplify': True,
                        'retain_all': True,
                        'clean_periphery': True,
                        'truncate_by_edge': True
                    }
                    
                    # Executa em uma thread separada com timeout
                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        future = executor.submit(ox.graph_from_bbox, **graph_args)
                        result = future.result(timeout=300)  # 5 minutos de timeout
                        
                        if result is not None and len(result.nodes) > 0:
                            return result
                        
                        # Se chegou aqui, o grafo está vazio
                        self.logger.warning("O grafo retornado está vazio. Tentando novamente...")
                        time.sleep(5)  # Pequena pausa antes de tentar novamente
                        
                except concurrent.futures.TimeoutError:
                    self.logger.warning(f"Timeout ao baixar célula. Tentando novamente...")
                    time.sleep(10)  # Pausa maior para timeouts
                    continue
                    
                except Exception as e:
                    # Converte a mensagem de erro para string de forma segura
                    try:
                        error_msg = str(e).lower()
                        self.logger.warning("Erro ao baixar célula: %s", error_msg)
                    except Exception as log_err:
                        self.logger.warning("Erro ao baixar célula (erro ao formatar mensagem: %s)", str(log_err))
                    
                    # Se for um erro de rede ou servidor, tenta o próximo servidor imediatamente
                    try:
                        if any(err in str(e).lower() for err in ['connection', 'timeout', 'unavailable']):
                            self.logger.warning("Problema de conectividade com o servidor. Tentando próximo servidor...")
                            break  # Sai do loop de tentativas e tenta o próximo servidor
                    except Exception as log_err:
                        self.logger.warning("Erro ao verificar tipo de erro: %s", str(log_err))
                        break
                        
                    # Para outros erros, espera um pouco antes de tentar novamente
                    try:
                        wait_time = min(retry_delay * (2 ** attempt), MAX_RETRY_DELAY)
                        self.logger.info("Aguardando %d segundos antes de tentar novamente...", wait_time)
                        time.sleep(wait_time)
                    except Exception as log_err:
                        self.logger.warning("Erro ao aguardar: %s", str(log_err))
                        time.sleep(5)  # Fallback para um tempo fixo em caso de erro
            
            server_attempts += 1
            
            # Se tentou todos os servidores, faz uma pausa maior
            if server_attempts % len(OVERPASS_SERVERS) == 0:
                wait_time = min(300, 60 * (server_attempts // len(OVERPASS_SERVERS)))  # Até 5 minutos
                self.logger.warning(f"Tentando todos os servidores novamente após {wait_time} segundos...")
                time.sleep(wait_time)
        
        self.logger.error("Falha ao baixar célula após várias tentativas em diferentes servidores")
        return None
        
    def _load_cell_from_cache(self, cache_key: str) -> Optional[nx.MultiDiGraph]:
        """
        Tenta carregar uma célula do cache local com tratamento de erros aprimorado.
        
        Args:
            cache_key: Chave única para identificar o cache da célula
            
        Returns:
            nx.MultiDiGraph: Grafo da célula se encontrado no cache, None caso contrário
        """
        try:
            # Inicializa o cache em memória se não existir
            if not hasattr(self, '_graph_cache'):
                self._graph_cache = {}
            
            # Verifica no cache em memória primeiro (mais rápido)
            if cache_key in self._graph_cache:
                self.logger.debug(f"Cache HIT (memória) para chave: {cache_key}")
                return self._graph_cache[cache_key]
            
            # Se não estiver em memória, tenta carregar do disco
            cache_dir = Path("cache")
            cache_file = cache_dir / f"{cache_key}.graphml"
            
            if not cache_file.exists():
                self.logger.debug(f"Cache MISS - Arquivo não encontrado: {cache_file}")
                return None
                
            try:
                # Tenta carregar o grafo com timeout para evitar travamentos
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(ox.load_graphml, cache_file)
                    graph = future.result(timeout=10)  # Timeout de 10 segundos
                
                if graph is not None and len(graph.nodes) > 0:
                    # Adiciona ao cache em memória para próximas requisições
                    self._graph_cache[cache_key] = graph
                    self.logger.info(f"Célula carregada do cache (disco): {cache_key}")
                    return graph
                else:
                    self.logger.warning(f"Arquivo de cache vazio ou inválido: {cache_file}")
                    
            except concurrent.futures.TimeoutError:
                self.logger.warning(f"Timeout ao carregar do cache: {cache_file}")
            except Exception as e:
                self.logger.warning(f"Erro ao carregar célula do cache {cache_file}: {str(e)}")
                
                # Se o arquivo de cache estiver corrompido, remove-o
                try:
                    cache_file.unlink()
                    self.logger.info(f"Arquivo de cache corrompido removido: {cache_file}")
                except Exception as e2:
                    self.logger.warning(f"Falha ao remover arquivo de cache corrompido {cache_file}: {str(e2)}")
            
        except Exception as e:
            self.logger.error(f"Erro inesperado em _load_cell_from_cache: {str(e)}", exc_info=True)
            
        return None
        
    def _save_cell_to_cache(self, cache_key: str, graph: nx.MultiDiGraph) -> None:
        """
        Salva uma célula no cache local (memória e disco) de forma segura e eficiente.
        
        Args:
            cache_key: Chave única para identificar o cache da célula
            graph: Grafo a ser armazenado em cache
        """
        if graph is None or len(graph.nodes) == 0:
            self.logger.warning(f"Tentativa de salvar grafo vazio no cache com chave: {cache_key}")
            return
            
        try:
            # 1. Salva no cache em memória
            if not hasattr(self, '_graph_cache'):
                self._graph_cache = {}
            self._graph_cache[cache_key] = graph
            
            # 2. Prepara o diretório de cache
            cache_dir = Path("cache")
            try:
                cache_dir.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                self.logger.error(f"Falha ao criar diretório de cache: {e}")
                return
                
            cache_file = cache_dir / f"{cache_key}.graphml"
            
            # 3. Cria um arquivo temporário primeiro para evitar corrupção
            temp_file = cache_file.with_suffix(".tmp")
            
            try:
                # Tenta salvar em um arquivo temporário primeiro
                ox.save_graphml(graph, temp_file)
                
                # Se chegou aqui, o salvamento foi bem-sucedido
                # Renomeia o arquivo temporário para o nome final
                if temp_file.exists():
                    # Remove o arquivo de destino se ele existir
                    if cache_file.exists():
                        try:
                            cache_file.unlink()
                        except Exception as e:
                            self.logger.warning(f"Falha ao remover arquivo de cache existente {cache_file}: {e}")
                    
                    # Renomeia o arquivo temporário
                    temp_file.rename(cache_file)
                    self.logger.debug(f"Célula salva com sucesso no cache: {cache_file}")
                
            except Exception as e:
                self.logger.error(f"Erro ao salvar célula no cache {cache_file}: {e}")
                
                # Remove o arquivo temporário em caso de erro
                if temp_file.exists():
                    try:
                        temp_file.unlink()
                    except Exception as e:
                        self.logger.warning(f"Falha ao remover arquivo temporário {temp_file}: {e}")
                        
        except Exception as e:
            self.logger.error(f"Erro inesperado em _save_cell_to_cache: {e}", exc_info=True)
    
    def _should_skip_cell(self, cell_north: float, cell_south: float, 
                         cell_east: float, cell_west: float, points: List[Point]) -> bool:
        """
        Verifica se uma célula pode ser pulada porque não contém pontos de interesse.
        
        Args:
            cell_north: Limite norte da célula em graus
            cell_south: Limite sul da célula em graus
            cell_east: Limite leste da célula em graus
            cell_west: Limite oeste da célula em graus
            points: Lista de pontos a serem verificados
            
        Returns:
            bool: True se a célula pode ser pulada, False caso contrário
        """
        # Verificação rápida se não há pontos
        if not points:
            return True
            
        # Ordena os pontos para busca binária (melhor performance para muitos pontos)
        sorted_lats = sorted(p.lat for p in points)
        sorted_lngs = sorted(p.lng for p in points)
        
        # Verifica se há pontos dentro dos limites da célula usando busca binária
        # para melhor performance com muitos pontos
        lat_in_range = any(
            cell_south <= lat <= cell_north 
            for lat in sorted_lats[
                bisect.bisect_left(sorted_lats, cell_south):
                bisect.bisect_right(sorted_lats, cell_north)
            ]
        )
        
        # Se não há pontos na faixa de latitude, pode pular
        if not lat_in_range:
            return True
            
        # Verifica longitude apenas para pontos dentro da faixa de latitude
        lng_in_range = any(
            cell_west <= lng <= cell_east 
            for lng in sorted_lngs[
                bisect.bisect_left(sorted_lngs, cell_west):
                bisect.bisect_right(sorted_lngs, cell_east)
            ]
        )
        
        # Retorna True se não há pontos dentro da célula
        return not (lat_in_range and lng_in_range)
        
    def _get_bounding_box(self, points: List[Point], padding_km: float = 2.0) -> Tuple[float, float, float, float]:
        """
        Calcula a caixa delimitadora que contém todos os pontos com uma margem de segurança.
        
        Args:
            points: Lista de pontos a serem incluídos
            padding_km: Margem de segurança em quilômetros
            
        Returns:
            Tuple com (north, south, east, west) em graus
        """
        if not points:
            raise ValueError("Nenhum ponto fornecido para calcular a caixa delimitadora")
            
        # Converte a margem de km para graus (aproximadamente 111km por grau)
        padding_deg = padding_km / 111.0
        
        # Encontra os limites atuais
        lats = [p.lat for p in points]
        lngs = [p.lng for p in points]
        
        # Adiciona uma margem de segurança
        north = max(lats) + padding_deg
        south = min(lats) - padding_deg
        east = max(lngs) + padding_deg
        west = min(lngs) - padding_deg
        
        # Garante que a área mínima seja de 0.01 grau quadrado
        min_size = 0.01
        if (north - south) < min_size:
            center = (north + south) / 2
            north = center + min_size/2
            south = center - min_size/2
            
        if (east - west) < min_size:
            center = (east + west) / 2
            east = center + min_size/2
            west = center - min_size/2
            
        return north, south, east, west
        
    def _load_large_area_map(self, points: List[Point], center_lat: float, 
                            center_lng: float, max_span_km: float) -> bool:
        """Carrega um mapa para uma área muito grande, dividindo em múltiplos mapas menores.
        
        Args:
            points: Lista de pontos a serem cobertos pelo mapa
            center_lat: Latitude do centro da área
            center_lng: Longitude do centro da área
            max_span_km: Tamanho máximo da área em quilômetros
            
        Returns:
            bool: True se o carregamento foi bem-sucedido, False caso contrário
        """
        try:
            self.logger.info(f"Iniciando carregamento de mapa para área grande ({max_span_km:.1f}km)")
            
            # Aumenta o tamanho da célula para reduzir o número de requisições
            cell_size_km = 10.0  # Aumentado para 10km para reduzir o número de células
            
            # Converte para graus (aproximado)
            cell_size_deg = cell_size_km / 111.0
            
            # Configurações do OSMnx
            ox.settings.timeout = 300  # 5 minutos de timeout
            ox.settings.memory = None  # Desativa cache em memória para evitar duplicação
            ox.settings.log_console = False  # Reduz log no console
            ox.settings.use_cache = True  # Habilita cache em disco
            ox.settings.cache_folder = "cache/osmnx"
            
            # Cria diretório de cache se não existir
            Path(ox.settings.cache_folder).mkdir(parents=True, exist_ok=True)
            
            # Inicializa o grafo vazio
            self.graph = nx.MultiDiGraph()
            
            # 1. Primeiro, identifica as células que contêm pontos de interesse
            cells_to_load = set()
            
            for point in points:
                # Calcula a posição relativa do ponto em relação ao centro
                lat_diff = (point.lat - center_lat) / cell_size_deg
                lng_diff = (point.lng - center_lng) / (cell_size_deg * max(0.1, math.cos(math.radians(center_lat))))
                
                # Determina a célula do ponto
                i = int(round(lat_diff))
                j = int(round(lng_diff))
                
                # Adiciona a célula e células vizinhas para garantir cobertura
                for di in [-1, 0, 1]:
                    for dj in [-1, 0, 1]:
                        cells_to_load.add((i + di, j + dj))
            
            self.logger.info(f"Identificadas {len(cells_to_load)} células relevantes para carregar")
            
            if not cells_to_load:
                self.logger.error("Nenhuma célula identificada para carregar")
                return False
            
            # Carrega cada célula necessária
            loaded_cells = 0
            
            for cell_idx, (i, j) in enumerate(cells_to_load, 1):
                try:
                    # Calcula os limites da célula atual
                    cell_north = center_lat + (i + 0.5) * cell_size_deg
                    cell_south = center_lat + (i - 0.5) * cell_size_deg
                    cell_west = center_lng + (j - 0.5) * cell_size_deg
                    cell_east = center_lng + (j + 0.5) * cell_size_deg
                    
                    self.logger.info(f"Processando célula {cell_idx}/{len(cells_to_load)} "
                                  f"({i},{j}): "
                                  f"Lat [{cell_south:.6f} a {cell_north:.6f}], "
                                  f"Lng [{cell_west:.6f} a {cell_east:.6f}]")
                    
                    # Gera uma chave de cache única para esta célula
                    cache_key = f"{cell_north:.6f}_{cell_south:.6f}_{cell_east:.6f}_{cell_west:.6f}"
                    cache_key = hashlib.md5(cache_key.encode()).hexdigest()
                    
                    # Tenta carregar do cache primeiro
                    cell_graph = self._load_cell_from_cache(cache_key)
                    
                    # Se não encontrou no cache, baixa da API com retentativa
                    if cell_graph is None:
                        cell_graph = self._download_cell_with_retry(
                            north=cell_north,
                            south=cell_south,
                            east=cell_east,
                            west=cell_west
                        )
                        
                        # Se conseguiu baixar, salva no cache
                        if cell_graph is not None and len(cell_graph.nodes) > 0:
                            self._save_cell_to_cache(cache_key, cell_graph)
                    
                    # Combina com o grafo principal se conseguiu carregar a célula
                    if cell_graph and cell_graph.number_of_nodes() > 0:
                        # Adiciona metadados à célula para depuração
                        for _, data in cell_graph.nodes(data=True):
                            data['cell'] = f"{i}_{j}"
                            
                        # Combina com o grafo principal
                        self.graph = nx.compose(self.graph, cell_graph)
                        loaded_cells += 1
                        
                        self.logger.info(f"Célula {i},{j} carregada com sucesso. "
                                      f"Nós: {cell_graph.number_of_nodes()}, "
                                      f"Total acumulado: {self.graph.number_of_nodes()}")
                    
                    # Pequena pausa entre requisições para evitar sobrecarga
                    time.sleep(0.5)
                    
                except Exception as e:
                    self.logger.error(f"Erro ao processar célula {i},{j}: {str(e)}", exc_info=True)
                    time.sleep(5)  # Pausa maior em caso de erro
            
            # Verifica se o grafo foi carregado corretamente
            if self.graph is None or len(self.graph.nodes) == 0:
                self.logger.error("Falha ao carregar o mapa da área grande - nenhum nó carregado")
                return False
                
            self.logger.info(f"Mapa grande carregado com sucesso. "
                           f"Células: {loaded_cells}, "
                           f"Nós: {self.graph.number_of_nodes()}, "
                           f"Arestas: {self.graph.number_of_edges()}")
            
            # Verifica se todos os pontos estão próximos a uma via
            valid_points = 0
            for point in points:
                try:
                    # Encontra o nó mais próximo
                    nearest_node = ox.distance.nearest_nodes(
                        self.graph, 
                        point.lng, 
                        point.lat
                    )
                    valid_points += 1
                except Exception as e:
                    self.logger.warning(f"Ponto {point.id} ({point.lat}, {point.lng}) não está próximo a nenhuma via: {str(e)}")
            
            if valid_points < len(points):
                self.logger.warning(f"Apenas {valid_points} de {len(points)} pontos estão próximos a vias.")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Erro ao carregar mapa grande: {str(e)}", exc_info=True)
            return False
    
    def _load_large_area_map(self, points: List[Point], center_lat: float, 
                                   center_lng: float, max_span_km: float) -> bool:
        """Carrega um mapa para uma área muito grande, dividindo em múltiplos mapas menores.
        
        Args:
            points: Lista de pontos a serem cobertos pelo mapa
            center_lat: Latitude do centro da área
            center_lng: Longitude do centro da área
            max_span_km: Tamanho máximo da área em quilômetros
            
        Returns:
            bool: True se o carregamento foi bem-sucedido, False caso contrário
        """
        try:
            self.logger.info(f"Iniciando carregamento de área grande (span: {max_span_km:.1f}km)")
            
            # Converte km para graus (aproximadamente 111km por grau)
            def km_to_degrees(km, lat=None):
                if lat is None:
                    lat = center_lat
                return km / (111.0 * (1.0 if lat == 0 else math.cos(math.radians(lat))))
            
            # Calcula os limites da área total com margem adicional
            margin_km = 5.0  # 5km de margem adicional
            margin_deg = km_to_degrees(margin_km)
            
            # Calcula a extensão total em graus com margem
            total_span_deg = km_to_degrees(max_span_km + 2 * margin_km)
            half_span_deg = total_span_deg / 2
            
            # Define os limites totais da área
            north = center_lat + half_span_deg
            south = center_lat - half_span_deg
            east = center_lng + half_span_deg
            west = center_lng - half_span_deg
            
            self.logger.info(f"Área total de cobertura: "
                          f"Latitude [{south:.6f} a {north:.6f}], "
                          f"Longitude [{west:.6f} a {east:.6f}]")
            
            # Tamanho da célula em graus (aproximadamente 10km x 10km)
            cell_size_km = 10.0
            cell_size_deg = km_to_degrees(cell_size_km)
            
            # Garante que o tamanho da célula seja razoável
            min_cell_size_km = 5.0  # Mínimo de 5km
            max_cell_size_km = 20.0  # Máximo de 20km
            
            cell_size_km = max(min_cell_size_km, min(max_cell_size_km, max_span_km / 5))
            cell_size_deg = km_to_degrees(cell_size_km)
            
            self.logger.info(f"Tamanho da célula: {cell_size_km:.2f}km (~{cell_size_deg:.6f}°)")
            
            # Número de células em cada direção
            num_cells_lat = math.ceil(total_span_deg / cell_size_deg)
            num_cells_lng = math.ceil(total_span_deg / cell_size_deg)
            
            self.logger.info(f"Dividindo área em {num_cells_lat}x{num_cells_lng} células")
            
            # Inicializa o grafo vazio
            self.graph = nx.MultiDiGraph()
            
            # Calcula quais células contêm pontos e devem ser carregadas
            cells_to_load = set()
            
            for point in points:
                # Calcula a célula para este ponto
                lat_idx = int((point.lat - south) / cell_size_deg)
                lng_idx = int((point.lng - west) / cell_size_deg)
                
                # Garante que os índices estão dentro dos limites
                lat_idx = max(0, min(num_cells_lat - 1, lat_idx))
                lng_idx = max(0, min(num_cells_lng - 1, lng_idx))
                
                cells_to_load.add((lat_idx, lng_idx))
                
                # Adiciona células vizinhas para garantir cobertura
                for di in [-1, 0, 1]:
                    for dj in [-1, 0, 1]:
                        ni, nj = lat_idx + di, lng_idx + dj
                        if 0 <= ni < num_cells_lat and 0 <= nj < num_cells_lng:
                            cells_to_load.add((ni, nj))
            
            self.logger.info(f"Total de células a carregar: {len(cells_to_load)}")
            
            if not cells_to_load:
                self.logger.error("Nenhuma célula para carregar")
                return False
            
            # Tamanho da célula em km (5x5 km)
            CELL_SIZE_KM = 5.0
            # Graus por km (aproximadamente)
            DEGREES_PER_KM = 1.0 / 111.0
            
            # Calcula o tamanho da célula em graus
            cell_size_deg = CELL_SIZE_KM * DEGREES_PER_KM
            
            # Determina quantas células são necessárias em cada direção
            # Adiciona uma margem de 2 células em cada lado
            num_cells = int(math.ceil(max_span_km / CELL_SIZE_KM)) + 4
            half_cells = num_cells // 2
            
            self.logger.info(f"Dividindo área em células de {CELL_SIZE_KM}km x {CELL_SIZE_KM}km")
            
            # Inicializa o grafo vazio
            self.graph = nx.MultiDiGraph()
            
            # Conjunto para armazenar as coordenadas dos pontos
            point_coords = {(p.lat, p.lng) for p in points}
            
            # Contador de células processadas
            cells_processed = 0
            cells_with_points = 0
            
            # Processa apenas as células que contêm pontos
            for i in range(-half_cells, half_cells + 1):
                for j in range(-half_cells, half_cells + 1):
                    # Calcula os limites da célula
                    cell_north = center_lat + (i + 0.5) * cell_size_deg
                    cell_south = center_lat + (i - 0.5) * cell_size_deg
                    cell_west = center_lng + (j - 0.5) * cell_size_deg
                    cell_east = center_lng + (j + 0.5) * cell_size_deg
                    
                    # Verifica se há pontos nesta célula
                    has_points = any(
                        cell_south <= lat <= cell_north and 
                        cell_west <= lng <= cell_east
                        for lat, lng in point_coords
                    )
                    
                    if not has_points:
                        continue
                        
                    cells_with_points += 1
                    cells_processed += 1
                    
                    # Gera uma chave de cache para esta célula
                    cache_key = f"cell_{i}_{j}_{cell_north:.6f}_{cell_south:.6f}_{cell_east:.6f}_{cell_west:.6f}"
                    cache_key = hashlib.md5(cache_key.encode()).hexdigest()
                    cache_file = self.cache_dir / f"{cache_key}.graphml"
                    
                    # Tenta carregar do cache primeiro
                    cell_graph = None
                    if cache_file.exists():
                        try:
                            cell_graph = ox.load_graphml(cache_file)
                            self.logger.debug(f"Carregada célula do cache: {cache_file}")
                        except Exception as e:
                            self.logger.warning(f"Erro ao carregar célula do cache {cache_file}: {e}"
                                            " - Baixando novamente...")
                    
                    # Se não encontrou no cache, baixa a célula
                    if cell_graph is None:
                        try:
                            self.logger.debug(f"Baixando célula {cells_processed}: "
                                          f"north={cell_north:.6f}, south={cell_south:.6f}, "
                                          f"east={cell_east:.6f}, west={cell_west:.6f}")
                            
                            cell_graph = ox.graph_from_bbox(
                                north=cell_north,
                                south=cell_south,
                                east=cell_east,
                                west=cell_west,
                                network_type='drive',
                                simplify=True,
                                retain_all=True,
                                truncate_by_edge=True
                            )
                            
                            # Salva no cache para uso futuro
                            try:
                                ox.save_graphml(cell_graph, filepath=cache_file)
                                self.logger.debug(f"Célula salva no cache: {cache_file}")
                            except Exception as e:
                                self.logger.warning(f"Erro ao salvar célula no cache {cache_file}: {e}")
                                
                        except Exception as e:
                            self.logger.error(f"Erro ao baixar célula: {e}")
                            continue
                    
                    # Combina o grafo da célula com o grafo principal
                    if cell_graph is not None and len(cell_graph.nodes) > 0:
                        self.graph = nx.compose(self.graph, cell_graph)
            
            self.logger.info(f"Processamento concluído. {cells_with_points} células com pontos processadas.")
            
            if len(self.graph.nodes) == 0:
                self.logger.error("Nenhum dado de mapa foi baixado.")
                return False
                
            self.logger.info(f"Grafo final com {len(self.graph.nodes)} nós e {len(self.graph.edges)} arestas.")
            return True
            
        except Exception as e:
            self.logger.error(f"Erro ao carregar mapa de grande área: {str(e)}", exc_info=True)
            return False

    def _load_map_for_points(self, points: List[Point], cell_size_km: float = 5.0, 
                           margin_km: float = 10.0, force_download: bool = True) -> bool:
        """Carrega o grafo para a área dos pontos fornecidos com uma margem segura.
        
        Args:
            points: Lista de pontos a serem cobertos pelo mapa
            cell_size_km: Tamanho das células em km (padrão: 5x5km)
            margin_km: Margem de segurança em km ao redor dos pontos (padrão: 10km)
            force_download: Se True, força o download mesmo se existir em cache
            
        Returns:
            bool: True se o carregamento foi bem-sucedido, False caso contrário
        """
        if not points:
            self.logger.error("Nenhum ponto fornecido para carregar o mapa")
            return False
            
        # Funções auxiliares para conversão de unidades
        def km_to_deg_lat(km):
            """Converte quilômetros para graus de latitude."""
            return km / 111.0  # 1° latitude ≈ 111 km
            
        def km_to_deg_lon(km, lat):
            """Converte quilômetros para graus de longitude, considerando a latitude."""
            return km / (111.320 * math.cos(math.radians(lat)))
            
        # 1. Extrai coordenadas de todos os pontos
        lats = [p.lat for p in points]
        lngs = [p.lng for p in points]
        
        # 2. Calcula o bounding box bruto
        min_lat = min(lats)
        max_lat = max(lats)
        min_lng = min(lngs)
        max_lng = max(lngs)
        
        # 3. Calcula o centro para conversão de margens
        center_lat = (min_lat + max_lat) / 2
        
        # 4. Adiciona margem em graus (considerando a curvatura da Terra)
        lat_margin = km_to_deg_lat(margin_km)
        lon_margin = km_to_deg_lon(margin_km, center_lat)
        
        min_lat -= lat_margin
        max_lat += lat_margin
        min_lng -= lon_margin
        max_lng += lon_margin
        
        # 5. Log do bounding box final
        self.logger.info(f"Área de cobertura com margem de {margin_km}km:")
        self.logger.info(f"  Latitude:  [{min_lat:.6f}, {max_lat:.6f}] (Δ{(max_lat-min_lat)*111:.1f}km)")
        self.logger.info(f"  Longitude: [{min_lng:.6f}, {max_lng:.6f}] (Δ{(max_lng-min_lng)*111*math.cos(math.radians(center_lat)):.1f}km)")
        
        # 6. Calcula a extensão total em km
        lat_span_km = (max_lat - min_lat) * 111.0  # 1° ≈ 111km
        lon_span_km = (max_lng - min_lng) * 111.0 * math.cos(math.radians(center_lat))
        max_span_km = max(lat_span_km, lon_span_km)
        
        # 7. Se a área for muito grande ou forçado o download, usa abordagem de células
        if max_span_km > 50 or force_download:
            self.logger.info(f"Área grande detectada ({max_span_km:.1f}km). Carregando mapa em células de {cell_size_km}x{cell_size_km}km...")
            
            # Limpa o cache apenas se forçado
            if force_download:
                cache_dir = Path("map_cache")
                if cache_dir.exists():
                    for file in cache_dir.glob("*.graphml"):
                        try:
                            file.unlink()
                            self.logger.debug(f"Arquivo de cache removido: {file}")
                        except Exception as e:
                            self.logger.warning(f"Erro ao remover cache {file}: {e}")
            
            # Calcula o ponto central para o carregamento
            center_lat = (min_lat + max_lat) / 2
            center_lng = (min_lng + max_lng) / 2
            
            return self._load_large_area_map(points, center_lat, center_lng, max_span_km)
        
        return False
        
        # Para áreas menores, usa a abordagem normal com margens
        min_margin = 0.18  # ~20km em graus decimais
        lat_margin = max(lat_span * 0.5, min_margin)
        lng_margin = max(lng_span * 0.5, min_margin)
        
        # Calcula os limites iniciais
        north = max(lats) + lat_margin
        south = min(lats) - lat_margin
        east = max(lngs) + lng_margin
        west = min(lngs) - lng_margin
        
        # Garante limites mínimos de área (aproximadamente 30km x 30km)
        min_span = 0.27  # ~30km em graus decimais
        if (north - south) < min_span or (east - west) < min_span:
            half_span = min_span / 2
            north = center_lat + half_span
            south = center_lat - half_span
            east = center_lng + half_span
            west = center_lng - half_span
        
        # Tenta carregar o mapa em camadas, expandindo se necessário
        max_attempts = 3
        expansion_factor = 1.5  # Expande 50% a cada tentativa
        
        for attempt in range(max_attempts):
            # Gera uma chave de cache baseada na área
            cache_key = f"{north:.6f}_{south:.6f}_{east:.6f}_{west:.6f}"
            cache_file = self.cache_dir / f"map_{hashlib.md5(cache_key.encode()).hexdigest()}.graphml"
            
            # Tenta carregar do cache apenas se não for forçado o download
            if not force_download and cache_file.exists():
                try:
                    self.graph = ox.load_graphml(cache_file)
                    self.logger.info(f"Loaded graph with {len(self.graph.nodes)} nodes and {len(self.graph.edges)} "
                                  f"edges from '{cache_file}'")
                    return True
                except Exception as e:
                    self.logger.warning(f"Error loading cached graph: {e}. Will download a new one.")
            
            # Se não encontrou no cache ou ocorreu erro, baixa o grafo
            try:
                self.logger.info(f"Attempt {attempt + 1}: Downloading graph for area: "
                              f"north={north:.6f}, south={south:.6f}, east={east:.6f}, west={west:.6f}")
                
                self.graph = ox.graph_from_bbox(
                    north=north,
                    south=south,
                    east=east,
                    west=west,
                    network_type='drive',
                    simplify=True,
                    retain_all=True,
                    clean_periphery=True
                )
                
                # Verifica se o grafo tem nós suficientes
                if len(self.graph.nodes) > 10:  # Número mínimo arbitrário de nós
                    # Salva no cache para uso futuro
                    if not self.cache_dir.exists():
                        self.cache_dir.mkdir(parents=True, exist_ok=True)
                    ox.save_graphml(self.graph, cache_file)
                    self.logger.info(f"Saved graph with {len(self.graph.nodes)} nodes and {len(self.graph.edges)} "
                                  f"edges to '{cache_file}'")
                    return True
                else:
                    self.logger.warning(f"Graph too small ({len(self.graph.nodes)} nodes). Will try with a larger area.")
                
            except Exception as download_error:
                self.logger.error(f"Erro ao baixar o mapa: {str(download_error)}")
                # Tenta carregar um grafo menor como fallback
                try:
                    self.logger.info("Tentando carregar um grafo menor como fallback...")
                    self.graph = ox.graph_from_point(
                        ((north + south)/2, (east + west)/2),
                        dist=5000,  # 5km radius
                        network_type='drive',
                        simplify=True
                    )
                    if self.graph is not None and len(self.graph.nodes) > 10:
                        self.logger.info(f"Grafo de fallback carregado. Nós: {len(self.graph.nodes)}")
                        ox.save_graphml(self.graph, cache_file)
                        return True
                except Exception as fallback_error:
                    self.logger.error(f"Erro ao carregar grafo de fallback: {str(fallback_error)}")
            
            # Expande a área para a próxima tentativa
            lat_center = (north + south) / 2
            lng_center = (east + west) / 2
            lat_span = (north - south) * expansion_factor
            lng_span = (east - west) * expansion_factor
            
            north = lat_center + lat_span/2
            south = lat_center - lat_span/2
            east = lng_center + lng_span/2
            west = lng_center - lng_span/2
            
            # Limita o tamanho máximo da área (aproximadamente 100km x 100km)
            max_span = 0.9  # ~100km em graus decimais
            if lat_span > max_span or lng_span > max_span:
                self.logger.warning("Reached maximum area size. Using the largest available graph.")
                if hasattr(self, 'graph') and len(self.graph.nodes) > 0:
                    return True
        
        # Expande a área para a próxima tentativa
        lat_center = (north + south) / 2
        lng_center = (east + west) / 2
        lat_span = (north - south) * expansion_factor
        lng_span = (east - west) * expansion_factor
        
    def _validate_data(self, points: List[Point], vehicles: List[Vehicle]) -> None:
        """Valida os dados de entrada para o roteamento.
        
        Args:
            points: Lista de pontos a serem visitados
            vehicles: Lista de veículos disponíveis
            
        Raises:
            ValueError: Se os dados de entrada forem inválidos
        """
        if not points:
            raise ValueError("Nenhum ponto de entrega ou coleta fornecido")
            
        if not vehicles:
            raise ValueError("Nenhum veículo disponível")
            
        # Verifica se há pelo menos um ponto
        if len(points) < 1:
            raise ValueError("É necessário pelo menos um ponto para roteamento")
            
        # O primeiro ponto é considerado o ponto de partida
        start_point = points[0]
        self.logger.info(f"Ponto de partida definido:")
        self.logger.info(f"- ID: {start_point.id}")
        self.logger.info(f"- Tipo: {start_point.type}")
        self.logger.info(f"- Nome: {getattr(start_point, 'name', 'Não informado')}")
        self.logger.info(f"- Coordenadas: ({start_point.lat}, {start_point.lng})")
        
        # Verifica se há pelo menos um ponto adicional para roteamento
        if len(points) < 2:
            self.logger.warning("Apenas um ponto fornecido. Nenhuma rota será gerada.")
            
        # Verifica se há pontos de entrega/coleta (opcional, já que qualquer ponto pode ser um destino)
        has_multiple_points = len(points) > 1
            
        # Valida os veículos
        self.logger.info("Validando veículos...")
        for i, vehicle in enumerate(vehicles):
            self.logger.info(f"Veículo {i+1}:")
            self.logger.info(f"- ID: {vehicle.id}")
            self.logger.info(f"- Nome: {getattr(vehicle, 'name', 'Não informado')}")
            
            # Mapeia os campos do JSON para o modelo
            if hasattr(vehicle, 'max_weight') and not hasattr(vehicle, 'capacity'):
                vehicle.capacity = vehicle.max_weight
                self.logger.info(f"Usando max_weight ({vehicle.max_weight}) como capacidade")
            
            # Define valores padrão se não estiverem presentes
            if not hasattr(vehicle, 'capacity') or vehicle.capacity is None:
                vehicle.capacity = 8000  # Valor padrão baseado no JSON
                self.logger.warning(f"Capacidade não definida para o veículo {i+1}. Usando valor padrão: 8000")
            
            if not hasattr(vehicle, 'cost_per_km') or vehicle.cost_per_km is None:
                vehicle.cost_per_km = 1.0  # Valor padrão
                self.logger.warning(f"Custo por km não definido para o veículo {i+1}. Usando valor padrão: 1.0")
            
            if not hasattr(vehicle, 'fixed_cost') or vehicle.fixed_cost is None:
                vehicle.fixed_cost = 0.0  # Valor padrão
                self.logger.warning(f"Custo fixo não definido para o veículo {i+1}. Usando valor padrão: 0.0")
            
            # Valida os valores
            if vehicle.capacity <= 0:
                self.logger.error(f"Capacidade inválida ({vehicle.capacity}) para o veículo {i+1}")
                raise ValueError(f"Capacidade inválida para o veículo {i+1}")
                
            if vehicle.cost_per_km < 0:
                self.logger.warning(f"Custo por km negativo para o veículo {i+1}. Convertendo para positivo.")
                vehicle.cost_per_km = abs(vehicle.cost_per_km)
                
            if vehicle.fixed_cost < 0:
                self.logger.warning(f"Custo fixo negativo para o veículo {i+1}. Convertendo para positivo.")
                vehicle.fixed_cost = abs(vehicle.fixed_cost)
                
            self.logger.info(f"- Capacidade: {vehicle.capacity}")
            self.logger.info(f"- Custo por km: {vehicle.cost_per_km}")
            self.logger.info(f"- Custo fixo: {vehicle.fixed_cost}")
    
    def solve_from_json(self, data: Dict, method: str = 'vnd', **kwargs) -> Dict:
        """Resolve o problema de roteamento a partir de um dicionário JSON.
        
        Args:
            data: Dicionário com os dados do problema
            method: Método de resolução a ser utilizado
            **kwargs: Parâmetros adicionais:
                - force_download: Força o download de um novo mapa (padrão: True)
                
        Returns:
            dict: Solução do problema de roteamento
            
        Raises:
            ValueError: Se os dados de entrada forem inválidos
        """
        try:
            # Limpa dados anteriores
            self.points = {}
            
            # Obtém parâmetros adicionais
            force_download = kwargs.pop('force_download', True)
            self.vehicles = {}
            self.graph = None
            
            # Converte os dados de entrada
            points, vehicles = self.from_json(data)
            
            # Valida os dados de entrada
            self._validate_data(points, vehicles)
            
            if not points:
                raise ValueError("Nenhum ponto fornecido para otimização")
                
            if not vehicles:
                raise ValueError("Nenhum veículo fornecido para otimização")
            
            # Adiciona pontos e veículos ao roteador
            self.add_points(points)
            self.add_vehicles(vehicles)
            
            # Tenta carregar o mapa para os pontos
            max_attempts = 2
            for attempt in range(max_attempts):
                try:
                    # Na primeira tentativa, tenta com cache. Na segunda, força download
                    current_force_download = (attempt > 0) or force_download
                    self.logger.info(f"Tentativa {attempt + 1}/{max_attempts} - "
                                  f"Forçar download: {current_force_download}")
                    
                    if not self._load_map_for_points(points, force_download=current_force_download):
                        raise ValueError("Não foi possível carregar o mapa para os pontos fornecidos.")
                    
                    # Valida os dados
                    self._validate_data(points, vehicles)
                    break  # Se chegou aqui, os dados são válidos
                    
                except ValueError as ve:
                    if attempt == max_attempts - 1:  # Última tentativa
                        self.logger.error("Todas as tentativas de carregar o mapa falharam")
                        raise
                    self.logger.warning(f"Tentativa {attempt + 1} falhou: {str(ve)}")
                    time.sleep(1)  # Pequena pausa antes de tentar novamente
            
            # Resolve o problema
            return self.solve_vrp(method=method, **kwargs)
            
        except Exception as e:
            self.logger.error(f"Erro em solve_from_json: {str(e)}")
            raise
