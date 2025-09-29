# API de Otimização de Rotas (v2)

Esta é a documentação da nova API de otimização de rotas, que fornece endpoints para calcular rotas otimizadas para coleta de resíduos.

## Endpoints

### 1. Gerar Rotas Otimizadas

**POST** `/api/v2/optimize`

Gera rotas otimizadas com base nos pontos de coleta e veículos fornecidos.

**Parâmetros do Corpo (JSON):**

```json
{
  "points": [
    {
      "id": "string",
      "address": "string",
      "volume": 0,
      "weight": 0,
      "time_window_start": "string",
      "time_window_end": "string",
      "lat": 0,
      "lng": 0,
      "service_time": 0,
      "quantity": 0
    }
  ],
  "vehicles": [
    {
      "id": "string",
      "name": "string",
      "capacity": 0,
      "max_weight": 0,
      "volume_capacity": 0,
      "length": 0,
      "width": 0,
      "height": 0,
      "start_time": "string",
      "end_time": "string"
    }
  ],
  "depot_id": "string",
  "use_valhalla": true,
  "valhalla_url": "string"
}
```

**Resposta de Sucesso (200 OK):**

```json
{
  "status": "success",
  "message": "string",
  "routes": [
    {
      "vehicle_id": "string",
      "vehicle_name": "string",
      "stops": [
        {
          "id": "string",
          "lat": 0,
          "lng": 0,
          "address": "string",
          "volume": 0,
          "weight": 0,
          "service_time": 0
        }
      ],
      "total_distance": 0,
      "total_volume": 0,
      "total_weight": 0
    }
  ],
  "total_distance": 0,
  "total_volume": 0,
  "total_weight": 0,
  "num_vehicles_used": 0,
  "num_stops": 0,
  "processing_time": 0
}
```

### 2. Exemplo de Uso

**GET** `/api/v2/optimization/example`

Retorna um exemplo de resposta da API com dados de teste.

## Exemplo de Uso com cURL

```bash
curl -X 'POST' \
  'http://localhost:8000/api/v2/optimize' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
    "points": [
      {
        "id": "depot",
        "lat": -23.5505,
        "lng": -46.6333,
        "volume": 0,
        "weight": 0,
        "address": "Depósito Central",
        "time_window_start": "08:00",
        "time_window_end": "18:00"
      },
      {
        "id": "p1",
        "lat": -23.5605,
        "lng": -46.6433,
        "volume": 1.5,
        "weight": 100,
        "address": "Ponto 1",
        "time_window_start": "09:00",
        "time_window_end": "17:00"
      }
    ],
    "vehicles": [
      {
        "id": "v1",
        "name": "Caminhão Pequeno",
        "capacity": 1000,
        "max_weight": 1000,
        "volume_capacity": 10,
        "start_time": "08:00",
        "end_time": "18:00"
      }
    ]
  }'
```

## Configuração

A API pode ser configurada usando as seguintes variáveis de ambiente:

- `VALHALLA_URL`: URL do serviço Valhalla (opcional, padrão: `http://localhost:8002`)
- `USE_VALHALLA`: Define se deve usar o Valhalla para cálculo de rotas (opcional, padrão: `false`)

## Dependências

- Python 3.8+
- FastAPI
- OR-Tools
- NumPy
- Geopy
- aiohttp (para integração com Valhalla)

## Testando Localmente

1. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

2. Execute o servidor de desenvolvimento:
   ```bash
   uvicorn main:app --reload
   ```

3. Acesse a documentação interativa em: http://localhost:8000/docs

## Suporte

Para suporte, entre em contato com a equipe de desenvolvimento.
