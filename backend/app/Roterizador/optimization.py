"""
RobustRouter - Sistema Avançado de Roteirização
-----------------------------------------------
Combina mapas reais do OpenStreetMap com meta-heurísticas avançadas
para otimização de rotas com múltiplas restrições.
"""

import os
import json
import time
import csv
import hashlib
import random
import logging
import warnings
import copy
import traceback
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set, Deque
from collections import defaultdict, deque
from datetime import datetime, time as dt_time

import numpy as np
import pandas as pd
import networkx as nx
import osmnx as ox
from shapely.geometry import Point as ShapelyPoint

# Importa o novo módulo de visualização
from . import map_visualization

# Constantes
MAX_ITERATIONS = 100
TABU_TENURE = 10
GRASP_ITERATIONS = 50
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class Vehicle:
    """Classe para representar um veículo com restrições e capacidades."""
    id: str
    name: str
    capacity: float  # em kg
    max_weight: float  # em kg
    volume_capacity: float  # em m³
    length: float
    width: float
    height: float
    start_time: str
    end_time: str
    speed: float
    cost_per_km: float = 10.0
    driver_name: str = ""
    driver_phone: str = ""
    fixed_cost: float = 100.0
    skills: Set[str] = field(default_factory=set)

    @property
    def speed_mps(self) -> float:
        """Retorna a velocidade em metros/segundo."""
        return (self.speed * 1000) / 3600

@dataclass
class Point:
    """Classe para representar um ponto de entrega/coleta."""
    id: str
    type: str
    name: str
    address: str
    lat: float
    lng: float
    order: int
    quantity: int
    weight: float
    volume: float
    time_window_start: str
    time_window_end: str
    service_time: int
    priority: int
    required_skills: Set[str] = field(default_factory=set)
    notes: str = ""

    def __post_init__(self):
        if isinstance(self.required_skills, list):
            self.required_skills = set(self.required_skills)

class Route:
    """Classe para representar uma rota com métricas de desempenho."""
    def __init__(self, vehicle: Vehicle):
        self.vehicle = vehicle
        self.points: List[Point] = []
        self.distance: float = 0.0
        self.duration: float = 0.0
        self.cost: float = 0.0
        self.load: float = 0.0
        self.volume: float = 0.0
        self.time_windows_violation: float = 0.0
        self.capacity_violation: float = 0.0
        self.skill_requirements: Set[str] = set()

    def add_point(self, point: Point, distance: float, duration: float):
        """Adiciona um ponto à rota e atualiza as métricas."""
        self.points.append(point)
        self.distance += distance
        self.duration += duration
        self.load += point.weight * point.quantity
        self.volume += point.volume * point.quantity
        self.skill_requirements.update(point.required_skills)
        self.cost += (distance / 1000) * self.vehicle.cost_per_km
        if len(self.points) == 1:
            self.cost += self.vehicle.fixed_cost

    def is_feasible(self) -> bool:
        """Verifica se a rota é viável."""
        return (self.load <= self.vehicle.capacity and
                self.volume <= self.vehicle.volume_capacity and
                self.time_windows_violation == 0 and
                self.capacity_violation == 0 and
                self.skill_requirements.issubset(self.vehicle.skills))

