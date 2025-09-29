"""
RobustRouter - Sistema Avançado de Roteirização
-----------------------------------------------
Combina mapas reais do OpenStreetMap com meta-heurísticas avançadas
para otimização de rotas com múltiplas restrições.

Funcionalidades:
1. Cálculo de rotas usando mapas reais (OSMnx)
2. Otimização com VND, Busca Tabu e GRASP
3. Suporte a múltiplas restrições (janelas de tempo, capacidades, habilidades)
4. Geração de relatórios detalhados
5. Cache de mapas para melhor desempenho
"""

import os
import json
import math
import time
import csv
import hashlib
import random
import logging
import warnings
import copy
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set, Deque
from collections import defaultdict, deque
from datetime import datetime, time as dt_time

import requests
import numpy as np
import pandas as pd
import networkx as nx
import osmnx as ox
import geopandas as gpd
import folium
from folium import plugins
from shapely.geometry import Point as ShapelyPoint, LineString, Polygon, MultiPolygon
from shapely.ops import unary_union

# Constantes
MAX_ITERATIONS = 100
TABU_TENURE = 10
GRASP_ITERATIONS = 50
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')

@dataclass
class Vehicle:
    """Classe para representar um veículo com restrições e capacidades."""
    id: str
    name: str
    capacity: float  # em kg
    max_weight: float  # em kg
    volume_capacity: float  # em m³
    length: float  # em metros
    width: float   # em metros
    height: float  # em metros
    start_time: str  # formato 'HH:MM'
    end_time: str    # formato 'HH:MM'
    speed: float     # em km/h
    cost_per_km: float = 10.0  # Custo por km rodado
    driver_name: str = ""
    driver_phone: str = ""
    fixed_cost: float = 100.0  # Custo fixo por rota
    skills: Set[str] = field(default_factory=set)  # Habilidades do motorista/veículo
    
    @property
    def speed_mps(self) -> float:
        """Retorna a velocidade em metros/segundo."""
        return (self.speed * 1000) / 3600  # km/h -> m/s

@dataclass
class Point:
    """Classe para representar um ponto de entrega/coleta com restrições."""
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
        # Garante que as habilidades são conjuntos
        if isinstance(self.required_skills, list):
            self.required_skills = set(self.required_skills)

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
        self.cost += (distance / 1000) * self.vehicle.cost_per_km  # Custo por km
        
        # Se for o primeiro ponto, adiciona o custo fixo
        if len(self.points) == 1:
            self.cost += self.vehicle.fixed_cost
    
    def is_feasible(self) -> bool:
        """Verifica se a rota é viável em termos de restrições."""
        return (self.load <= self.vehicle.capacity and 
                self.volume <= self.vehicle.volume_capacity and
                self.time_windows_violation == 0 and
                self.capacity_violation == 0)


