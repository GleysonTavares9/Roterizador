"""
Exemplo de uso da classe RobustRouter para resolver um problema de roteamento de veículos.
"""
import json
import time
from robust_router import RobustRouter, Vehicle, Point

def main():
    # Cria uma instância do roteador
    router = RobustRouter(location="São Paulo, Brazil")
    
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
    
    # Dados de exemplo: pontos de entrega/coleta
    points_data = [
        {
            "id": "p1",
            "name": "Cliente A",
            "type": "delivery",
            "lat": -23.5505,
            "lng": -46.6333,
            "weight": 200,
            "volume": 2,
            "time_window_start": "09:00",
            "time_window_end": "12:00",
            "service_time": 15,  # minutos
            "required_skills": ["refrigerado"],
            "address": "Av. Paulista, 1000",
            "notes": "Entregar no portão dos fundos"
        },
        {
            "id": "p2",
            "name": "Cliente B",
            "type": "delivery",
            "lat": -23.5600,
            "lng": -46.6500,
            "weight": 150,
            "volume": 1.5,
            "time_window_start": "10:00",
            "time_window_end": "14:00",
            "service_time": 10,
            "required_skills": ["fragil"],
            "address": "Rua Augusta, 1500"
        },
        {
            "id": "p3",
            "name": "Cliente C",
            "type": "pickup",
            "lat": -23.5400,
            "lng": -46.6200,
            "weight": 300,
            "volume": 3,
            "time_window_start": "13:00",
            "time_window_end": "16:00",
            "service_time": 20,
            "required_skills": ["perecivel"],
            "address": "Alameda Santos, 2000"
        },
        {
            "id": "p4",
            "name": "Cliente D",
            "type": "delivery",
            "lat": -23.5700,
            "lng": -46.6400,
            "weight": 180,
            "volume": 2.5,
            "time_window_start": "11:00",
            "time_window_end": "15:00",
            "service_time": 15,
            "required_skills": ["entregas_rapidas"],
            "address": "Rua Oscar Freire, 800"
        },
        {
            "id": "p5",
            "name": "Cliente E",
            "type": "delivery",
            "lat": -23.5300,
            "lng": -46.6100,
            "weight": 250,
            "volume": 2,
            "time_window_start": "09:30",
            "time_window_end": "11:30",
            "service_time": 10,
            "required_skills": ["refrigerado", "entregas_rapidas"],
            "address": "Av. Brigadeiro Faria Lima, 2000"
        },
        {
            "id": "p6",
            "name": "Cliente F",
            "type": "pickup",
            "lat": -23.5800,
            "lng": -46.6700,
            "weight": 400,
            "volume": 4,
            "time_window_start": "14:00",
            "time_window_end": "17:00",
            "service_time": 25,
            "required_skills": ["fragil", "perecivel"],
            "address": "Rua Haddock Lobo, 500"
        },
        {
            "id": "p7",
            "name": "Cliente G",
            "type": "delivery",
            "lat": -23.5200,
            "lng": -46.6000,
            "weight": 120,
            "volume": 1.2,
            "time_window_start": "10:00",
            "time_window_end": "12:00",
            "service_time": 10,
            "required_skills": [],
            "address": "Rua Bela Cintra, 900"
        },
        {
            "id": "p8",
            "name": "Cliente H",
            "type": "delivery",
            "lat": -23.5900,
            "lng": -46.6800,
            "weight": 180,
            "volume": 1.8,
            "time_window_start": "13:30",
            "time_window_end": "16:30",
            "service_time": 15,
            "required_skills": ["entregas_rapidas"],
            "address": "Av. Rebouças, 3000"
        },
        {
            "id": "p9",
            "name": "Cliente I",
            "type": "pickup",
            "lat": -23.5000,
            "lng": -46.6200,
            "weight": 350,
            "volume": 3.5,
            "time_window_start": "09:00",
            "time_window_end": "12:00",
            "service_time": 20,
            "required_skills": ["perecivel"],
            "address": "Rua da Consolação, 2000"
        },
        {
            "id": "p10",
            "name": "Cliente J",
            "type": "delivery",
            "lat": -23.6100,
            "lng": -46.6500,
            "weight": 280,
            "volume": 2.8,
            "time_window_start": "10:30",
            "time_window_end": "14:30",
            "service_time": 15,
            "required_skills": ["refrigerado"],
            "address": "Rua Teodoro Sampaio, 1500"
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
        
        # Exporta para CSV
        router.export_to_csv("solucao_roteamento")
        
        # Gera um mapa interativo
        router.visualize_routes(filename="mapa_rotas.html")
        
        print("\n=== EXPORTAÇÃO CONCLUÍDA ===")
        print("- solucao_roteamento.json: Solução completa em formato JSON")
        print("- solucao_roteamento_rotas.csv: Detalhes das rotas em CSV")
        print("- solucao_roteamento_nao_atribuidos.csv: Pontos não atribuídos em CSV")
        print("- mapa_rotas.html: Mapa interativo com as rotas")
        
    except Exception as e:
        print(f"\nErro durante o roteamento: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