class RobustRouter:
    """Classe principal para roteirização robusta com mapas reais."""
    def __init__(self, location: str = "São Paulo, Brazil", use_cache: bool = True):
        self.location = location
        self.use_cache = use_cache
        self.graph = None
        self.vehicles: List[Vehicle] = []
        self.points: List[Point] = []
        self.depot: Optional[Point] = None
        self.distance_matrix: Optional[np.ndarray] = None
        self.time_matrix: Optional[np.ndarray] = None
        self.solution: Dict[str, Any] = {}
        self.tabu_list: Deque[Any] = deque(maxlen=TABU_TENURE)
        
        if use_cache and not os.path.exists(CACHE_DIR):
            os.makedirs(CACHE_DIR, exist_ok=True)
        
        self.load_map()

    def _get_cache_filename(self, key: str) -> str:
        """Gera um nome de arquivo de cache."""
        return os.path.join(CACHE_DIR, f"{hashlib.md5(key.encode('utf-8')).hexdigest()}.graphml")

    def load_map(self) -> bool:
        """Carrega o mapa da localização, usando cache se disponível."""
        cache_file = self._get_cache_filename(f"map_{self.location}")
        if self.use_cache and os.path.exists(cache_file):
            try:
                logger.info(f"Carregando mapa do cache: {cache_file}")
                self.graph = ox.load_graphml(cache_file)
                logger.info("✓ Mapa carregado do cache.")
                return True
            except Exception as e:
                logger.warning(f"⚠️ Erro ao carregar mapa do cache: {e}")

        logger.info(f"Baixando mapa de: {self.location}. Isso pode levar alguns minutos...")
        try:
            self.graph = ox.graph_from_place(self.location, network_type='drive', simplify=True)
            if self.use_cache:
                ox.save_graphml(self.graph, cache_file)
            logger.info("✓ Mapa baixado e salvo em cache.")
            return True
        except Exception as e:
            logger.error(f"❌ Erro ao baixar o mapa: {e}")
            return False

    def solve_from_json(self, request_data: Dict, method: str = 'vnd', max_iterations: int = 100) -> Dict[str, Any]:
        """
        Wrapper para chamar solve_vrp a partir de um dicionário (JSON), que é o ponto de entrada do roteador.
        """
        logger.info("Iniciando processo de roteirização a partir de dados JSON.")
        return self.solve_vrp(request_data, method=method, max_iterations=max_iterations)

    def _time_to_minutes(self, time_str: str) -> int:
        """Converte tempo 'HH:MM' para minutos."""
        try:
            h, m = map(int, time_str.split(':'))
            return h * 60 + m
        except (ValueError, AttributeError):
            return 0

    def _create_vehicles(self, vehicles_data: List[Dict]) -> bool:
        """Cria objetos Vehicle a partir dos dados."""
        try:
            self.vehicles = [Vehicle(**v_data) for v_data in vehicles_data]
            logger.info(f"{len(self.vehicles)} veículos criados.")
            return True
        except Exception as e:
            logger.error(f"Erro ao criar veículos: {e}")
            return False

    def _create_points(self, points_data: List[Dict]) -> bool:
        """Cria objetos Point a partir dos dados."""
        try:
            self.points = []
            start_point_data = next((p for p in points_data if p.get('type') == 'start'), None)
            
            if start_point_data:
                self.depot = Point(**start_point_data)
                logger.info(f"Depósito definido em: {self.depot.address}")
            else:
                logger.warning("Ponto de partida (depósito) não encontrado. Usando o primeiro ponto como depósito.")
                if not points_data: return False
                self.depot = Point(**points_data[0])

            self.points = [Point(**p_data) for p_data in points_data if p_data.get('type') != 'start']
            logger.info(f"{len(self.points)} pontos de coleta criados.")
            return True
        except Exception as e:
            logger.error(f"Erro ao criar pontos: {e}")
            return False
            
    def _create_distance_time_matrices(self) -> bool:
        """Cria as matrizes de distância e tempo."""
        if self.graph is None or self.depot is None:
            logger.error("Grafo ou depósito não definidos.")
            return False
        
        try:
            all_points = [self.depot] + self.points
            n = len(all_points)
            self.distance_matrix = np.full((n, n), fill_value=np.inf)
            self.time_matrix = np.full((n, n), fill_value=np.inf)

            node_ids = [ox.distance.nearest_nodes(self.graph, p.lng, p.lat) for p in all_points]

            for i in range(n):
                for j in range(n):
                    if i == j:
                        self.distance_matrix[i, j] = 0
                        self.time_matrix[i, j] = 0
                        continue
                    try:
                        path = nx.shortest_path(self.graph, node_ids[i], node_ids[j], weight='length')
                        distance = sum(ox.utils_graph.get_route_edge_attributes(self.graph, path, 'length'))
                        # Assumindo velocidade média de 40 km/h se não houver dados
                        avg_speed_mps = (40 * 1000) / 3600
                        time = distance / avg_speed_mps
                        
                        self.distance_matrix[i, j] = distance
                        self.time_matrix[i, j] = time / 60  # em minutos
                    except (nx.NetworkXNoPath, nx.NodeNotFound):
                        # Fallback para distância em linha reta (Haversine)
                        lat1, lon1 = all_points[i].lat, all_points[i].lng
                        lat2, lon2 = all_points[j].lat, all_points[j].lng
                        R = 6371000 # Raio da Terra em metros
                        phi1, phi2 = np.radians(lat1), np.radians(lat2)
                        dphi = np.radians(lat2 - lat1)
                        dlambda = np.radians(lon2 - lon1)
                        a = np.sin(dphi/2)**2 + np.cos(phi1)*np.cos(phi2)*np.sin(dlambda/2)**2
                        distance = 2 * R * np.arctan2(np.sqrt(a), np.sqrt(1-a))
                        
                        self.distance_matrix[i, j] = distance * 1.4 # Fator de correção para estimar distância de rua
                        self.time_matrix[i, j] = (distance / ((40*1000)/3600)) / 60
            
            logger.info("Matrizes de distância e tempo calculadas.")
            return True
        except Exception as e:
            logger.error(f"Erro ao calcular matrizes: {e}", exc_info=True)
            return False

    def solve_vrp(self, request_data: Dict, method: str = 'vnd', max_iterations: int = 100) -> Dict[str, Any]:
        """Resolve o VRP com o método especificado."""
        logger.info(f"Iniciando otimização com método: {method.upper()}")

        if not self._create_vehicles(request_data.get('vehicles', [])) or not self.vehicles:
            return {"error": "Falha ao processar veículos."}
        if not self._create_points(request_data.get('points', [])) or not self.depot:
            return {"error": "Falha ao processar pontos."}
        if not self._create_distance_time_matrices():
            return {"error": "Falha ao criar matrizes de distância/tempo."}

        initial_solution = self._create_initial_solution()
        
        if method.lower() == 'vnd':
            final_solution = self._vnd_search(initial_solution, max_iterations)
        else:
            final_solution = initial_solution
            
        self.solution = final_solution
        logger.info("Otimização concluída.")
        return final_solution

    def _create_initial_solution(self) -> Dict[str, Any]:
        """Cria uma solução inicial gulosa."""
        start_time = time.time()
        routes = []
        unassigned_points = []
        points_to_assign = self.points.copy()
        
        for vehicle in self.vehicles:
            if not points_to_assign: break
            
            route = Route(vehicle)
            current_time = self._time_to_minutes(vehicle.start_time)
            last_point_idx = 0 # Depósito

            while True:
                best_candidate = None
                min_cost = float('inf')
                
                for i, point in enumerate(points_to_assign):
                    point_idx = self.points.index(point) + 1
                    
                    # Verifica restrições
                    if (route.load + point.weight > vehicle.capacity or
                        route.volume + point.volume > vehicle.volume_capacity or
                        not point.required_skills.issubset(vehicle.skills)):
                        continue

                    travel_time = self.time_matrix[last_point_idx, point_idx]
                    arrival_time = current_time + travel_time
                    
                    start_tw = self._time_to_minutes(point.time_window_start)
                    end_tw = self._time_to_minutes(point.time_window_end)
                    
                    wait_time = max(0, start_tw - arrival_time)
                    departure_time = arrival_time + wait_time + point.service_time
                    
                    if departure_time > end_tw: continue

                    cost = self.distance_matrix[last_point_idx, point_idx] # Custo = distância
                    if cost < min_cost:
                        min_cost = cost
                        best_candidate = {
                            "point": point,
                            "point_idx": point_idx,
                            "arrival_time": arrival_time,
                            "departure_time": departure_time,
                            "wait_time": wait_time
                        }

                if best_candidate:
                    point = best_candidate['point']
                    dist = self.distance_matrix[last_point_idx, best_candidate['point_idx']]
                    travel_time_sec = self.time_matrix[last_point_idx, best_candidate['point_idx']] * 60
                    
                    route.add_point(point, dist, travel_time_sec)
                    
                    current_time = best_candidate['departure_time']
                    last_point_idx = best_candidate['point_idx']
                    points_to_assign.remove(point)
                else:
                    break
            
            if route.points:
                # Retorno ao depósito
                dist = self.distance_matrix[last_point_idx, 0]
                travel_time_sec = self.time_matrix[last_point_idx, 0] * 60
                route.distance += dist
                route.duration += travel_time_sec
                route.cost += (dist / 1000) * vehicle.cost_per_km
                
                routes.append(self._format_route_output(route))

        for point in points_to_assign:
            unassigned_points.append({"point_id": point.id, "reasons": ["Não coube em nenhuma rota viável"]})
        
        return self._format_solution_output(routes, unassigned_points, time.time() - start_time)

    def _vnd_search(self, initial_solution: Dict[str, Any], max_iterations: int = 100) -> Dict[str, Any]:
        """Busca de Vizinhança Variável (VND)."""
        logger.info("Aplicando VND para refinar a solução.")
        # Implementação simplificada do VND
        # Para uma versão completa, seriam necessários movimentos como swap, relocate, 2-opt, etc.
        # Por enquanto, retorna a solução inicial.
        return initial_solution

    def visualize_routes(self, solution: Optional[Dict[str, Any]] = None, filename: str = "mapa_rotas.html", include_river: bool = False) -> bool:
        """
        Gera um mapa interativo usando o módulo de visualização.
        """
        solution_to_viz = solution if solution is not None else self.solution
        
        if not solution_to_viz:
            logger.warning("Nenhuma solução para visualizar.")
            return False

        logger.info(f"Gerando visualização do mapa em '{filename}'...")
        return map_visualization.visualize_routes(
            solution=solution_to_viz,
            graph=self.graph,
            depot=self.depot,
            points=self.points,
            filename=filename,
            include_river=include_river
        )

    def _format_route_output(self, route: Route) -> Dict[str, Any]:
        """Formata uma única rota para o output."""
        return {
            "vehicle_id": route.vehicle.id,
            "vehicle_name": route.vehicle.name,
            "points": [p.__dict__ for p in route.points],
            "distance": route.distance,
            "duration": route.duration,
            "cost": route.cost,
            "load": route.load,
            "volume": route.volume,
            "feasible": route.is_feasible()
        }

    def _format_solution_output(self, routes: List[Dict], unassigned: List[Dict], exec_time: float) -> Dict[str, Any]:
        """Formata a solução final."""
        total_dist = sum(r['distance'] for r in routes)
        total_cost = sum(r['cost'] for r in routes)
        total_points = sum(len(r['points']) for r in routes)
        
        return {
            "routes": routes,
            "unassigned": unassigned,
            "stats": {
                "total_distance": total_dist,
                "total_cost": total_cost,
                "total_points_served": total_points,
                "total_points": len(self.points) + total_points,
                "execution_time": exec_time,
                "feasible": all(r['feasible'] for r in routes) and not unassigned
            }
        }

    def export_to_json(self, filename: str):
        """Exporta a solução para JSON."""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.solution, f, ensure_ascii=False, indent=2)
        logger.info(f"Solução exportada para {filename}")

    def export_to_csv(self, filename: str):
        """Exporta a solução para CSV."""
        # Implementação simplificada
        pass
