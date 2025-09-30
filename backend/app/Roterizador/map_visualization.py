
"""
Módulo de Visualização para o RobustRouter
------------------------------------------
Responsável por gerar mapas interativos das rotas otimizadas.
"""

import os
import folium
from folium import plugins
import networkx as nx
import osmnx as ox
import geopandas as gpd
from shapely.geometry import Point as ShapelyPoint
from typing import List, Dict, Any, Optional

# Importando as classes de dados necessárias para type hinting
# Elas não precisam ser instanciadas aqui, apenas usadas para anotação de tipos.
# from .optimization import Point, Vehicle 

def _add_route_with_arrows(map_obj, coords, color='blue', weight=5, opacity=0.8, popup=None, tooltip=None, dash_array=None):
    """
    Adiciona uma rota com setas indicando a direção ao mapa.
    """
    if len(coords) < 2:
        return
    
    line = folium.PolyLine(
        coords,
        color=color,
        weight=weight,
        opacity=opacity,
        popup=popup,
        tooltip=tooltip,
        dash_array=dash_array
    )
    
    plugins.AntPath([coords], color=color, weight=weight-2, delay=1000, dash_array=[10, 20]).add_to(map_obj)
    line.add_to(map_obj)

def _generate_river(center_lat: float, center_lng: float, length_km: float = 200, width_km: float = 0.5) -> gpd.GeoDataFrame:
    """
    Gera um rio simulado próximo a uma coordenada central.
    """
    import numpy as np
    from shapely.geometry import LineString

    length_deg = length_km / 111
    width_deg = width_km / 111
    
    x = np.linspace(0, length_deg, 100)
    y = np.sin(x * 10) * (width_deg * 0.8)
    
    angle = np.radians(45)
    x_rot = x * np.cos(angle) - y * np.sin(angle)
    y_rot = x * np.sin(angle) + y * np.cos(angle)
    
    x_rot = x_rot - np.mean(x_rot) + center_lng
    y_rot = y_rot - np.mean(y_rot) + center_lat
    
    line = LineString(zip(x_rot, y_rot))
    river = line.buffer(width_deg / 2, cap_style=2)
    
    return gpd.GeoDataFrame(geometry=[river], crs="EPSG:4326")

def visualize_routes(
    solution: Dict[str, Any],
    graph: nx.MultiDiGraph,
    depot: Any, # Deveria ser Point
    points: List[Any], # Deveria ser List[Point]
    filename: str = "mapa_rotas.html",
    include_river: bool = False
) -> bool:
    """
    Gera um mapa interativo mostrando as rotas otimizadas.
    """
    if not solution:
        print("Nenhuma solução disponível para visualização.")
        return False
    
    if not graph:
        print("Grafo de ruas não carregado.")
        return False

    try:
        nodes = list(graph.nodes(data=True))
        if not nodes:
            print("Erro: Nenhum nó encontrado no grafo.")
            return False

        lats = [data.get('y', 0) for _, data in nodes if 'y' in data]
        lons = [data.get('x', 0) for _, data in nodes if 'x' in data]

        if not lats or not lons:
            print("Erro: Não foi possível determinar a localização central.")
            return False

        avg_lat = sum(lats) / len(lats)
        avg_lon = sum(lons) / len(lons)

        m = folium.Map(location=[avg_lat, avg_lon], zoom_start=13, tiles='CartoDB positron')

        if include_river:
            try:
                river_gdf = _generate_river(center_lat=avg_lat, center_lng=avg_lon)
                folium.GeoJson(
                    river_gdf,
                    style_function=lambda x: {'fillColor': '#1E90FF', 'color': '#1E90FF', 'weight': 2, 'fillOpacity': 0.5},
                    name='Rio Simulado',
                    tooltip='Rio (obstáculo para rotas)'
                ).add_to(m)
            except Exception as e:
                print(f"Aviso: Não foi possível adicionar o rio ao mapa: {e}")

        marker_cluster = plugins.MarkerCluster().add_to(m)
        
        colors = ['blue', 'green', 'purple', 'orange', 'darkred', 'lightred', 'beige', 'darkblue', 'darkgreen', 'cadetblue']

        if depot and hasattr(depot, 'lat') and hasattr(depot, 'lng'):
            folium.Marker(
                [depot.lat, depot.lng],
                popup=f'<b>Depósito</b><br>ID: {depot.id}',
                icon=folium.Icon(icon='warehouse', prefix='fa', color='black'),
                tooltip='Depósito'
            ).add_to(m)

        for i, route in enumerate(solution.get('routes', [])):
            color = colors[i % len(colors)]
            route_points_coords = [(depot.lat, depot.lng)]
            
            for point_data in route.get('points', []):
                point = next((p for p in points if str(p.id) == str(point_data.get('id'))), None)
                if point and hasattr(point, 'lat') and hasattr(point, 'lng'):
                    route_points_coords.append((point.lat, point.lng))
                    
                    popup_html = f"<b>{point.name}</b><br>Rota: {i+1}<br>Veículo: {route.get('vehicle_name','N/A')}"
                    folium.Marker(
                        [point.lat, point.lng],
                        popup=folium.Popup(popup_html, max_width=300),
                        icon=folium.Icon(color=color, icon='circle', prefix='fa')
                    ).add_to(marker_cluster)

            route_points_coords.append((depot.lat, depot.lng))
            
            if len(route_points_coords) > 1:
                _add_route_with_arrows(m, route_points_coords, color=color, popup=f"Rota {i+1}", dash_array='5, 5')

        unassigned_group = folium.FeatureGroup(name='Pontos não atribuídos').add_to(m)
        for point_info in solution.get('unassigned', []):
            point = next((p for p in points if str(p.id) == str(point_info.get('point_id'))), None)
            if point:
                popup_html = f"<b>Não Atribuído: {point.name}</b><br>Motivos: {', '.join(point_info.get('reasons', []))}"
                folium.Marker(
                    [point.lat, point.lng],
                    popup=folium.Popup(popup_html, max_width=300),
                    icon=folium.Icon(color='red', icon='question-circle', prefix='fa'),
                    tooltip=f"Não atribuído: {point.name}"
                ).add_to(unassigned_group)

        folium.LayerControl().add_to(m)
        m.save(filename)
        print(f"Mapa salvo como {filename}. Abra no navegador para visualizar.")
        return True

    except Exception as e:
        print(f"Erro ao gerar visualização: {e}")
        return False