class RobustRouter:
    """Classe principal para roteirização robusta com mapas reais."""
    
    def __init__(self, location: str = "São Paulo, Brazil", use_cache: bool = True):
        """
        Inicializa o roteirizador com uma localização padrão.
        
        Args:
            location: Nome da localização (cidade, endereço, etc.)
            use_cache: Se True, usa cache de mapas para melhor desempenho
        """
        self.location = location
        self.use_cache = use_cache
        self.graph = None
        self.vehicles: List[Vehicle] = []
        self.points: List[Point] = []
        self.depot: Optional[Point] = None
        self.distance_matrix: List[List[float]] = []
        self.time_matrix: List[List[float]] = []
        self.solution: Dict[str, Any] = {}
        self.tabu_list: Deque[Any] = deque(maxlen=TABU_TENURE)
        
        # Cria diretório de cache se não existir
        if use_cache and not os.path.exists(CACHE_DIR):
            os.makedirs(CACHE_DIR, exist_ok=True)
    
    def _get_cache_filename(self, key: str) -> str:
        """Gera um nome de arquivo de cache baseado em uma chave."""
        return os.path.join(CACHE_DIR, f"{hashlib.md5(key.encode('utf-8')).hexdigest()}.graphml")
    
    def load_map(self) -> bool:
        """
        Carrega o mapa da localização especificada, usando cache quando disponível.
        
        Returns:
            bool: True se o mapa foi carregado com sucesso, False caso contrário.
        """
        import osmnx as ox
        
        # Tenta carregar do cache primeiro (se habilitado)
        if self.use_cache:
            cache_file = self._get_cache_filename(f"map_{self.location}")
            if os.path.exists(cache_file):
                try:
                    print(f"Carregando mapa do cache: {os.path.basename(cache_file)}")
                    self.graph = ox.load_graphml(cache_file)
                    print(f"✓ Mapa carregado do cache com {len(self.graph.nodes()):,} nós e {len(self.graph.edges()):,} arestas")
                    return True
                except Exception as e:
                    print(f"⚠️ Erro ao carregar mapa do cache: {e}")
        
        # Se não houver cache válido, baixa o mapa
        print(f"\nBaixando mapa de: {self.location}")
        print("Isso pode levar alguns minutos...")
        
        try:
            # Tenta baixar o mapa com configurações otimizadas para áreas maiores
            try:
                # Primeiro tenta com um buffer menor
                self.graph = ox.graph_from_place(
                    self.location,
                    network_type='drive',
                    simplify=True,
                    retain_all=True,  # Mantém todos os nós para melhor precisão
                    truncate_by_edge=True,
                    buffer_dist=1000  # 1km de buffer
                )
            except Exception as e:
                print(f"Aviso: Erro ao baixar com buffer, tentando sem buffer... ({e})")
                # Se falhar, tenta sem buffer
                self.graph = ox.graph_from_place(
                    self.location,
                    network_type='drive',
                    simplify=True,
                    retain_all=True,
                    truncate_by_edge=True
                )
            
            if self.graph is None or len(self.graph.nodes()) == 0:
                print("❌ Erro: Nenhum dado de mapa encontrado para a localização especificada")
                return False
                
            print(f"✓ Mapa baixado com sucesso! ({len(self.graph.nodes()):,} nós, {len(self.graph.edges()):,} arestas)")
            
            # Salva no cache para uso futuro
            if self.use_cache:
                try:
                    ox.save_graphml(self.graph, cache_file)
                    print(f"✓ Mapa salvo em cache: {os.path.basename(cache_file)}")
                except Exception as e:
                    print(f"⚠️ Aviso: não foi possível salvar o cache do mapa: {e}")
            
            return True
            
        except Exception as e:
            print(f"❌ Erro ao baixar o mapa: {e}")
            print("Dicas de solução de problemas:")
            print("1. Verifique sua conexão com a internet")
            print("2. Tente uma localização mais específica (ex: 'Praça da Liberdade, Belo Horizonte')")
            print("3. Tente novamente mais tarde (o servidor pode estar sobrecarregado)")
            return False
    
    def _time_to_minutes(self, time_str: str) -> int:
        """Converte tempo no formato 'HH:MM' para minutos desde a meia-noite."""
        try:
            h, m = map(int, time_str.split(':'))
            return h * 60 + m
        except (ValueError, AttributeError):
            return 0
    
    def _minutes_to_time(self, minutes: float) -> str:
        """Converte minutos desde a meia-noite para o formato 'HH:MM'."""
        h = int(minutes // 60)
        m = int(minutes % 60)
        return f"{h:02d}:{m:02d}"
        
    def _generate_river(self, center_lat: float = -19.9167, center_lng: float = -43.9345, 
                       length_km: float = 200, width_km: float = 0.5) -> gpd.GeoDataFrame:
        """
        Gera um rio simulado próximo a uma coordenada central.
        
        Args:
            center_lat: Latitude do centro do rio (padrão: BH)
            center_lng: Longitude do centro do rio (padrão: BH)
            length_km: Comprimento total do rio em km
            width_km: Largura aproximada do rio em km
            
        Returns:
            GeoDataFrame com o polígono do rio
        """
        import numpy as np
        import geopandas as gpd
        from shapely.geometry import LineString, Polygon
        
        # Converte km para graus (aproximadamente 111km por grau de latitude)
        length_deg = length_km / 111
        width_deg = width_km / 111
        
        # Cria uma linha sinuosa para o rio
        x = np.linspace(0, length_deg, 100)
        y = np.sin(x * 10) * (width_deg * 0.8)  # Ondulação do rio
        
        # Rotaciona o rio para seguir uma direção noroeste-sudeste
        angle = np.radians(45)  # Ângulo de 45 graus
        x_rot = x * np.cos(angle) - y * np.sin(angle)
        y_rot = x * np.sin(angle) + y * np.cos(angle)
        
        # Centraliza o rio nas coordenadas fornecidas
        x_rot = x_rot - np.mean(x_rot) + center_lng
        y_rot = y_rot - np.mean(y_rot) + center_lat
        
        # Cria uma linha central para o rio
        line = LineString(zip(x_rot, y_rot))
        
        # Cria um buffer ao redor da linha para formar o rio
        river = line.buffer(width_deg / 2, cap_style=2)  # 2 = flat ends
        
        # Cria um GeoDataFrame com o rio
        return gpd.GeoDataFrame(geometry=[river], crs="EPSG:4326")
    
    def _create_vehicles(self, vehicles_data: List[Dict]) -> bool:
        """
        Cria objetos Vehicle a partir dos dados fornecidos.
        
        Args:
            vehicles_data: Lista de dicionários com dados dos veículos.
            
        Returns:
            bool: True se os veículos foram criados com sucesso, False caso contrário.
        """
        try:
            self.vehicles = []
            for v_data in vehicles_data:
                # Converte skills para conjunto, se for uma lista
                skills = set(v_data.get('skills', []))
                
                vehicle = Vehicle(
                    id=v_data.get('id', f"v{len(self.vehicles) + 1}"),
                    name=v_data.get('name', f"Veículo {len(self.vehicles) + 1}"),
                    capacity=float(v_data.get('capacity', 1000)),
                    max_weight=float(v_data.get('max_weight', 1000)),
                    volume_capacity=float(v_data.get('volume_capacity', 10)),
                    length=float(v_data.get('length', 5)),
                    width=float(v_data.get('width', 2)),
                    height=float(v_data.get('height', 2)),
                    start_time=v_data.get('start_time', '08:00'),
                    end_time=v_data.get('end_time', '18:00'),
                    speed=float(v_data.get('speed', 40)),
                    cost_per_km=float(v_data.get('cost_per_km', 10.0)),
                    fixed_cost=float(v_data.get('fixed_cost', 100.0)),
                    skills=skills
                )
                self.vehicles.append(vehicle)
            
            print(f"{len(self.vehicles)} veículos criados com sucesso!")
            return True
            
        except Exception as e:
            print(f"Erro ao criar veículos: {e}")
            return False
    
    def _create_points(self, points_data: List[Dict]) -> bool:
        """
        Cria objetos Point a partir dos dados fornecidos.
        
        Args:
            points_data: Lista de dicionários com dados dos pontos.
            
        Returns:
            bool: True se os pontos foram criados com sucesso, False caso contrário.
        """
        try:
            self.points = []
            self.depot = None
            
            for p_data in points_data:
                # Converte required_skills para conjunto, se for uma lista
                required_skills = set(p_data.get('required_skills', []))
                
                point = Point(
                    id=p_data.get('id', f"p{len(self.points) + 1}"),
                    type=p_data.get('type', 'delivery').lower(),
                    name=p_data.get('name', f"Ponto {len(self.points) + 1}"),
                    address=p_data.get('address', ''),
                    lat=float(p_data.get('lat', 0)),
                    lng=float(p_data.get('lng', 0)),
                    order=int(p_data.get('order', 0)),
                    quantity=int(p_data.get('quantity', 1)),
                    weight=float(p_data.get('weight', 0)),
                    volume=float(p_data.get('volume', 0)),
                    time_window_start=p_data.get('time_window_start', '08:00'),
                    time_window_end=p_data.get('time_window_end', '18:00'),
                    service_time=int(p_data.get('service_time', 30)),
                    priority=int(p_data.get('priority', 3)),
                    required_skills=required_skills
                )
                
                if point.type == 'depot':
                    self.depot = point
                else:
                    self.points.append(point)
            
            # Se não houver depósito, usa o primeiro ponto como depósito
            if not self.depot and self.points:
                self.depot = self.points[0]
                self.points = self.points[1:]
            
            print(f"{len(self.points)} pontos de entrega e 1 depósito criados com sucesso!")
            return True
            
        except Exception as e:
            print(f"Erro ao criar pontos: {e}")
            return False
    
    def _add_route_with_arrows(self, map_obj, coords, color='blue', weight=8, opacity=0.9, 
                              popup=None, tooltip=None, dash_array=None):
        """
        Adiciona uma rota com setas indicando a direção ao mapa.
        
        Args:
            map_obj: Objeto de mapa do Folium
            coords: Lista de tuplas (lat, lng) com as coordenadas da rota
            color: Cor da linha
            weight: Espessura da linha
            opacity: Opacidade da linha (0-1)
            popup: Texto do popup
            tooltip: Texto do tooltip
            dash_array: Padrão de traçado (ex: '5,5' para linha tracejada)
        """
        if len(coords) < 2:
            return
        
        # Cria a linha principal
        line = folium.PolyLine(
            coords,
            color=color,
            weight=weight,
            opacity=opacity,
            popup=popup,
            tooltip=tooltip,
            dash_array=dash_array,
            line_cap='round',
            line_join='round'
        )
        
        # Adiciona a linha ao mapa
        line.add_to(map_obj)
        
        try:
            # Tenta importar o PolyLineTextPath do folium.plugins
            from folium.plugins import PolyLineTextPath
            
            # Estilo das setas (menores e mais discretas)
            arrow_style = {
                'fill': color,
                'font-size': '14',  # Reduzido de 20 para 14
                'font-weight': 'normal',  # Removido o negrito
                'text-anchor': 'middle',
                'stroke': 'white',
                'stroke-width': '0.8',  # Reduzido de 1 para 0.8
                'paint-order': 'stroke',
                'fill-opacity': '0.9',  # Levemente transparente
                'stroke-opacity': '0.7'  # Levemente transparente
            }
            
            # Adiciona mais setas ao longo da rota (mais próximas umas das outras)
            arrow_positions = [0.02, 0.08, 0.14, 0.20, 0.26, 0.32, 0.38, 0.44, 0.50, 
                             0.56, 0.62, 0.68, 0.74, 0.80, 0.86, 0.92, 0.98]
            for offset in arrow_positions:
                PolyLineTextPath(
                    line,
                    '➤',
                    repeat=False,
                    offset=10,
                    attributes=arrow_style,
                    center=True,
                    offset_units='fraction',
                    text_anchor=offset
                ).add_to(map_obj)
            
            # Adiciona uma seta maior no final da rota
            end_arrow_style = arrow_style.copy()
            end_arrow_style.update({
                'font-size': '24',
                'font-weight': 'bold',
                'text-anchor': 'end'
            })
            
            PolyLineTextPath(
                line,
                '➤',
                repeat=False,
                offset=10,
                attributes=end_arrow_style,
                center=False,
                offset_units='fraction',
                text_anchor=0.99
            ).add_to(map_obj)
            
        except ImportError:
            print("Aviso: O plugin PolyLineTextPath não está disponível. As setas não serão exibidas.")
            # Fallback: desenha uma seta simples no final da rota
            if len(coords) >= 2:
                folium.RegularPolygonMarker(
                    location=coords[-1],
                    fill_color=color,
                    number_of_sides=3,
                    radius=8,
                    rotation=0,
                    popup=popup,
                    tooltip=tooltip
                ).add_to(map_obj)
    
    def _create_distance_time_matrices(self) -> bool:
        """
        Cria as matrizes de distância e tempo entre todos os pontos usando o grafo de ruas.
{{ ... }}
        
        Returns:
            bool: True se as matrizes foram criadas com sucesso, False caso contrário.
        """
        if not self.graph or not self.depot or not self.points:
            print("Erro: Grafo, depósito ou pontos não foram definidos corretamente.")
            return False
        
        try:
            # Adiciona o depósito como primeiro ponto
            all_points = [self.depot] + self.points
            n = len(all_points)
            
            # Inicializa as matrizes
            self.distance_matrix = np.zeros((n, n), dtype=float)
            self.time_matrix = np.zeros((n, n), dtype=float)
            
            # Obtém os nós mais próximos no grafo para cada ponto
            node_ids = []
            for point in all_points:
                node = ox.distance.nearest_nodes(self.graph, point.lng, point.lat)
                node_ids.append(node)
            
            # Calcula as distâncias e tempos entre todos os pares de pontos
            for i in range(n):
                for j in range(n):
                    if i == j:
                        self.distance_matrix[i][j] = 0
                        self.time_matrix[i][j] = 0
                    else:
                        try:
                            # Usa o algoritmo de Dijkstra para encontrar o caminho mais curto
                            path = nx.shortest_path(self.graph, node_ids[i], node_ids[j], weight='length')
                            
                            # Calcula a distância total do caminho
                            distance = 0
                            for u, v in zip(path[:-1], path[1:]):
                                # Usa o primeiro edge (0) para grafos MultiDiGraph
                                edge_data = self.graph.get_edge_data(u, v)[0]
                                distance += edge_data.get('length', 0)
                            
                            self.distance_matrix[i][j] = distance
                            
                            # Calcula o tempo de viagem (distância / velocidade)
                            # Usa a velocidade da via se disponível, senão usa a velocidade média
                            speed_kph = 40  # km/h padrão
                            if 'maxspeed' in edge_data:
                                speed_kph = float(edge_data['maxspeed'][0] if isinstance(edge_data['maxspeed'], list) else edge_data['maxspeed'])
                            
                            speed_mps = speed_kph * 1000 / 3600  # converte para m/s
                            self.time_matrix[i][j] = distance / speed_mps / 60  # em minutos
                            
                        except (nx.NetworkXNoPath, nx.NodeNotFound) as e:
                            print(f"Aviso: Não foi possível calcular rota entre {all_points[i].id} e {all_points[j].id}: {e}")
                            # Usa distância em linha reta como fallback
                            from math import radians, sin, cos, sqrt, atan2
                            
                            # Fórmula de Haversine para distância em linha reta
                            R = 6371000  # raio da Terra em metros
                            lat1, lon1 = radians(all_points[i].lat), radians(all_points[i].lng)
                            lat2, lon2 = radians(all_points[j].lat), radians(all_points[j].lng)
                            
                            dlat = lat2 - lat1
                            dlon = lon2 - lon1
                            
                            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                            c = 2 * atan2(sqrt(a), sqrt(1-a))
                            
                            distance = R * c
                            
                            # Estima o tempo com base na distância e velocidade média
                            avg_speed = 40 * 1000 / 3600  # 40 km/h em m/s
                            duration = distance / avg_speed  # em segundos
                            
                            self.distance_matrix[i][j] = distance
                            self.time_matrix[i][j] = duration / 60  # converte para minutos
            
            print("Matrizes de distância e tempo calculadas com sucesso!")
            return True
            
        except Exception as e:
            print(f"Erro ao calcular matrizes de distância/tempo: {e}")
            traceback.print_exc()
            return False
    
    def _create_initial_solution(self) -> Dict[str, Any]:
        """
        Cria uma solução inicial usando heurística construtiva.
        
        Returns:
            Dict: Solução inicial com rotas e estatísticas.
        """
        if not self.vehicles or not self.points or not hasattr(self, 'distance_matrix') or not self.distance_matrix.any():
            return {
                'routes': [],
                'unassigned': [{'point_id': p.id, 'reasons': ['Dados insuficientes']} for p in self.points],
                'stats': {
                    'total_distance': 0,
                    'total_cost': 0,
                    'total_points_served': 0,
                    'total_points': len(self.points),
                    'execution_time': 0,
                    'feasible': False
                }
            }
        
        start_time = time.time()
        routes = []
        unassigned = []
        
        # Faz uma cópia dos pontos para não modificar a lista original
        points_to_assign = self.points.copy()
        
        # Ordena os veículos por capacidade (maior primeiro)
        sorted_vehicles = sorted(self.vehicles, key=lambda v: v.capacity, reverse=True)
        
        # Para cada veículo, tenta atribuir pontos até esgotar sua capacidade
        for vehicle in sorted_vehicles:
            if not points_to_assign:
                break
                
            # Cria uma nova rota para o veículo
            route = Route(vehicle)
            current_point = self.depot
            current_time = self._time_to_minutes(vehicle.start_time)
            
            # Tenta adicionar pontos à rota até esgotar a capacidade
            while points_to_assign:
                # Encontra o ponto mais próximo que atenda às restrições
                best_point = None
                best_distance = float('inf')
                best_index = -1
                best_arrival_time = 0
                
                for i, point in enumerate(points_to_assign):
                    # Verifica se o veículo tem as habilidades necessárias
                    if not point.required_skills.issubset(vehicle.skills):
                        continue
                    
                    # Calcula a distância do ponto atual até o candidato
                    from_idx = 0 if current_point == self.depot else self.points.index(current_point) + 1
                    to_idx = self.points.index(point) + 1  # +1 por causa do depósito
                    distance = self.distance_matrix[from_idx][to_idx]
                    
                    # Verifica se o ponto atende às restrições de capacidade
                    if (route.load + point.weight > vehicle.capacity or 
                        route.volume + point.volume > vehicle.volume_capacity):
                        continue
                    
                    # Verifica se o ponto atende às restrições de janela de tempo
                    travel_time = self.time_matrix[from_idx][to_idx]  # em minutos
                    arrival_time = current_time + travel_time
                    
                    time_window_start = self._time_to_minutes(point.time_window_start)
                    time_window_end = self._time_to_minutes(point.time_window_end)
                    
                    # Se chegar antes da janela, espera até a abertura
                    if arrival_time < time_window_start:
                        arrival_time = time_window_start
                    
                    # Verifica se é possível atender dentro da janela
                    if arrival_time > time_window_end:
                        continue
                    
                    # Atualiza o melhor ponto encontrado
                    if distance < best_distance:
                        best_point = point
                        best_distance = distance
                        best_index = i
                        best_arrival_time = arrival_time
                
                # Se não encontrou um ponto viável, encerra a rota
                if best_point is None:
                    break
                
                # Adiciona o ponto à rota
                route.add_point(best_point, best_distance, best_distance / vehicle.speed_mps)
                
                # Atualiza o tempo atual (tempo de chegada + tempo de serviço)
                current_time = best_arrival_time + best_point.service_time
                current_point = best_point
                
                # Remove o ponto da lista de pontos a atribuir
                points_to_assign.pop(best_index)
            
            # Se a rota tiver pelo menos um ponto além do depósito, adiciona à solução
            if route.points:
                # Volta ao depósito
                from_idx = 0 if current_point == self.depot else self.points.index(current_point) + 1
                distance_to_depot = self.distance_matrix[from_idx][0]
                route.distance += distance_to_depot
                route.duration += distance_to_depot / vehicle.speed_mps
                route.cost += (distance_to_depot / 1000) * vehicle.cost_per_km
                
                routes.append({
                    'vehicle_id': vehicle.id,
                    'vehicle_name': vehicle.name,
                    'points': [{
                        'id': p.id,
                        'name': p.name,
                        'type': p.type,
                        'lat': p.lat,
                        'lng': p.lng,
                        'weight': p.weight,
                        'volume': p.volume,
                        'service_time': p.service_time,
                        'time_window': f"{p.time_window_start} - {p.time_window_end}",
                        'required_skills': list(p.required_skills)
                    } for p in route.points],
                    'distance': route.distance,
                    'duration': route.duration,
                    'cost': route.cost,
                    'load': route.load,
                    'volume': route.volume,
                    'feasible': route.is_feasible()
                })
        
        # Adiciona os pontos não atribuídos à lista de não atribuídos
        for point in points_to_assign:
            reasons = []
            
            # Verifica as possíveis razões para não atribuição
            if not any(point.required_skills.issubset(v.skills) for v in self.vehicles):
                reasons.append(f"Nenhum veículo com as habilidades necessárias: {', '.join(point.required_skills)}")
            
            # Verifica se há veículos com capacidade suficiente
            has_capacity = False
            for v in self.vehicles:
                if (v.capacity >= point.weight and 
                    v.volume_capacity >= point.volume and
                    point.required_skills.issubset(v.skills)):
                    has_capacity = True
                    break
            
            if not has_capacity:
                reasons.append("Nenhum veículo com capacidade suficiente")
            
            # Verifica se há veículos disponíveis na janela de tempo
            has_time = False
            point_time_window_start = self._time_to_minutes(point.time_window_start)
            point_time_window_end = self._time_to_minutes(point.time_window_end)
            
            for v in self.vehicles:
                if not point.required_skills.issubset(v.skills):
                    continue
                
                vehicle_start = self._time_to_minutes(v.start_time)
                vehicle_end = self._time_to_minutes(v.end_time)
                
                # Verifica se há sobreposição nas janelas de tempo
                if (point_time_window_start <= vehicle_end and 
                    point_time_window_end >= vehicle_start):
                    has_time = True
                    break
            
            if not has_time:
                reasons.append("Nenhum veículo disponível na janela de tempo")
            
            unassigned.append({
                'point_id': point.id,
                'point_name': point.name,
                'reasons': reasons if reasons else ["Razão desconhecida"],
                'details': {
                    'weight': point.weight,
                    'volume': point.volume,
                    'time_window': f"{point.time_window_start} - {point.time_window_end}",
                    'required_skills': list(point.required_skills)
                }
            })
        
        # Calcula as estatísticas da solução
        total_distance = sum(r['distance'] for r in routes)
        total_cost = sum(r['cost'] for r in routes)
        total_points_served = sum(len(r['points']) for r in routes)
        
        execution_time = time.time() - start_time
        
        solution = {
            'routes': routes,
            'unassigned': unassigned,
            'stats': {
                'total_distance': total_distance,
                'total_cost': total_cost,
                'total_points_served': total_points_served,
                'total_points': len(self.points),
                'execution_time': execution_time,
                'feasible': all(r['feasible'] for r in routes) and not unassigned
            }
        }
        
        return solution
    
    def _vnd_search(self, initial_solution: Dict[str, Any], max_iterations: int = 100) -> Dict[str, Any]:
        """
        Busca de Vizinhança Variável (VND) para melhorar a solução.
        
        Args:
            initial_solution: Solução inicial a ser melhorada.
            max_iterations: Número máximo de iterações.
            
        Returns:
            Dict: Melhor solução encontrada.
        """
        print("\nAplicando VND (Busca de Vizinhança Variável)...")
        
        current_solution = copy.deepcopy(initial_solution)
        best_solution = copy.deepcopy(current_solution)
        
        # Lista de estruturas de vizinhança a serem testadas
        neighborhood_structures = [
            self._swap_intra_route,
            self._swap_inter_route,
            self._relocate,
            self._two_opt
        ]
        
        improved = True
        iteration = 0
        
        while improved and iteration < max_iterations:
            improved = False
            k = 0  # Índice da estrutura de vizinhança atual
            
            while k < len(neighborhood_structures):
                # Gera vizinhos usando a estrutura de vizinhança atual
                neighbors = neighborhood_structures[k](current_solution)
                
                # Encontra o melhor vizinho
                best_neighbor = None
                for neighbor in neighbors:
                    if self._is_better_solution(neighbor, current_solution):
                        if best_neighbor is None or self._is_better_solution(neighbor, best_neighbor):
                            best_neighbor = neighbor
                
                # Se encontrou um vizinho melhor, move para ele e reinicia com a primeira estrutura
                if best_neighbor is not None:
                    current_solution = best_neighbor
                    
                    # Atualiza a melhor solução global se necessário
                    if self._is_better_solution(current_solution, best_solution):
                        best_solution = copy.deepcopy(current_solution)
                    
                    improved = True
                    k = 0  # Reinicia com a primeira estrutura de vizinhança
                else:
                    k += 1  # Passa para a próxima estrutura de vizinhança
            
            iteration += 1
        
        print(f"VND concluído em {iteration} iterações.")
        return best_solution
    
    def _swap_intra_route(self, solution: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Gera vizinhos trocando dois pontos na mesma rota.
        
        Args:
            solution: Solução atual.
            
        Returns:
            List[Dict]: Lista de soluções vizinhas.
        """
        neighbors = []
        
        for route_idx, route in enumerate(solution['routes']):
            points = route['points']
            
            # Gera todas as possíveis trocas de dois pontos na rota
            for i in range(len(points)):
                for j in range(i + 1, len(points)):
                    # Cria uma cópia da solução
                    neighbor = copy.deepcopy(solution)
                    
                    # Troca os pontos
                    neighbor['routes'][route_idx]['points'][i], neighbor['routes'][route_idx]['points'][j] = \
                        neighbor['routes'][route_idx]['points'][j], neighbor['routes'][route_idx]['points'][i]
                    
                    # Atualiza as estatísticas da rota
                    self._update_route_stats(neighbor['routes'][route_idx])
                    
                    # Adiciona à lista de vizinhos
                    neighbors.append(neighbor)
        
        return neighbors
    
    def _swap_inter_route(self, solution: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Gera vizinhos trocando dois pontos em rotas diferentes.
        
        Args:
            solution: Solução atual.
            
        Returns:
            List[Dict]: Lista de soluções vizinhas.
        """
        neighbors = []
        
        # Gera todas as possíveis trocas entre pares de rotas
        for i in range(len(solution['routes'])):
            for j in range(i + 1, len(solution['routes'])):
                route1 = solution['routes'][i]
                route2 = solution['routes'][j]
                
                # Para cada par de pontos entre as rotas
                for k in range(len(route1['points'])):
                    for l in range(len(route2['points'])):
                        # Cria uma cópia da solução
                        neighbor = copy.deepcopy(solution)
                        
                        # Troca os pontos
                        neighbor['routes'][i]['points'][k], neighbor['routes'][j]['points'][l] = \
                            neighbor['routes'][j]['points'][l], neighbor['routes'][i]['points'][k]
                        
                        # Atualiza as estatísticas das rotas
                        self._update_route_stats(neighbor['routes'][i])
                        self._update_route_stats(neighbor['routes'][j])
                        
                        # Adiciona à lista de vizinhos se for viável
                        if (neighbor['routes'][i]['feasible'] and 
                            neighbor['routes'][j]['feasible']):
                            neighbors.append(neighbor)
        
        return neighbors
    
    def _relocate(self, solution: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Gera vizinhos movendo um ponto de uma posição para outra na mesma ou em outra rota.
        
        Args:
            solution: Solução atual.
            
        Returns:
            List[Dict]: Lista de soluções vizinhas.
        """
        neighbors = []
        
        # Para cada rota de origem
        for src_route_idx, src_route in enumerate(solution['routes']):
            # Para cada ponto na rota de origem
            for point_idx in range(len(src_route['points'])):
                # Para cada rota de destino (incluindo a mesma rota)
                for dst_route_idx, dst_route in enumerate(solution['routes']):
                    # Para cada posição possível na rota de destino
                    for insert_pos in range(len(dst_route['points']) + 1):
                        # Se for a mesma rota e a posição de inserção for a mesma do ponto, pula
                        if src_route_idx == dst_route_idx and (point_idx == insert_pos or point_idx + 1 == insert_pos):
                            continue
                        
                        # Cria uma cópia da solução
                        neighbor = copy.deepcopy(solution)
                        
                        # Remove o ponto da rota de origem
                        point = neighbor['routes'][src_route_idx]['points'].pop(point_idx)
                        
                        # Insere o ponto na rota de destino na posição desejada
                        insert_route_idx = dst_route_idx
                        if src_route_idx == dst_route_idx and point_idx < insert_pos:
                            insert_route_idx = src_route_idx
                            insert_pos -= 1
                        
                        neighbor['routes'][insert_route_idx]['points'].insert(insert_pos, point)
                        
                        # Atualiza as estatísticas das rotas afetadas
                        self._update_route_stats(neighbor['routes'][src_route_idx])
                        if src_route_idx != insert_route_idx:
                            self._update_route_stats(neighbor['routes'][insert_route_idx])
                        
                        # Adiciona à lista de vizinhos se for viável
                        if neighbor['routes'][src_route_idx]['feasible'] and \
                           (src_route_idx == insert_route_idx or neighbor['routes'][insert_route_idx]['feasible']):
                            neighbors.append(neighbor)
        
        return neighbors
    
    def _two_opt(self, solution: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Gera vizinhos invertendo uma subsequência de pontos em uma rota.
        
        Args:
            solution: Solução atual.
            
        Returns:
            List[Dict]: Lista de soluções vizinhas.
        """
        neighbors = []
        
        for route_idx, route in enumerate(solution['routes']):
            points = route['points']
            
            # Gera todas as possíveis inversões de subsequências
            for i in range(len(points)):
                for j in range(i + 1, len(points)):
                    # Cria uma cópia da solução
                    neighbor = copy.deepcopy(solution)
                    
                    # Inverte a subsequência de i a j
                    neighbor['routes'][route_idx]['points'][i:j+1] = \
                        neighbor['routes'][route_idx]['points'][i:j+1][::-1]
                    
                    # Atualiza as estatísticas da rota
                    self._update_route_stats(neighbor['routes'][route_idx])
                    
                    # Adiciona à lista de vizinhos se for viável
                    if neighbor['routes'][route_idx]['feasible']:
                        neighbors.append(neighbor)
        
        return neighbors
    
    def _update_route_stats(self, route: Dict[str, Any]) -> None:
        """
        Atualiza as estatísticas de uma rota após modificações.
        
        Args:
            route: Rota a ser atualizada.
        """
        try:
            # Encontra o veículo correspondente
            vehicle = next(v for v in self.vehicles if v.id == route['vehicle_id'])
            
            # Cria um objeto Route temporário
            temp_route = Route(vehicle)
            current_point = self.depot
            current_time = self._time_to_minutes(vehicle.start_time)
            
            # Recalcula a rota ponto a ponto
            for point_data in route['points']:
                point = next(p for p in self.points if p.id == point_data['id'])
                
                # Calcula a distância e o tempo até o próximo ponto
                from_idx = 0 if current_point == self.depot else self.points.index(current_point) + 1
                to_idx = self.points.index(point) + 1
                
                distance = self.distance_matrix[from_idx][to_idx]
                duration = self.time_matrix[from_idx][to_idx] * 60  # converte para segundos
                
                # Atualiza o tempo de chegada
                arrival_time = current_time + duration / 60  # em minutos
                
                # Verifica se chegou antes da janela de tempo
                time_window_start = self._time_to_minutes(point.time_window_start)
                if arrival_time < time_window_start:
                    arrival_time = time_window_start
                
                # Verifica se ultrapassou a janela de tempo
                time_window_end = self._time_to_minutes(point.time_window_end)
                if arrival_time > time_window_end:
                    route['feasible'] = False
                
                # Adiciona o ponto à rota
                temp_route.add_point(point, distance, duration)
                
                # Atualiza o tempo atual (tempo de chegada + tempo de serviço)
                current_time = arrival_time + point.service_time
                current_point = point
            
            # Volta ao depósito
            if current_point != self.depot:
                from_idx = 0 if current_point == self.depot else self.points.index(current_point) + 1
                distance_to_depot = self.distance_matrix[from_idx][0]
                temp_route.distance += distance_to_depot
                temp_route.duration += distance_to_depot / vehicle.speed_mps
                temp_route.cost += (distance_to_depot / 1000) * vehicle.cost_per_km
            
            # Atualiza as estatísticas da rota
            route['distance'] = temp_route.distance
            route['duration'] = temp_route.duration
            route['cost'] = temp_route.cost
            route['load'] = temp_route.load
            route['volume'] = temp_route.volume
            route['feasible'] = temp_route.is_feasible()
            
        except Exception as e:
            print(f"Erro ao atualizar estatísticas da rota: {e}")
            route['feasible'] = False
    
    def _is_better_solution(self, new_solution: Dict[str, Any], 
                           current_solution: Dict[str, Any]) -> bool:
        """
        Compara duas soluções e retorna True se a nova for melhor.
        
        Args:
            new_solution: Nova solução a ser avaliada.
            current_solution: Solução atual.
            
        Returns:
            bool: True se a nova solução for melhor, False caso contrário.
        """
        # Prioriza soluções viáveis
        new_feasible = all(r['feasible'] for r in new_solution['routes'])
        current_feasible = all(r['feasible'] for r in current_solution['routes'])
        
        if new_feasible and not current_feasible:
            return True
        if not new_feasible and current_feasible:
            return False
        
        # Dentro das soluções viáveis, prioriza as que atendem mais pontos
        if new_solution['stats']['total_points_served'] > current_solution['stats']['total_points_served']:
            return True
        
        # Se atenderem o mesmo número de pontos, prioriza a de menor custo
        if new_solution['stats']['total_points_served'] == current_solution['stats']['total_points_served']:
            return new_solution['stats']['total_cost'] < current_solution['stats']['total_cost']
        
        return False
    
    def solve_vrp(self, request_data: Dict, method: str = 'vnd', max_iterations: int = 100) -> Dict[str, Any]:
        """
        Resolve o problema de roteirização de veículos (VRP) com o método especificado.
        
        Args:
            request_data: Dicionário com os dados da requisição, incluindo veículos e pontos.
            method: Método de otimização ('vnd', 'tabu', 'grasp').
            max_iterations: Número máximo de iterações para o método de otimização.
            
        Returns:
            Dict: Solução do VRP com rotas e estatísticas.
        """
        print(f"\n=== INÍCIO DA OTIMIZAÇÃO ===\nMétodo: {method.upper()}")
        
        # Valida os dados de entrada
        if 'vehicles' not in request_data or not request_data['vehicles']:
            raise ValueError("Nenhum veículo fornecido nos dados de entrada.")
        
        if 'points' not in request_data or not request_data['points']:
            raise ValueError("Nenhum ponto de entrega fornecido nos dados de entrada.")
        
        # Carrega o mapa se necessário
        if self.graph is None and not self.load_map():
            raise RuntimeError("Não foi possível carregar o mapa. Verifique a conexão com a internet e tente novamente.")
        
        # Processa os veículos e pontos
        if not self._create_vehicles(request_data['vehicles']):
            raise ValueError("Falha ao processar os veículos. Verifique os dados de entrada.")
        
        if not self._create_points(request_data['points']):
            raise ValueError("Falha ao processar os pontos de entrega. Verifique os dados de entrada.")
        
        # Calcula as matrizes de distância e tempo
        if not self._create_distance_time_matrices():
            raise RuntimeError("Falha ao calcular as matrizes de distância e tempo.")
        
        # Cria uma solução inicial
        initial_solution = self._create_initial_solution()
        
        # Aplica o método de otimização selecionado
        if method.lower() == 'vnd':
            final_solution = self._vnd_search(initial_solution, max_iterations)
        elif method.lower() == 'tabu':
            final_solution = self._tabu_search(initial_solution, max_iterations)
        elif method.lower() == 'grasp':
            final_solution = self._grasp(max_iterations)
        else:
            print(f"Método '{method}' não reconhecido. Usando solução inicial.")
            final_solution = initial_solution
        
        # Armazena a solução final
        self.solution = final_solution
        
        print("\n=== OTIMIZAÇÃO CONCLUÍDA ===")
        print(f"- Rotas geradas: {len(final_solution['routes'])}")
        print(f"- Distância total: {final_solution['stats']['total_distance']:.2f} metros")
        print(f"- Custo total: R$ {final_solution['stats']['total_cost']:.2f}")
        print(f"- Pontos atendidos: {final_solution['stats']['total_points_served']}/{final_solution['stats']['total_points']}")
        print(f"- Tempo de execução: {final_solution['stats']['execution_time']:.2f} segundos")
        
        return final_solution
    
    def _tabu_search(self, initial_solution: Dict[str, Any], max_iterations: int = 100, 
                    tabu_tenure: int = 10, max_tabu_size: int = 50) -> Dict[str, Any]:
        """
        Busca Tabu para melhorar a solução.
        
        Args:
            initial_solution: Solução inicial a ser melhorada.
            max_iterations: Número máximo de iterações.
            tabu_tenure: Número de iterações que um movimento fica na lista tabu.
            max_tabu_size: Tamanho máximo da lista tabu.
            
        Returns:
            Dict: Melhor solução encontrada.
        """
        print("\nAplicando Busca Tabu...")
        
        current_solution = copy.deepcopy(initial_solution)
        best_solution = copy.deepcopy(current_solution)
        
        # Lista tabu para armazenar movimentos proibidos
        tabu_list = []
        
        # Melhor solução encontrada até o momento
        global_best = copy.deepcopy(best_solution)
        
        # Contador de iterações sem melhora
        no_improvement = 0
        max_no_improvement = max_iterations // 4
        
        for iteration in range(max_iterations):
            if no_improvement >= max_no_improvement:
                print(f"Parada antecipada após {iteration} iterações sem melhora.")
                break
                
            # Gera todos os vizinhos possíveis
            neighbors = self._generate_all_neighbors(current_solution)
            
            # Avalia os vizinhos
            best_neighbor = None
            best_neighbor_value = float('inf')
            best_move = None
            
            for neighbor in neighbors:
                # Calcula o valor da solução (quanto menor, melhor)
                neighbor_value = self._evaluate_solution(neighbor)
                
                # Verifica se o movimento está na lista tabu
                move = self._get_move_difference(current_solution, neighbor)
                is_tabu = any(self._is_same_move(move, tabu_move) for tabu_move in tabu_list)
                
                # Critério de aspiração: aceita mesmo se estiver na lista tabu se for melhor que a melhor global
                if (not is_tabu or 
                    (is_tabu and neighbor_value < self._evaluate_solution(global_best))):
                    if neighbor_value < best_neighbor_value:
                        best_neighbor = neighbor
                        best_neighbor_value = neighbor_value
                        best_move = move
            
            # Se não encontrou nenhum vizinho viável, termina
            if best_neighbor is None:
                print("Nenhum vizinho viável encontrado.")
                break
            
            # Atualiza a solução atual
            current_solution = best_neighbor
            
            # Atualiza a melhor solução global se necessário
            if best_neighbor_value < self._evaluate_solution(global_best):
                global_best = copy.deepcopy(best_neighbor)
                no_improvement = 0
                print(f"Nova melhor solução encontrada na iteração {iteration+1}: "
                      f"{global_best['stats']['total_cost']:.2f}")
            else:
                no_improvement += 1
            
            # Adiciona o movimento à lista tabu
            if best_move:
                tabu_list.append((best_move, iteration + tabu_tenure))
            
            # Remove movimentos antigos da lista tabu
            tabu_list = [(move, tenure) for move, tenure in tabu_list if tenure > iteration]
            
            # Limita o tamanho da lista tabu
            if len(tabu_list) > max_tabu_size:
                tabu_list = tabu_list[-max_tabu_size:]
        
        print(f"Busca Tabu concluída em {iteration+1} iterações.")
        return global_best
    
    def _grasp(self, max_iterations: int = 50, alpha: float = 0.3) -> Dict[str, Any]:
        """
        GRASP (Greedy Randomized Adaptive Search Procedure) para o VRP.
        
        Args:
            max_iterations: Número máximo de iterações.
            alpha: Parâmetro de aleatoriedade (0 = totalmente guloso, 1 = totalmente aleatório).
            
        Returns:
            Dict: Melhor solução encontrada.
        """
        print("\nAplicando GRASP...")
        
        best_solution = None
        
        for iteration in range(max_iterations):
            # Fase de construção: solução inicial aleatorizada
            solution = self._grasp_construct(alpha)
            
            # Fase de busca local
            solution = self._vnd_search(solution, max_iterations=50)
            
            # Atualiza a melhor solução
            if best_solution is None or self._is_better_solution(solution, best_solution):
                best_solution = copy.deepcopy(solution)
                print(f"Iteração {iteration+1}: Nova melhor solução encontrada - "
                      f"Custo: {best_solution['stats']['total_cost']:.2f}")
        
        print(f"GRASP concluído em {max_iterations} iterações.")
        return best_solution
    
    def _grasp_construct(self, alpha: float) -> Dict[str, Any]:
        """
        Fase de construção do GRASP.
        
        Args:
            alpha: Parâmetro de aleatoriedade.
            
        Returns:
            Dict: Solução construída.
        """
        # Cria uma cópia dos pontos para não modificar a lista original
        points_to_assign = self.points.copy()
        routes = []
        
        # Ordena os veículos por capacidade (maior primeiro)
        sorted_vehicles = sorted(self.vehicles, key=lambda v: v.capacity, reverse=True)
        
        # Para cada veículo, tenta atribuir pontos até esgotar sua capacidade
        for vehicle in sorted_vehicles:
            if not points_to_assign:
                break
                
            # Cria uma nova rota para o veículo
            route = Route(vehicle)
            current_point = self.depot
            current_time = self._time_to_minutes(vehicle.start_time)
            
            # Tenta adicionar pontos à rota até esgotar a capacidade
            while points_to_assign:
                # Lista de candidatos viáveis
                candidates = []
                
                for i, point in enumerate(points_to_assign):
                    # Verifica se o veículo tem as habilidades necessárias
                    if not point.required_skills.issubset(vehicle.skills):
                        continue
                    
                    # Calcula a distância do ponto atual até o candidato
                    from_idx = 0 if current_point == self.depot else self.points.index(current_point) + 1
                    to_idx = self.points.index(point) + 1  # +1 por causa do depósito
                    distance = self.distance_matrix[from_idx][to_idx]
                    
                    # Verifica se o ponto atende às restrições de capacidade
                    if (route.load + point.weight > vehicle.capacity or 
                        route.volume + point.volume > vehicle.volume_capacity):
                        continue
                    
                    # Verifica se o ponto atende às restrições de janela de tempo
                    travel_time = self.time_matrix[from_idx][to_idx]  # em minutos
                    arrival_time = current_time + travel_time
                    
                    time_window_start = self._time_to_minutes(point.time_window_start)
                    time_window_end = self._time_to_minutes(point.time_window_end)
                    
                    # Se chegar antes da janela, espera até a abertura
                    if arrival_time < time_window_start:
                        arrival_time = time_window_start
                    
                    # Verifica se é possível atender dentro da janela
                    if arrival_time > time_window_end:
                        continue
                    
                    # Adiciona o ponto à lista de candidatos
                    candidates.append({
                        'point': point,
                        'index': i,
                        'distance': distance,
                        'arrival_time': arrival_time
                    })
                
                # Se não há candidatos viáveis, encerra a rota
                if not candidates:
                    break
                
                # Ordena os candidatos por distância (menor primeiro)
                candidates.sort(key=lambda x: x['distance'])
                
                # Calcula os limites para a lista restrita de candidatos (RCL)
                if len(candidates) > 1:
                    min_dist = candidates[0]['distance']
                    max_dist = candidates[-1]['distance']
                    threshold = min_dist + alpha * (max_dist - min_dist)
                    
                    # Filtra os candidatos dentro do limiar
                    rcl = [c for c in candidates if c['distance'] <= threshold]
                else:
                    rcl = candidates
                
                # Escolhe um candidato aleatório da RCL
                selected = random.choice(rcl)
                
                # Adiciona o ponto à rota
                route.add_point(selected['point'], selected['distance'], 
                              selected['distance'] / vehicle.speed_mps)
                
                # Atualiza o tempo atual (tempo de chegada + tempo de serviço)
                current_time = selected['arrival_time'] + selected['point'].service_time
                current_point = selected['point']
                
                # Remove o ponto da lista de pontos a atribuir
                points_to_assign.pop(selected['index'])
            
            # Se a rota tiver pelo menos um ponto além do depósito, adiciona à solução
            if route.points:
                # Volta ao depósito
                from_idx = 0 if current_point == self.depot else self.points.index(current_point) + 1
                distance_to_depot = self.distance_matrix[from_idx][0]
                route.distance += distance_to_depot
                route.duration += distance_to_depot / vehicle.speed_mps
                route.cost += (distance_to_depot / 1000) * vehicle.cost_per_km
                
                routes.append({
                    'vehicle_id': vehicle.id,
                    'vehicle_name': vehicle.name,
                    'points': [{
                        'id': p.id,
                        'name': p.name,
                        'type': p.type,
                        'lat': p.lat,
                        'lng': p.lng,
                        'weight': p.weight,
                        'volume': p.volume,
                        'service_time': p.service_time,
                        'time_window': f"{p.time_window_start} - {p.time_window_end}",
                        'required_skills': list(p.required_skills)
                    } for p in route.points],
                    'distance': route.distance,
                    'duration': route.duration,
                    'cost': route.cost,
                    'load': route.load,
                    'volume': route.volume,
                    'feasible': route.is_feasible()
                })
        
        # Adiciona os pontos não atribuídos à lista de não atribuídos
        unassigned = []
        for point in points_to_assign:
            reasons = []
            
            # Verifica as possíveis razões para não atribuição
            if not any(point.required_skills.issubset(v.skills) for v in self.vehicles):
                reasons.append(f"Nenhum veículo com as habilidades necessárias: {', '.join(point.required_skills)}")
            
            # Verifica se há veículos com capacidade suficiente
            has_capacity = False
            for v in self.vehicles:
                if (v.capacity >= point.weight and 
                    v.volume_capacity >= point.volume and
                    point.required_skills.issubset(v.skills)):
                    has_capacity = True
                    break
            
            if not has_capacity:
                reasons.append("Nenhum veículo com capacidade suficiente")
            
            # Verifica se há veículos disponíveis na janela de tempo
            has_time = False
            point_time_window_start = self._time_to_minutes(point.time_window_start)
            point_time_window_end = self._time_to_minutes(point.time_window_end)
            
            for v in self.vehicles:
                if not point.required_skills.issubset(v.skills):
                    continue
                
                vehicle_start = self._time_to_minutes(v.start_time)
                vehicle_end = self._time_to_minutes(v.end_time)
                
                # Verifica se há sobreposição nas janelas de tempo
                if (point_time_window_start <= vehicle_end and 
                    point_time_window_end >= vehicle_start):
                    has_time = True
                    break
            
            if not has_time:
                reasons.append("Nenhum veículo disponível na janela de tempo")
            
            unassigned.append({
                'point_id': point.id,
                'point_name': point.name,
                'reasons': reasons if reasons else ["Razão desconhecida"],
                'details': {
                    'weight': point.weight,
                    'volume': point.volume,
                    'time_window': f"{point.time_window_start} - {point.time_window_end}",
                    'required_skills': list(point.required_skills)
                }
            })
        
        # Calcula as estatísticas da solução
        total_distance = sum(r['distance'] for r in routes)
        total_cost = sum(r['cost'] for r in routes)
        total_points_served = sum(len(r['points']) for r in routes)
        
        solution = {
            'routes': routes,
            'unassigned': unassigned,
            'stats': {
                'total_distance': total_distance,
                'total_cost': total_cost,
                'total_points_served': total_points_served,
                'total_points': len(self.points),
                'execution_time': 0,  # Será preenchido pelo método chamador
                'feasible': all(r['feasible'] for r in routes) and not unassigned
            }
        }
        
        return solution
    
    def _generate_all_neighbors(self, solution: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Gera todos os vizinhos possíveis para uma solução.
        
        Args:
            solution: Solução atual.
            
        Returns:
            List[Dict]: Lista de soluções vizinhas.
        """
        neighbors = []
        
        # Gera vizinhos trocando pontos na mesma rota
        neighbors.extend(self._swap_intra_route(solution))
        
        # Gera vizinhos trocando pontos entre rotas diferentes
        neighbors.extend(self._swap_inter_route(solution))
        
        # Gera vizinhos realocando pontos
        neighbors.extend(self._relocate(solution))
        
        # Gera vizinhos invertendo subsequências de pontos
        neighbors.extend(self._two_opt(solution))
        
        return neighbors
    
    def _evaluate_solution(self, solution: Dict[str, Any]) -> float:
        """
        Avalia uma solução com base em múltiplos critérios.
        
        Args:
            solution: Solução a ser avaliada.
            
        Returns:
            float: Valor da solução (quanto menor, melhor).
        """
        # Prioriza soluções viáveis
        feasible = all(r['feasible'] for r in solution['routes']) and not solution['unassigned']
        
        # Penaliza soluções inviáveis
        if not feasible:
            return float('inf')
        
        # Calcula o custo total da solução
        total_cost = solution['stats']['total_cost']
        
        # Penaliza soluções que não atendem todos os pontos
        if solution['stats']['total_points_served'] < solution['stats']['total_points']:
            penalty = (solution['stats']['total_points'] - solution['stats']['total_points_served']) * 1000
            total_cost += penalty
        
        return total_cost
    
    def _get_move_difference(self, solution1: Dict[str, Any], solution2: Dict[str, Any]) -> Dict:
        """
        Identifica a diferença entre duas soluções para fins de lista tabu.
        
        Args:
            solution1: Primeira solução.
            solution2: Segunda solução.
            
        Returns:
            Dict: Descrição do movimento que transforma solution1 em solution2.
        """
        # Para simplificar, vamos considerar apenas a diferença nas rotas
        # Em uma implementação mais sofisticada, poderíamos identificar o movimento exato
        return {
            'type': 'move',
            'routes1': [(r['vehicle_id'], [p['id'] for p in r['points']]) for r in solution1['routes']],
            'routes2': [(r['vehicle_id'], [p['id'] for p in r['points']]) for r in solution2['routes']]
        }
    
    def _is_same_move(self, move1: Dict, move2: Dict) -> bool:
        """
        Verifica se dois movimentos são iguais para fins de lista tabu.
        
        Args:
            move1: Primeiro movimento.
            move2: Segundo movimento.
            
        Returns:
            bool: True se os movimentos forem considerados iguais, False caso contrário.
        """
        if move1['type'] != move2['type']:
            return False
        
        # Para simplificar, consideramos movimentos iguais se afetarem as mesmas rotas
        # Em uma implementação mais sofisticada, poderíamos ser mais precisos
        return (sorted(move1['routes1']) == sorted(move2['routes1']) and 
                sorted(move1['routes2']) == sorted(move2['routes2']))
    
    def format_solution(self, solution: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Formata a solução para exibição.
        
        Args:
            solution: Solução a ser formatada. Se None, usa a solução atual.
            
        Returns:
            Dict: Solução formatada.
        """
        if solution is None:
            if not hasattr(self, 'solution') or not self.solution:
                return {"error": "Nenhuma solução disponível"}
            solution = self.solution
        
        formatted = {
            "summary": {
                "total_routes": len(solution['routes']),
                "total_distance_km": solution['stats']['total_distance'] / 1000,
                "total_cost": solution['stats']['total_cost'],
                "points_served": solution['stats']['total_points_served'],
                "total_points": solution['stats']['total_points'],
                "feasible": solution['stats']['feasible'],
                "execution_time_seconds": solution['stats']['execution_time']
            },
            "routes": [],
            "unassigned_points": solution['unassigned']
        }
        
        for route in solution['routes']:
            vehicle = next(v for v in self.vehicles if v.id == route['vehicle_id'])
            
            formatted_route = {
                "vehicle_id": route['vehicle_id'],
                "vehicle_name": route['vehicle_name'],
                "driver": vehicle.driver_name,
                "driver_phone": vehicle.driver_phone,
                "start_location": {
                    "lat": self.depot.lat,
                    "lng": self.depot.lng,
                    "address": self.depot.address or "Depósito"
                },
                "end_location": {
                    "lat": self.depot.lat,
                    "lng": self.depot.lng,
                    "address": self.depot.address or "Depósito"
                },
                "total_distance_km": route['distance'] / 1000,
                "total_duration_minutes": route['duration'] / 60,
                "total_cost": route['cost'],
                "load_kg": route['load'],
                "volume_m3": route['volume'],
                "start_time": vehicle.start_time,
                "end_time": self._add_minutes_to_time(vehicle.start_time, route['duration'] / 60),
                "stops": []
            }
            
            # Adiciona o depósito como ponto de partida
            formatted_route['stops'].append({
                "type": "depot",
                "name": self.depot.name or "Depósito",
                "address": self.depot.address or "",
                "lat": self.depot.lat,
                "lng": self.depot.lng,
                "arrival_time": vehicle.start_time,
                "departure_time": vehicle.start_time,
                "waiting_time": 0,
                "service_time": 0
            })
            
            current_time = self._time_to_minutes(vehicle.start_time)
            previous_point = self.depot
            
            for i, point_data in enumerate(route['points']):
                point = next(p for p in self.points if p.id == point_data['id'])
                
                # Calcula o tempo de viagem até este ponto
                from_idx = 0 if i == 0 else (self.points.index(previous_point) + 1)
                to_idx = self.points.index(point) + 1
                travel_time = self.time_matrix[from_idx][to_idx]  # em minutos
                
                # Atualiza o tempo de chegada
                arrival_time = current_time + travel_time
                
                # Verifica se chegou antes da janela de tempo
                time_window_start = self._time_to_minutes(point.time_window_start)
                waiting_time = max(0, time_window_start - arrival_time)
                
                # Tempo de serviço
                service_time = point.service_time
                
                # Tempo de partida
                departure_time = max(arrival_time, time_window_start) + service_time
                
                # Adiciona a parada
                formatted_route['stops'].append({
                    "type": "delivery" if point.type == "delivery" else "pickup",
                    "id": point.id,
                    "name": point.name,
                    "address": point.address or "",
                    "lat": point.lat,
                    "lng": point.lng,
                    "weight_kg": point.weight,
                    "volume_m3": point.volume,
                    "time_window": f"{point.time_window_start} - {point.time_window_end}",
                    "required_skills": list(point.required_skills),
                    "arrival_time": self._minutes_to_time(arrival_time),
                    "departure_time": self._minutes_to_time(departure_time),
                    "travel_time_minutes": travel_time,
                    "waiting_time_minutes": waiting_time,
                    "service_time_minutes": service_time,
                    "notes": point.notes or ""
                })
                
                current_time = departure_time
                previous_point = point
            
            # Adiciona o retorno ao depósito
            if route['points']:
                from_idx = self.points.index(previous_point) + 1
                distance_to_depot = self.distance_matrix[from_idx][0]
                time_to_depot = self.time_matrix[from_idx][0]
                
                formatted_route['stops'].append({
                    "type": "depot",
                    "name": self.depot.name or "Depósito",
                    "address": self.depot.address or "",
                    "lat": self.depot.lat,
                    "lng": self.depot.lng,
                    "arrival_time": self._minutes_to_time(current_time + time_to_depot),
                    "departure_time": self._minutes_to_time(current_time + time_to_depot),
                    "travel_time_minutes": time_to_depot,
                    "waiting_time": 0,
                    "service_time": 0
                })
            
            formatted["routes"].append(formatted_route)
        
        return formatted
    
    def export_to_json(self, filename: str, solution: Optional[Dict[str, Any]] = None) -> bool:
        """
        Exporta a solução para um arquivo JSON.
        
        Args:
            filename: Nome do arquivo de saída.
            solution: Solução a ser exportada. Se None, usa a solução atual.
            
        Returns:
            bool: True se a exportação foi bem-sucedida, False caso contrário.
        """
        try:
            formatted = self.format_solution(solution)
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(formatted, f, ensure_ascii=False, indent=2)
            print(f"Solução exportada para {filename}")
            return True
        except Exception as e:
            print(f"Erro ao exportar solução: {e}")
            return False
    
    def export_to_csv(self, filename: str, solution: Optional[Dict[str, Any]] = None) -> bool:
        """
        Exporta a solução para um arquivo CSV.
        
        Args:
            filename: Nome do arquivo de saída.
            solution: Solução a ser exportada. Se None, usa a solução atual.
            
        Returns:
            bool: True se a exportação foi bem-sucedida, False caso contrário.
        """
        try:
            formatted = self.format_solution(solution)
            
            # Cria um DataFrame para as rotas
            routes_data = []
            for route in formatted['routes']:
                for stop in route['stops']:
                    if stop['type'] != 'depot':  # Ignora o depósito
                        routes_data.append({
                            'rota_id': route['vehicle_id'],
                            'veiculo': route['vehicle_name'],
                            'motorista': route['driver'],
                            'telefone': route['driver_phone'],
                            'tipo_parada': stop['type'],
                            'parada_id': stop['id'],
                            'nome': stop['name'],
                            'endereco': stop['address'],
                            'lat': stop['lat'],
                            'lng': stop['lng'],
                            'peso_kg': stop['weight_kg'],
                            'volume_m3': stop['volume_m3'],
                            'janela_tempo': stop['time_window'],
                            'chegada': stop['arrival_time'],
                            'partida': stop['departure_time'],
                            'tempo_viagem_min': stop['travel_time_minutes'],
                            'tempo_espera_min': stop['waiting_time_minutes'],
                            'tempo_servico_min': stop['service_time_minutes'],
                            'habilidades_necessarias': ', '.join(stop['required_skills']),
                            'observacoes': stop.get('notes', '')
                        })
            
            # Cria um DataFrame para os pontos não atribuídos
            unassigned_data = []
            for point in formatted['unassigned_points']:
                unassigned_data.append({
                    'ponto_id': point['point_id'],
                    'nome': point['point_name'],
                    'razoes': '; '.join(point['reasons']),
                    'peso_kg': point['details']['weight'],
                    'volume_m3': point['details']['volume'],
                    'janela_tempo': point['details']['time_window'],
                    'habilidades_necessarias': ', '.join(point['details']['required_skills'])
                })
            
            # Exporta para CSV
            if routes_data:
                routes_df = pd.DataFrame(routes_data)
                routes_df.to_csv(f"{filename}_rotas.csv", index=False, encoding='utf-8-sig')
                print(f"Rotas exportadas para {filename}_rotas.csv")
            
            if unassigned_data:
                unassigned_df = pd.DataFrame(unassigned_data)
                unassigned_df.to_csv(f"{filename}_nao_atribuidos.csv", index=False, encoding='utf-8-sig')
                print(f"Pontos não atribuídos exportados para {filename}_nao_atribuidos.csv")
            
            return True
            
        except Exception as e:
            print(f"Erro ao exportar para CSV: {e}")
            return False
    
    def visualize_routes(self, solution: Optional[Dict[str, Any]] = None, 
                        filename: str = "mapa_rotas.html",
                        include_river: bool = True) -> bool:
        """
        Gera um mapa interativo mostrando as rotas otimizadas.
        
        Args:
            solution: Solução a ser visualizada. Se None, usa a solução atual.
            filename: Nome do arquivo HTML de saída.
            include_river: Se True, inclui um rio simulado no mapa.
            
        Returns:
            bool: True se a visualização foi gerada com sucesso, False caso contrário.
        """
        # Verifica se há uma solução disponível
        if solution is None:
            if not self.solution:
                print("Nenhuma solução disponível para visualização.")
                return False
            solution = self.solution
            
        # Verifica se o grafo foi carregado
        if not self.graph:
            print("Grafo de ruas não carregado. Execute load_map() primeiro.")
            return False
            
        # Tenta importar as bibliotecas necessárias
        try:
            import folium
            from folium import plugins
            import networkx as nx
        except ImportError as e:
            print(f"Erro ao importar bibliotecas necessárias: {e}")
            print("Certifique-se de instalar as dependências com: pip install folium networkx")
            return False
            
        try:
            # Cria um mapa centrado na área de interesse
            nodes = list(self.graph.nodes(data=True))
            if not nodes:
                print("Erro: Nenhum nó encontrado no grafo.")
                return False
                
            # Calcula o centro do mapa baseado nos nós disponíveis
            lats = [data.get('y', 0) for _, data in nodes if 'y' in data]
            lons = [data.get('x', 0) for _, data in nodes if 'x' in data]
            
            if not lats or not lons:
                print("Erro: Não foi possível determinar a localização central.")
                return False
                
            avg_lat = sum(lats) / len(lats)
            avg_lon = sum(lons) / len(lons)
            
            # Cria o mapa do Folium
            m = folium.Map(location=[avg_lat, avg_lon], zoom_start=13, tiles='OpenStreetMap')
            
            # Adiciona o rio ao mapa, se solicitado
            if include_river:
                try:
                    # Gera um rio simulado
                    river_gdf = self._generate_river(center_lat=avg_lat, center_lng=avg_lon)
                    
                    # Adiciona o rio como uma camada de polígono azul
                    folium.GeoJson(
                        river_gdf,
                        style_function=lambda x: {
                            'fillColor': '#1E90FF',  # Azul Dodger
                            'color': '#1E90FF',
                            'weight': 2,
                            'fillOpacity': 0.5
                        },
                        name='Rio Simulado',
                        tooltip='Rio (obstáculo para rotas)'
                    ).add_to(m)
                except Exception as e:
                    print(f"Aviso: Não foi possível adicionar o rio ao mapa: {e}")
            
            # Cria um cluster de marcadores
            marker_cluster = plugins.MarkerCluster().add_to(m)
            
            # Cria um grupo para pontos não atribuídos
            unassigned_group = folium.FeatureGroup(name='Pontos não atribuídos')
            m.add_child(unassigned_group)
            
            # Cores para as rotas
            colors = [
                'blue', 'green', 'purple', 'orange', 'darkred',
                'lightred', 'beige', 'darkblue', 'darkgreen', 'cadetblue',
                'darkpurple', 'pink', 'lightblue', 'lightgreen', 'gray'
            ]
            
            # Adiciona o depósito ao mapa
            if hasattr(self.depot, 'lat') and hasattr(self.depot, 'lng'):
                folium.Marker(
                    [self.depot.lat, self.depot.lng],
                    popup=f'<b>Depósito</b><br>ID: {self.depot.id}',
                    icon=folium.Icon(icon='warehouse', prefix='fa', color='green'),
                    tooltip='Depósito'
                ).add_to(marker_cluster)
            
            # Para cada rota na solução
            for i, route in enumerate(solution.get('routes', [])):
                if not route or 'points' not in route:
                    continue
                    
                color = colors[i % len(colors)]
                route_points = []
                
                # Adiciona o depósito inicial
                route_points.append(self.depot)
                
                # Adiciona os pontos de entrega
                for point_data in route['points']:
                    point = None
                    # Tenta encontrar o ponto na lista de pontos
                    for p in self.points:
                        if hasattr(p, 'id') and str(p.id) == str(point_data.get('id', '')):
                            point = p
                            break
                    
                    # Se não encontrou, tenta criar um ponto básico com as coordenadas
                    if point is None and 'lat' in point_data and 'lng' in point_data:
                        try:
                            point = Point(
                                id=str(point_data.get('id', '')),
                                type=point_data.get('type', 'delivery'),
                                name=point_data.get('name', ''),
                                address=point_data.get('address', ''),
                                lat=float(point_data['lat']),
                                lng=float(point_data['lng']),
                                order=point_data.get('order', 0),
                                quantity=point_data.get('quantity', 1),
                                weight=point_data.get('weight', 0),
                                volume=point_data.get('volume', 0),
                                time_window_start=point_data.get('time_window_start', '08:00'),
                                time_window_end=point_data.get('time_window_end', '18:00'),
                                service_time=point_data.get('service_time', 10),
                                priority=point_data.get('priority', 1)
                            )
                        except Exception as e:
                            print(f"Erro ao criar ponto: {e}")
                            continue
                    
                    # Verifica se o ponto tem coordenadas válidas
                    if point and hasattr(point, 'lat') and hasattr(point, 'lng'):
                        route_points.append(point)
                    else:
                        print(f"Aviso: Ponto {point_data.get('id', 'desconhecido')} sem coordenadas válidas")
                
                if len(route_points) <= 1:  # Se não houver pontos na rota
                    continue
                    
                route_points.append(self.depot)  # Volta ao depósito
                
                # Desenha cada segmento da rota usando o caminho real
                for j in range(len(route_points) - 1):
                    start_point = route_points[j]
                    end_point = route_points[j + 1]
                    
                    # Verifica se os pontos têm coordenadas válidas
                    if not all(hasattr(p, 'lat') and hasattr(p, 'lng') and p.lat is not None and p.lng is not None 
                             for p in [start_point, end_point]):
                        print(f"Aviso: Ponto sem coordenadas válidas na rota {i+1}, segmento {j}")
                        print(f"Start point: {getattr(start_point, 'id', '?')} - Lat: {getattr(start_point, 'lat', 'N/A')}, Lng: {getattr(start_point, 'lng', 'N/A')}")
                        print(f"End point: {getattr(end_point, 'id', '?')} - Lat: {getattr(end_point, 'lat', 'N/A')}, Lng: {getattr(end_point, 'lng', 'N/A')}")
                        
                        # Desenha uma linha reta como fallback
                        folium.PolyLine(
                            [(start_point.lat, start_point.lng), (end_point.lat, end_point.lng)],
                            color=color,
                            weight=2.0,
                            opacity=0.7,
                            dash_array='5,5',
                            popup=f"Rota {i+1}: {route.get('vehicle_name', '')} (rota direta)"
                        ).add_to(m)
                        continue
                        
                    try:
                        # Converte as coordenadas para o formato esperado (EPSG:4326)
                        try:
                            # Converte os pontos para nós no grafo
                            start_node = ox.distance.nearest_nodes(
                                self.graph, 
                                start_point.lng, 
                                start_point.lat
                            )
                            end_node = ox.distance.nearest_nodes(
                                self.graph, 
                                end_point.lng, 
                                end_point.lat
                            )
                            
                            if start_node is None or end_node is None:
                                raise ValueError("Não foi possível encontrar nós próximos para os pontos")
                                
                        except Exception as e:
                            print(f"Erro ao encontrar nós mais próximos: {e}")
                            # Tenta com coordenadas invertidas (às vezes há confusão entre lat/lng)
                            try:
                                start_node = ox.distance.nearest_nodes(
                                    self.graph, 
                                    start_point.lat, 
                                    start_point.lng
                                )
                                end_node = ox.distance.nearest_nodes(
                                    self.graph, 
                                    end_point.lat, 
                                    end_point.lng
                                )
                                
                                if start_node is None or end_node is None:
                                    raise ValueError("Não foi possível encontrar nós próximos para os pontos (tentativa com coordenadas invertidas)")
                                    
                            except Exception as e2:
                                print(f"Erro ao tentar com coordenadas invertidas: {e2}")
                                raise e
                        
                        # Tenta obter a rota usando OSRM primeiro
                        try:
                            # Obtém as coordenadas dos pontos de origem e destino
                            orig_lat, orig_lng = start_point.lat, start_point.lng
                            dest_lat, dest_lng = end_point.lat, end_point.lng
                            
                            # URL do serviço OSRM (pode ser local ou público)
                            url = f"http://router.project-osrm.org/route/v1/driving/{orig_lng},{orig_lat};{dest_lng},{dest_lat}?overview=full&geometries=geojson"
                            
                            # Faz a requisição para o OSRM
                            response = requests.get(url, timeout=10)
                            route_data = response.json()
                            
                            if response.status_code == 200 and 'routes' in route_data and len(route_data['routes']) > 0:
                                # Extrai as coordenadas da rota
                                route_geometry = route_data['routes'][0]['geometry']
                                if route_geometry['type'] == 'LineString':
                                    # Converte as coordenadas para o formato (lat, lng) do folium
                                    path_coords = [(coord[1], coord[0]) for coord in route_geometry['coordinates']]
                                    
                                    # Adiciona a rota com setas
                                    self._add_route_with_arrows(
                                        m,
                                        path_coords,
                                        color=color,
                                        popup=f"Rota {i+1}: {route.get('vehicle_name', '')}",
                                        tooltip=f"De: {getattr(start_point, 'id', '?')} → Para: {getattr(end_point, 'id', '?')}"
                                    )
                                    
                                    continue  # Pula para o próximo segmento se a rota OSRM foi bem-sucedida
                                
                            # Se chegou aqui, a rota OSRM falhou
                            print(f"Falha ao obter rota OSRM entre {getattr(start_point, 'id', '?')} e {getattr(end_point, 'id', '?')}")
                            
                        except Exception as osrm_err:
                            print(f"Erro ao obter rota do OSRM: {osrm_err}")
                        
                        # Fallback: usa o grafo direcional
                        try:
                            # Tenta encontrar o caminho mais curto no grafo direcional
                            path = nx.shortest_path(
                                self.graph,
                                source=start_node,
                                target=end_node,
                                weight='length'
                            )
                            
                            # Extrai as coordenadas do caminho
                            path_coords = []
                            for u, v in zip(path[:-1], path[1:]):
                                edge_data = self.graph.get_edge_data(u, v)[0]
                                if 'geometry' in edge_data:
                                    # Se a aresta tem geometria, extrai os pontos
                                    xs, ys = edge_data['geometry'].xy
                                    for x, y in zip(xs, ys):
                                        lat, lng = ox.projection.project_geometry(
                                            Point(x, y),
                                            crs=self.graph.graph['crs'],
                                            to_crs='EPSG:4326'
                                        ).coords[0]
                                        path_coords.append((lat, lng))
                                else:
                                    # Se não tem geometria, conecta os nós diretamente
                                    u_data = self.graph.nodes[u]
                                    v_data = self.graph.nodes[v]
                                    path_coords.append((u_data['y'], u_data['x']))
                                    path_coords.append((v_data['y'], v_data['x']))
                            
                            # Remove pontos duplicados consecutivos
                            clean_path_coords = []
                            prev_coord = None
                            for coord in path_coords:
                                if prev_coord is None or (abs(coord[0] - prev_coord[0]) > 1e-6 or 
                                                       abs(coord[1] - prev_coord[1]) > 1e-6):
                                    clean_path_coords.append(coord)
                                    prev_coord = coord
                            
                            if len(clean_path_coords) > 1:
                                # Adiciona a rota com setas
                                self._add_route_with_arrows(
                                    m,
                                    clean_path_coords,
                                    color=color,
                                    popup=f"Rota {i+1}: {route.get('vehicle_name', '')} (rota aproximada)",
                                    tooltip=f"De: {getattr(start_point, 'id', '?')} → Para: {getattr(end_point, 'id', '?')}",
                                    dash_array='5,5'  # Linha tracejada para indicar rota aproximada
                                )
                                
                                # Tenta com grafo não direcionado como último recurso
                                try:
                                    undirected_graph = self.graph.to_undirected()
                                    path = nx.shortest_path(
                                        undirected_graph,
                                        source=start_node,
                                        target=end_node,
                                        weight='length'
                                    )
                                    
                                    # Extrai as coordenadas do caminho
                                    path_coords = []
                                    for u, v in zip(path[:-1], path[1:]):
                                        edge_data = undirected_graph.get_edge_data(u, v)[0]
                                        if 'geometry' in edge_data:
                                            # Se a aresta tem geometria, extrai os pontos
                                            xs, ys = edge_data['geometry'].xy
                                            for x, y in zip(xs, ys):
                                                lat, lng = ox.projection.project_geometry(
                                                    Point(x, y),
                                                    crs=undirected_graph.graph['crs'],
                                                    to_crs='EPSG:4326'
                                                ).coords[0]
                                                path_coords.append((lat, lng))
                                        else:
                                            # Se não tem geometria, conecta os nós diretamente
                                            u_data = undirected_graph.nodes[u]
                                            v_data = undirected_graph.nodes[v]
                                            path_coords.append((u_data['y'], u_data['x']))
                                            path_coords.append((v_data['y'], v_data['x']))
                                    
                                    # Remove pontos duplicados consecutivos
                                    clean_path_coords = []
                                    prev_coord = None
                                    for coord in path_coords:
                                        if prev_coord is None or (abs(coord[0] - prev_coord[0]) > 1e-6 or 
                                                               abs(coord[1] - prev_coord[1]) > 1e-6):
                                            clean_path_coords.append(coord)
                                            prev_coord = coord
                                    
                                    if len(clean_path_coords) > 1:
                                        # Adiciona a rota com setas
                                        self._add_route_with_arrows(
                                            m,
                                            clean_path_coords,
                                            color='purple',
                                            popup=f"Rota {i+1}: {route.get('vehicle_name', '')} (rota não direcionada)",
                                            tooltip=f"De: {getattr(start_point, 'id', '?')} → Para: {getattr(end_point, 'id', '?')}",
                                            dash_array='3,3'  # Linha tracejada fina para indicar rota não direcionada
                                        )
                                        continue
                                        
                                except (nx.NetworkXNoPath, nx.NodeNotFound) as undirected_err:
                                    print(f"Erro ao obter rota não direcionada: {undirected_err}")
                                
                                # Fallback final: linha reta
                                self._add_route_with_arrows(
                                    m,
                                    [(start_point.lat, start_point.lng), (end_point.lat, end_point.lng)],
                                    color='red',
                                    popup=f"Rota {i+1}: {route.get('vehicle_name', '')} (rota direta)",
                                    tooltip=f"Rota direta (sem caminho encontrado): {getattr(start_point, 'id', '?')} → {getattr(end_point, 'id', '?')}",
                                    dash_array='10,10'  # Linha tracejada grossa
                                )
                                print(f"Usando rota direta entre {getattr(start_point, 'id', '?')} e {getattr(end_point, 'id', '?')}")
                                
                                # O mesmo processo de extração de coordenadas para o caminho invertido
                                edge_nodes = list(zip(path[:-1], path[1:]))
                                path_coords = []
                                for u, v in edge_nodes:
                                    if self.graph.has_edge(u, v):
                                        if 'geometry' in self.graph[u][v][0]:
                                            coords = list(self.graph[u][v][0]['geometry'].coords)
                                            for x, y in coords:
                                                lat, lng = ox.projection.project_geometry(
                                                    Point(x, y),
                                                    crs=self.graph.graph['crs'],
                                                    to_crs='EPSG:4326'
                                                ).coords[0]
                                                path_coords.append((lat, lng))
                                        else:
                                            u_data = self.graph.nodes[u]
                                            v_data = self.graph.nodes[v]
                                            path_coords.extend([
                                                (u_data['y'], u_data['x']),
                                                (v_data['y'], v_data['x'])
                                            ])
                                
                                # Remove pontos duplicados consecutivos
                                clean_path_coords = []
                                for coord in path_coords:
                                    if not clean_path_coords or coord != clean_path_coords[-1]:
                                        clean_path_coords.append(coord)
                                path_coords = clean_path_coords
                                
                                if path_coords and len(path_coords) > 1:
                                    try:
                                        # Adiciona a linha principal para o caminho não direcionado
                                        folium.PolyLine(
                                            path_coords,
                                            color=color,
                                            weight=4.0,
                                            opacity=0.8,
                                            popup=f"Rota {i+1}: {route.get('vehicle_name', '')}",
                                            line_cap='round',
                                            line_join='round'
                                        ).add_to(m)
                                        
                                        # Adiciona seta no final do caminho
                                        last_segment = path_coords[-2:] if len(path_coords) >= 2 else path_coords
                                        folium.PolyLine(
                                            last_segment,
                                            color=color,
                                            weight=5.0,
                                            opacity=1.0,
                                            arrow_style='->',
                                            arrow_head=5
                                        ).add_to(m)
                                        
                                        # Adiciona setas intermediárias para rotas longas
                                        if len(path_coords) > 10:
                                            step = max(1, len(path_coords) // 5)
                                            for k in range(0, len(path_coords)-1, step):
                                                if k + 1 < len(path_coords):
                                                    segment = path_coords[k:k+2]
                                                    folium.PolyLine(
                                                        segment,
                                                        color=color,
                                                        weight=5.0,
                                                        opacity=1.0,
                                                        arrow_style='->',
                                                        arrow_head=3
                                                    ).add_to(m)
                                    except Exception as e:
                                        print(f"Erro ao desenhar rota não direcionada: {e}")
                                        # Se falhar, desenha uma linha reta
                                        folium.PolyLine(
                                            [(start_point.lat, start_point.lng), (end_point.lat, end_point.lng)],
                                            color='red',
                                            weight=2.0,
                                            opacity=0.7,
                                            dash_array='5,5',
                                            popup=f"Rota {i+1}: {route.get('vehicle_name', '')} (rota direta - falha no desenho)"
                                        ).add_to(m)
                            
                        except Exception as e:
                            print(f"Aviso: Não foi possível traçar rota entre pontos: {e}")
                            # Se não conseguir encontrar o caminho, desenha uma linha reta com estilo de erro
                            folium.PolyLine(
                                [(start_point.lat, start_point.lng), (end_point.lat, end_point.lng)],
                                color='red',
                                weight=2.0,
                                opacity=0.7,
                                dash_array='5,5',
                                popup=f"Rota {i+1}: {route.get('vehicle_name', '')} (rota direta - sem caminho encontrado)",
                                tooltip=f"Erro: {str(e)[:100]}"
                            ).add_to(m)
                    
                    except Exception as e:
                        print(f"Erro ao processar segmento da rota: {e}")
                        continue
                
                # Adiciona marcadores para os pontos da rota
                for point_data in route['points']:
                    # Encontra o ponto original na lista de pontos
                    point = None
                    for p in self.points:
                        if hasattr(p, 'id') and str(p.id) == str(point_data.get('id', '')):
                            point = p
                            break
                            
                    if not point or not hasattr(point, 'lat') or not hasattr(point, 'lng'):
                        print(f"Aviso: Ponto {point_data.get('id', 'desconhecido')} não encontrado ou sem coordenadas válidas")
                        continue
                        
                    # Ícone baseado no tipo de ponto
                    icon_type = 'truck' if getattr(point, 'type', '') == 'delivery' else 'box'
                    
                    # Cria o popup com informações do ponto
                    popup_html = f"<b>{getattr(point, 'name', 'Sem nome')}</b><br>"
                    popup_html += f"Tipo: {getattr(point, 'type', 'desconhecido')}<br>"
                    popup_html += f"Peso: {getattr(point, 'weight', 0)} kg<br>"
                    popup_html += f"Volume: {getattr(point, 'volume', 0)} m³<br>"
                    popup_html += f"Janela: {getattr(point, 'time_window_start', '')} - {getattr(point, 'time_window_end', '')}<br>"
                    
                    # Adiciona habilidades se existirem
                    if hasattr(point, 'required_skills') and point.required_skills:
                        popup_html += f"Habilidades: {', '.join(point.required_skills)}<br>"
                    
                    # Adiciona notas se existirem
                    if hasattr(point, 'notes') and point.notes:
                        popup_html += f"<i>{point.notes}</i>"
                    
                    # Cria o marcador para o ponto
                    folium.Marker(
                        [point.lat, point.lng],
                        popup=folium.Popup(popup_html, max_width=300),
                        icon=folium.Icon(color=color, icon=icon_type, prefix='fa')
                    ).add_to(m)
            
            # Adiciona pontos não atribuídos
            unassigned_points = solution.get('unassigned', [])
            if isinstance(unassigned_points, dict):
                unassigned_items = unassigned_points.items()
            elif isinstance(unassigned_points, list):
                unassigned_items = [(p.get('id'), p.get('reason', 'Razão desconhecida')) for p in unassigned_points]
            else:
                unassigned_items = []
                
            for point_id, reason in unassigned_items:
                # Encontra o ponto original na lista de pontos
                point = next((p for p in self.points if str(getattr(p, 'id', '')) == str(point_id)), None)
                
                # Verifica se o ponto existe e tem coordenadas válidas
                if point and hasattr(point, 'lat') and hasattr(point, 'lng'):
                    # Cria o popup com informações do ponto não atribuído
                    popup_html = f"<b>Não atribuído</b><br>"
                    popup_html += f"ID: {getattr(point, 'id', '')}<br>"
                    popup_html += f"Nome: {getattr(point, 'name', 'Sem nome')}<br>"
                    popup_html += f"Motivo: {reason}<br>"
                    
                    # Adiciona habilidades se existirem
                    if hasattr(point, 'required_skills') and point.required_skills:
                        popup_html += f"Habilidades requeridas: {', '.join(point.required_skills)}<br>"
                    
                    # Adiciona notas se existirem
                    if hasattr(point, 'notes') and point.notes:
                        popup_html += f"<i>{point.notes}</i>"
                    
                    # Cria o marcador para pontos não atribuídos
                    folium.Marker(
                        [point.lat, point.lng],
                        popup=folium.Popup(popup_html, max_width=300),
                        icon=folium.Icon(color='red', icon='times', prefix='fa'),
                        tooltip=f'Não atribuído: {getattr(point, "id", "")}'
                    ).add_to(unassigned_group)
            
            # Adiciona o grupo de não atribuídos ao mapa
            unassigned_group.add_to(m)
            
            # Adiciona controle de camadas
            folium.LayerControl().add_to(m)
            
            # Salva o mapa
            m.save(filename)
            print(f"Mapa salvo como {filename}. Abra no navegador para visualizar.")
            
            return True
            
        except Exception as e:
            print(f"Erro ao gerar visualização: {e}")
            return False
    
    def _add_minutes_to_time(self, time_str: str, minutes: float) -> str:
        """
        Adiciona minutos a um horário no formato HH:MM.
        
        Args:
            time_str: Horário no formato HH:MM.
            minutes: Minutos a serem adicionados.
            
        Returns:
            str: Novo horário no formato HH:MM.
        """
        from datetime import datetime, timedelta
        
        try:
            # Converte a string para um objeto datetime
            time_obj = datetime.strptime(time_str, '%H:%M')
            
            # Adiciona os minutos
            new_time = time_obj + timedelta(minutes=minutes)
            
            # Retorna no formato HH:MM
            return new_time.strftime('%H:%M')
        except Exception as e:
            print(f"Erro ao adicionar minutos ao horário: {e}")
            return time_str
    
    def _minutes_to_time(self, minutes: float) -> str:
        """
        Converte minutos desde a meia-noite para o formato HH:MM.
        
        Args:
            minutes: Minutos desde a meia-noite.
            
        Returns:
            str: Horário no formato HH:MM.
        """
        try:
            hours = int(minutes // 60)
            mins = int(minutes % 60)
            return f"{hours:02d}:{mins:02d}"
        except Exception as e:
            print(f"Erro ao converter minutos para horário: {e}")
            return "00:00"
