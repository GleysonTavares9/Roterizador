# Robust Vehicle Routing System

Sistema avançado de roteamento de veículos que utiliza meta-heurísticas para otimização de rotas com restrições complexas, como habilidades dos veículos, capacidades, janelas de tempo e muito mais.

## Características

- **Integração com mapas reais** usando OpenStreetMap para cálculos precisos de distância e tempo
- **Suporte a múltiplas restrições**:
  - Capacidade de peso e volume dos veículos
  - Janelas de tempo para entrega/coleta
  - Habilidades específicas necessárias (ex: refrigeração, manuseio de frágeis)
  - Horários de trabalho dos motoristas
  - Restrições de tempo de serviço
- **Múltiplas meta-heurísticas** para otimização:
  - VND (Variable Neighborhood Descent)
  - Busca Tabu
  - GRASP (Greedy Randomized Adaptive Search Procedure)
- **Visualização interativa** das rotas em um mapa
- **Exportação** para JSON e CSV
- **Fácil integração** com sistemas existentes

## Requisitos

- Python 3.7+
- Bibliotecas Python (instaladas via `pip install -r requirements.txt`):
  - networkx
  - osmnx
  - numpy
  - pandas
  - folium (para visualização)
  - python-dateutil

## Instalação

1. Clone o repositório:
   ```bash
   git clone [URL_DO_REPOSITORIO]
   cd Tete-roterizador
   ```

2. Crie e ative um ambiente virtual (opcional, mas recomendado):
   ```bash
   python -m venv venv
   source venv/bin/activate  # No Windows: venv\Scripts\activate
   ```

3. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```

## Uso Básico

1. **Preparação dos Dados**
   Prepare seus dados no formato esperado pelo sistema. Veja o arquivo `example.py` para um exemplo completo.

2. **Criando uma Instância do Roteador**
   ```python
   from robust_router import RobustRouter
   
   # Cria uma instância do roteador para uma localização específica
   router = RobustRouter(location="São Paulo, Brazil")
   ```

3. **Resolvendo o Problema de Roteamento**
   ```python
   # Dados de entrada
   request_data = {
       "vehicles": [...],  # Lista de veículos
       "points": [...],    # Lista de pontos de entrega/coleta
       "depot": {...}      # Dados do depósito
   }
   
   # Resolve o problema usando VND (padrão)
   solution = router.solve_vrp(
       request_data=request_data,
       method='vnd',  # 'vnd', 'tabu' ou 'grasp'
       max_iterations=100
   )
   ```

4. **Exportando os Resultados**
   ```python
   # Exporta para JSON
   router.export_to_json("solucao_roteamento.json")
   
   # Exporta para CSV
   router.export_to_csv("solucao_roteamento")
   
   # Gera um mapa interativo
   router.visualize_routes(filename="mapa_rotas.html")
   ```

## Exemplo Completo

Consulte o arquivo `example.py` para um exemplo completo de uso, incluindo a definição de veículos, pontos de entrega/coleta e depósito.

## Estrutura do Projeto

- `robust_router.py`: Implementação principal do sistema de roteamento
- `example.py`: Exemplo de uso do sistema
- `requirements.txt`: Dependências do projeto
- `README.md`: Documentação

## Personalização

### Adicionando Novas Meta-heurísticas

Você pode estender a classe `RobustRouter` para adicionar novas meta-heurísticas. Baste implementar um novo método seguindo o padrão existente e adicioná-lo à função `solve_vrp`.

### Ajustando Parâmetros

Cada meta-heurística possui parâmetros que podem ser ajustados para melhorar o desempenho:

- **VND**: Ordem das estruturas de vizinhança
- **Busca Tabu**: Tamanho da lista tabu, critério de aspiração
- **GRASP**: Tamanho da lista de candidatos, número de iterações

## Limitações

- O desempenho pode ser afetado por um grande número de pontos de entrega/coleta (>100)
- A precisão das rotas depende da qualidade dos dados do OpenStreetMap
- O tempo de cálculo aumenta significativamente com o número de restrições

## Licença

[MIT License](LICENSE)

## Contato

Para dúvidas ou sugestões, entre em contato com [SEU_EMAIL].
