import os
import hashlib
import logging
from typing import List, Dict, Any, Set, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from datetime import time as dt_time
import networkx as nx
import osmnx as ox
import random
import copy

# --- Configurações e Inicialização ---

logger = logging.getLogger(__name__)
ox.settings.use_cache = True
ox.settings.log_console = False
ox.settings.cache_folder = "./cache/osmnx"
os.makedirs(ox.settings.cache_folder, exist_ok=True)

router = APIRouter(
    prefix="/optimization",
    tags=["optimization"],
)

# --- Modelos Pydantic ---

class Point(BaseModel):
    id: str
    lat: float
    lng: float
    weight: float = 0.0
    volume: float = 0.0
    time_window_start: str = "00:00"
    time_window_end: str = "23:59"
    service_time: int = 0
    required_skills: Set[str] = set()

class Vehicle(BaseModel):
    id: str
    capacity: float = 1000.0
    volume_capacity: float = 10.0
    start_time: str = "00:00"
    end_time: str = "23:59"
    speed: float = 50.0
    cost_per_km: float = 1.0
    skills: Set[str] = set()

    @property
    def speed_mps(self) -> float:
        return (self.speed * 1000) / 3600

class OptimizationRequest(BaseModel):
    vehicles: List[Vehicle]
    points: List[Point]
    depot: Point
    location: str = Field(..., description="Nome da cidade/região para carregar o mapa. Ex: 'São Paulo, Brazil'")
    method: str = "vnd"

# --- Lógica de Roteirização ---

class Route:
    def __init__(self, vehicle: Vehicle, depot: Point):
        self.vehicle = vehicle
        self.points: List[Point] = [depot]
        self.distance: float = 0.0
        self.duration: float = 0.0
        self.cost: float = 0.0
        self.load: float = 0.0
        self.volume: float = 0.0

