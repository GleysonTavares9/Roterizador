"""
Exemplo de uso da classe RobustRouter para resolver um problema de roteamento de veículos.
"""
import json
import time
import sys
import os

# Adiciona o diretório raiz do projeto ao path do Python
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, project_root)

# Importa diretamente do módulo de otimização local
from optimization import RobustRouter, Vehicle, Point

def main():
    # Define a localização (bairro específico em Belo Horizonte para área menor)
    location = "Santa Luzia, MG, Brazil"
    print(f"\nIniciando roteador com localização: {location}")
    
    try:
        # Configura as configurações do OSMnx antes de criar o roteador
        import osmnx as ox
        ox.settings.timeout = 180  # 3 minutos de timeout
        ox.settings.use_cache = True  # Habilita cache em disco
        ox.settings.log_console = True  # Habilita logs no console
        
        # Usa uma área maior para garantir que tenhamos dados de ruas
        location = "Belo Horizonte, MG, Brazil"
        print(f"Usando localização: {location}")
        print("Nota: Usando uma área maior para garantir dados de ruas suficientes")
        
        # Cria uma instância do roteador
        router = RobustRouter(location=location, use_cache=True)
        print("Roteador inicializado com sucesso!")
    
    except Exception as e:
        print(f"Erro ao inicializar o roteador: {e}")
        print("Verifique sua conexão com a internet e tente novamente.")
        return
        
    # Dados de exemplo: veículos
    vehicles_data = [
        {
            "id": "v1",
            "name": "Caminhão Pequeno",
            "capacity": 1000,  # kg
            "volume_capacity": 10,  # m³
            "cost_per_km": 2.5,
            "start_time": "08:00",
            "end_time": "18:00",
            "speed": 40,  # km/h
            "driver_name": "João Silva",
            "driver_phone": "(11) 99999-9999",
            "skills": ["refrigerado", "entregas_rapidas"]
        },
        {
            "id": "v2",
            "name": "Caminhão Médio",
            "capacity": 2000,  # kg
            "volume_capacity": 20,  # m³
            "cost_per_km": 3.0,
            "start_time": "08:00",
            "end_time": "18:00",
            "speed": 40,  # km/h
            "driver_name": "Maria Santos",
            "driver_phone": "(11) 98888-8888",
            "skills": ["fragil", "entregas_rapidas"]
        },
        {
            "id": "v3",
            "name": "Caminhão Grande",
            "capacity": 5000,  # kg
            "volume_capacity": 30,  # m³
            "cost_per_km": 4.0,
            "start_time": "08:00",
            "end_time": "18:00",
            "speed": 40,  # km/h
            "driver_name": "Carlos Oliveira",
            "driver_phone": "(11) 97777-7777",
            "skills": ["perecivel", "fragil"]
        }
    ]
    
    # Dados de exemplo: pontos de entrega/coleta em Belo Horizonte
    points_data = [
        # Ponto de partida (depósito)
        {
            "id": "depot",
            "name": "Depósito Central",
            "type": "depot",
            "lat": -19.9316,  # Praça da Liberdade
            "lng": -43.9387,
            "weight": 0,
            "volume": 0,
            "time_window_start": "08:00",
            "time_window_end": "18:00",
            "service_time": 0,
            "required_skills": [],
            "address": "Praça da Liberdade, s/n - Funcionários",
            "notes": "Centro de distribuição principal"
        },
        # Pontos de entrega/coleta
        {
            "id": "p1",
            "name": "Mercado Central",
            "type": "delivery",
            "lat": -19.9187,
            "lng": -43.9403,
            "weight": 150,
            "volume": 1.5,
            "time_window_start": "09:00",
            "time_window_end": "12:00",
            "service_time": 20,
            "required_skills": ["refrigerado"],
            "address": "Av. Augusto de Lima, 744 - Centro",
            "notes": "Entregar na entrada de cargas"
        },
        {
            "id": "p2",
            "name": "Praça Sete",
            "type": "pickup",
            "lat": -19.9208,
            "lng": -43.9379,
            "weight": 100,
            "volume": 1.0,
            "time_window_start": "10:00",
            "time_window_end": "14:00",
            "service_time": 15,
            "required_skills": ["fragil"],
            "address": "Praça Sete de Setembro - Centro",
            "notes": "Coleta no térreo"
        },
        {
            "id": "p3",
            "name": "Praça da Estação",
            "type": "delivery",
            "lat": -19.9167,
            "lng": -43.9345,
            "weight": 200,
            "volume": 2.0,
            "time_window_start": "11:00",
            "time_window_end": "15:00",
            "service_time": 20,
            "required_skills": ["perecivel"],
            "address": "Praça Rui Barbosa - Centro",
            "notes": "Entregar no restaurante do andar superior"
        },
        {
            "id": "p4",
            "name": "Savassi",
            "type": "pickup",
            "lat": -19.9386,
            "lng": -43.9386,
            "weight": 120,
            "volume": 1.2,
            "time_window_start": "13:00",
            "time_window_end": "17:00",
            "service_time": 15,
            "required_skills": ["entregas_rapidas"],
            "address": "Rua Pernambuco - Savassi",
            "notes": "Pedido prioritário"
        },
        {
            "id": "p5",
            "name": "Santa Tereza",
            "type": "delivery",
            "lat": -19.9176,
            "lng": -43.9255,
            "weight": 180,
            "volume": 1.8,
            "time_window_start": "14:00",
            "time_window_end": "18:00",
            "service_time": 25,
            "required_skills": ["refrigerado", "fragil"],
            "address": "Rua Mármore - Santa Tereza",
            "notes": "Entregar no portão da cozinha"
        },
        {
            "id": "p6",
            "name": "Lourdes",
            "type": "pickup",
            "lat": -19.9289,
            "lng": -43.9378,
            "weight": 90,
            "volume": 0.9,
            "time_window_start": "10:30",
            "time_window_end": "12:30",
            "service_time": 15,
            "required_skills": ["fragil", "perecivel"],
            "address": "Rua da Bahia - Lourdes",
            "notes": "Tocar a campainha 3x"
        },
        {
            "id": "p7",
            "name": "Sion",
            "type": "delivery",
            "lat": -19.9450,
            "lng": -43.9389,
            "weight": 160,
            "volume": 1.6,
            "time_window_start": "15:00",
            "time_window_end": "17:00",
            "service_time": 20,
            "required_skills": [],
            "address": "Rua dos Inconfidentes - Sion",
            "notes": "Deixar com o porteiro"
        },
        {
            "id": "p8",
            "name": "Cidade Jardim",
            "type": "delivery",
            "lat": -19.9569,
            "lng": -43.9714,
            "weight": 180,
            "volume": 1.8,
            "time_window_start": "13:30",
            "time_window_end": "16:30",
            "service_time": 15,
            "required_skills": ["entregas_rapidas"],
            "address": "Rua Professor Moraes, 200 - Cidade Jardim",
            "notes": "Entregar no portão principal"
        },
        {
            "id": "p9",
            "name": "Pampulha",
            "type": "pickup",
            "lat": -19.8519,
            "lng": -43.9865,
            "weight": 220,
            "volume": 2.2,
            "time_window_start": "09:00",
            "time_window_end": "12:00",
            "service_time": 20,
            "required_skills": ["perecivel"],
            "address": "Av. Otacílio Negrão de Lima - Pampulha",
            "notes": "Entregar na portaria 2"
        },
        {
            "id": "p10",
            "name": "Mangabeiras",
            "type": "delivery",
            "lat": -19.9337,
            "lng": -43.9205,
            "weight": 190,
            "volume": 1.9,
            "time_window_start": "10:30",
            "time_window_end": "14:30",
            "service_time": 25,
            "required_skills": ["refrigerado"],
            "address": "Rua Professor Morais, 289 - Mangabeiras",
            "notes": "Entregar na portaria principal"
        }
    ]
    
    # Dados do depósito
    depot_data = {
        "id": "depot",
        "name": "Centro de Distribuição",
        "type": "depot",
        "lat": -23.5505,  # Centro de São Paulo
        "lng": -46.6333,
        "address": "Av. Paulista, 1000, São Paulo - SP"
    }
    
    # Prepara os dados para o roteador
    request_data = {
        "vehicles": vehicles_data,
        "points": points_data,
        "depot": depot_data
    }
    
    print("=== INICIANDO O ROTEAMENTO ===")
    print(f"- Veículos: {len(vehicles_data)}")
    print(f"- Pontos de entrega/coleta: {len(points_data)}")
    print("\nCarregando mapa e calculando rotas...")
    
    # Registra o tempo de início
    start_time = time.time()
    
    try:
        # Resolve o problema de roteamento usando VND (Variable Neighborhood Descent)
        solution = router.solve_vrp(
            request_data=request_data,
            method='vnd',  # Pode ser 'vnd', 'tabu' ou 'grasp'
            max_iterations=100
        )
        
        # Calcula o tempo de execução
        execution_time = time.time() - start_time
        solution['stats']['execution_time'] = execution_time
        router.solution = solution
        
        # Exibe um resumo da solução
        print("\n=== SOLUÇÃO ENCONTRADA ===")
        print(f"Tempo de execução: {execution_time:.2f} segundos")
        print(f"Rotas geradas: {len(solution['routes'])}")
        print(f"Distância total: {solution['stats']['total_distance']/1000:.2f} km")
        print(f"Custo total: R$ {solution['stats']['total_cost']:.2f}")
        print(f"Pontos atendidos: {solution['stats']['total_points_served']}/{len(points_data)}")
        
        if solution['unassigned']:
            print("\n=== PONTOS NÃO ATRIBUÍDOS ===")
            for point in solution['unassigned']:
                print(f"- {point['point_name']}: {', '.join(point['reasons'])}")
        
        # Exporta a solução para JSON
        router.export_to_json("solucao_roteamento.json")
        
        try:
            # Exporta a solução para JSON e CSV
            router.export_to_json("solucao_rotas.json")
            router.export_to_csv("detalhes_rotas")
            
            # Gera visualização do mapa com tratamento de erros
            print("\nVisualizando rotas...")
            if not router.visualize_routes(solution, "mapa_rotas.html", include_river=True):
                print("Aviso: Não foi possível gerar a visualização do mapa.")
            else:
                print("Visualização do mapa gerada com sucesso!")
        except Exception as e:
            print(f"Erro ao exportar resultados: {e}")
            print("Os resultados foram calculados, mas houve um problema ao exportar/visualizar.")
            
        print("\n=== EXPORTAÇÃO CONCLUÍDA ===")
        print("- solucao_roteamento.json: Solução completa em formato JSON")
        print("- solucao_roteamento_rotas.csv: Detalhes das rotas em CSV")
        print("- solucao_roteamento_nao_atribuidos.csv: Pontos não atribuídos em CSV")
        
    except Exception as e:
        print(f"\nErro durante o roteamento: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