class RobustRouter:
    def __init__(self, request: OptimizationRequest):
        self.request = request
        self.graph = None
        self.distance_matrix = {}
        self.time_matrix = {}
        self.all_points = {p.id: p for p in [request.depot] + request.points}

    def solve(self) -> Dict[str, Any]:
        self._load_map()
        self._calculate_matrices()

        if self.request.method == 'vnd':
            initial_solution = self._generate_initial_solution()
            optimized_solution = self._solve_with_vnd(initial_solution)
            return self._format_solution(optimized_solution)
        else:
            raise NotImplementedError(f"Método '{self.request.method}' não implementado.")

    def _load_map(self):
        cache_key = hashlib.md5(self.request.location.encode()).hexdigest()
        cache_path = os.path.join(ox.settings.cache_folder, f"{cache_key}.graphml")

        if os.path.exists(cache_path):
            self.graph = ox.load_graphml(cache_path)
        else:
            self.graph = ox.graph_from_place(self.request.location, network_type='drive')
            ox.save_graphml(self.graph, cache_path)

    def _calculate_matrices(self):
        point_ids = list(self.all_points.keys())
        nodes = {pid: ox.distance.nearest_nodes(self.graph, p.lng, p.lat) for pid, p in self.all_points.items()}

        for origin_id in point_ids:
            self.distance_matrix[origin_id] = {}
            self.time_matrix[origin_id] = {}
            for dest_id in point_ids:
                if origin_id == dest_id:
                    self.distance_matrix[origin_id][dest_id] = 0
                    self.time_matrix[origin_id][dest_id] = 0
                    continue
                try:
                    distance = nx.shortest_path_length(self.graph, nodes[origin_id], nodes[dest_id], weight='length')
                    self.distance_matrix[origin_id][dest_id] = distance
                    self.time_matrix[origin_id][dest_id] = distance / self.request.vehicles[0].speed_mps
                except nx.NetworkXNoPath:
                    self.distance_matrix[origin_id][dest_id] = float('inf')
                    self.time_matrix[origin_id][dest_id] = float('inf')

    def _generate_initial_solution(self) -> List[Route]:
        routes = [Route(v, self.request.depot) for v in self.request.vehicles]
        unassigned_points = self.request.points[:]
        random.shuffle(unassigned_points)

        for point in unassigned_points:
            best_route = None
            min_cost = float('inf')
            for route in routes:
                if self._can_add_point(route, point):
                    cost = self._calculate_insertion_cost(route, point)
                    if cost < min_cost:
                        min_cost = cost
                        best_route = route
            if best_route:
                self._add_point_to_route(best_route, point)
        return routes

    def _solve_with_vnd(self, routes: List[Route]) -> List[Route]:
        best_routes = routes
        best_cost = self._calculate_solution_cost(best_routes)
        
        neighborhoods = [self._relocate_neighborhood, self._exchange_neighborhood, self._two_opt_neighborhood]
        
        improved = True
        while improved:
            improved = False
            for neighborhood in neighborhoods:
                new_routes = neighborhood(copy.deepcopy(best_routes))
                new_cost = self._calculate_solution_cost(new_routes)
                if new_cost < best_cost:
                    best_routes = new_routes
                    best_cost = new_cost
                    improved = True
                    break
        return best_routes

    def _calculate_insertion_cost(self, route: Route, point: Point) -> float:
        last_point = route.points[-1]
        return self.distance_matrix[last_point.id][point.id]

    def _can_add_point(self, route: Route, point: Point) -> bool:
        return (
            route.load + point.weight <= route.vehicle.capacity and
            route.volume + point.volume <= route.vehicle.volume_capacity and
            point.required_skills.issubset(route.vehicle.skills)
        )

    def _add_point_to_route(self, route: Route, point: Point):
        last_point = route.points[-1]
        route.distance += self.distance_matrix[last_point.id][point.id]
        route.duration += self.time_matrix[last_point.id][point.id] + point.service_time * 60
        route.load += point.weight
        route.volume += point.volume
        route.points.append(point)

    def _recalculate_route_metrics(self, route: Route):
        route.distance = 0
        route.duration = 0
        route.load = sum(p.weight for p in route.points[1:])
        route.volume = sum(p.volume for p in route.points[1:])

        for i in range(len(route.points) - 1):
            p1 = route.points[i]
            p2 = route.points[i+1]
            route.distance += self.distance_matrix[p1.id][p2.id]
            route.duration += self.time_matrix[p1.id][p2.id] + p2.service_time * 60

    def _calculate_solution_cost(self, routes: List[Route]) -> float:
        total_cost = 0
        for route in routes:
            self._recalculate_route_metrics(route)
            total_cost += route.distance / 1000 * route.vehicle.cost_per_km
        return total_cost

    def _relocate_neighborhood(self, routes: List[Route]) -> List[Route]:
        # Tenta mover um ponto de uma rota para outra
        for r1_idx, r1 in enumerate(routes):
            if len(r1.points) <= 2: continue
            for p_idx in range(1, len(r1.points) -1):
                point = r1.points[p_idx]
                for r2_idx, r2 in enumerate(routes):
                    if r1_idx == r2_idx: continue
                    if self._can_add_point(r2, point):
                        new_routes = copy.deepcopy(routes)
                        moved_point = new_routes[r1_idx].points.pop(p_idx)
                        self._add_point_to_route(new_routes[r2_idx], moved_point)
                        return new_routes
        return routes

    def _exchange_neighborhood(self, routes: List[Route]) -> List[Route]:
        # Tenta trocar um ponto entre duas rotas
        for r1_idx, r1 in enumerate(routes):
            if len(r1.points) <= 2: continue
            for r2_idx, r2 in enumerate(routes):
                if r1_idx >= r2_idx or len(r2.points) <= 2: continue
                for p1_idx in range(1, len(r1.points) -1):
                    for p2_idx in range(1, len(r2.points) -1):
                        p1 = r1.points[p1_idx]
                        p2 = r2.points[p2_idx]

                        # Simula a troca
                        if (r1.load - p1.weight + p2.weight <= r1.vehicle.capacity and
                            r2.load - p2.weight + p1.weight <= r2.vehicle.capacity):
                            new_routes = copy.deepcopy(routes)
                            new_routes[r1_idx].points[p1_idx], new_routes[r2_idx].points[p2_idx] = p2, p1
                            return new_routes
        return routes

    def _two_opt_neighborhood(self, routes: List[Route]) -> List[Route]:
        # Inverte um segmento de uma rota para tentar reduzir a distância
        for r_idx, route in enumerate(routes):
            if len(route.points) < 4: continue
            for i in range(1, len(route.points) - 2):
                for j in range(i + 1, len(route.points) -1):
                    new_route_points = route.points[:i] + route.points[i:j+1][::-1] + route.points[j+1:]
                    
                    # Calcula a nova distância
                    new_dist = sum(self.distance_matrix[new_route_points[k].id][new_route_points[k+1].id] for k in range(len(new_route_points)-1))
                    
                    if new_dist < route.distance:
                        new_routes = copy.deepcopy(routes)
                        new_routes[r_idx].points = new_route_points
                        return new_routes
        return routes

    def _format_solution(self, routes: List[Route]) -> Dict[str, Any]:
        unassigned_points = set(p.id for p in self.request.points)
        formatted_routes = []

        for route in routes:
            if len(route.points) > 1:
                self._recalculate_route_metrics(route)
                point_ids_in_route = {p.id for p in route.points}
                unassigned_points -= point_ids_in_route

                formatted_routes.append({
                    "vehicle_id": route.vehicle.id,
                    "points": [p.dict() for p in route.points],
                    "distance_km": route.distance / 1000,
                    "duration_min": route.duration / 60,
                    "cost": route.distance / 1000 * route.vehicle.cost_per_km,
                    "load": route.load,
                    "volume": route.volume,
                })

        return {
            "routes": formatted_routes,
            "unassigned_point_ids": list(unassigned_points),
            "total_distance_km": sum(r["distance_km"] for r in formatted_routes),
            "total_cost": sum(r["cost"] for r in formatted_routes),
        }

# --- Endpoint da API ---

@router.post("/solve", response_model=Dict[str, Any])
async def solve_optimization_problem(request: OptimizationRequest):
    """
    Recebe uma requisição de otimização e retorna as rotas otimizadas.
    """
    try:
        if not request.points:
            raise HTTPException(status_code=400, detail="A lista de pontos não pode estar vazia.")
        if not request.vehicles:
            raise HTTPException(status_code=400, detail="A lista de veículos não pode estar vazia.")

        solver = RobustRouter(request)
        solution = solver.solve()
        return solution
    except Exception as e:
        logger.error(f"Erro na otimização: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ocorreu um erro inesperado durante a otimização: {e}")
