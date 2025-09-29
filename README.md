# 📊 Sistema de Roteirização de Coleta de Resíduos

Sistema avançado para otimização de rotas de coleta de resíduos, desenvolvido com Python (FastAPI) no backend e React no frontend. Este sistema permite planejar e otimizar rotas de coleta considerando múltiplos fatores como capacidade dos veículos, janelas de tempo, distâncias e restrições operacionais.

## 🚀 Funcionalidades Principais

- **Upload de Dados**: Importação simplificada de planilhas Excel com pontos de coleta e informações dos veículos
- **Otimização Inteligente**: Algoritmos avançados para cálculo de rotas considerando:
  - Capacidade máxima dos veículos
  - Janelas de tempo para coleta
  - Distâncias e trânsito entre pontos
  - Restrições de acesso e horários
- **Visualização em Mapa**: Interface interativa com mapas para visualização das rotas otimizadas
- **Exportação de Resultados**: Geração de relatórios detalhados em Excel e PDF
- **Interface Responsiva**: Design adaptável para uso em qualquer dispositivo
- **Sistema de Autenticação**: Controle de acesso seguro com níveis de permissão

## 📋 Requisitos do Sistema
- **Sistema Operacional**: Windows 10/11 (64-bit)
- **Processador**: 2.0 GHz ou superior
- **Memória RAM**: 4GB mínimo (8GB recomendado)
- **Espaço em Disco**: 2GB livres
- **Python**: 3.9 ou superior
- **Node.js**: 16.x LTS ou superior (apenas para desenvolvimento)
- **Navegador**: Google Chrome, Firefox, Edge (últimas versões)

## 🚀 Instalação Rápida (Recomendado)

1. Baixe o instalador `SistemaRoteirizacao_Setup_vX.X.exe`
2. Execute o instalador como administrador
3. Siga as instruções na tela
4. O sistema será instalado em `C:\Sistema de Roteirização` por padrão
5. Um atalho será criado na área de trabalho e no menu Iniciar
6. O sistema iniciará automaticamente após a instalação
7. Acesse: `http://localhost:8000`

## ⚙️ Instalação Manual

### 1. Pré-requisitos

Certifique-se de ter instalado:

- [Python 3.9+](https://www.python.org/downloads/)
- [Node.js 16.x LTS](https://nodejs.org/)
- [Git](https://git-scm.com/) (opcional)

### 2. Configuração do Ambiente

1. **Clone o repositório** (ou baixe os arquivos):
   ```bash
   git clone https://github.com/seu-usuario/sistema-roteirizacao.git
   cd sistema-roteirizacao
   ```

2. **Execute o script de instalação**:
   - No Windows, execute `setup.bat` como administrador
   - O script irá:
     1. Criar um ambiente virtual Python
     2. Instalar as dependências do backend
     3. Instalar as dependências do frontend
     4. Configurar o banco de dados
     5. Criar as pastas necessárias

## 🏃‍♂️ Iniciando o Sistema

Após a instalação, você pode iniciar o sistema de duas formas:

1. **Usando o atalho na área de trabalho** (se instalado via instalador)
2. **Pelo terminal**:
   ```
   start_system.bat
   ```

O sistema estará disponível em:
- Frontend: http://localhost:3000
- API (Swagger): http://localhost:8000/docs

## 🛠️ Estrutura do Projeto

```
sistema-roteirizacao/
├── backend/             # Código-fonte do backend (FastAPI)
├── frontend/            # Código-fonte do frontend (React)
├── scripts/             # Scripts auxiliares
├── docs/                # Documentação
├── logs/                # Arquivos de log
├── data/                # Dados do sistema
├── setup.bat            # Script de instalação
├── start_system.bat     # Script de inicialização
└── uninstall.bat        # Script de desinstalação
```

## 🔧 Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Configurações do Backend
DEBUG=True
SECRET_KEY=sua_chave_secreta_aqui
DATABASE_URL=sqlite:///./data/sistema.db

# Configurações de E-mail (opcional)
SMTP_SERVER=smtp.exemplo.com
SMTP_PORT=587
SMTP_USER=seu_email@exemplo.com
SMTP_PASSWORD=sua_senha
```

## 📚 Documentação Adicional

- [Documentação da API](http://localhost:8000/docs)
- [Guia do Usuário](./docs/USER_GUIDE.md)
- [Guia de Desenvolvimento](./docs/DEVELOPMENT.md)

## 🤝 Suporte

Em caso de problemas ou dúvidas, entre em contato:
- E-mail: suporte@exemplo.com
- Issues: [GitHub Issues](https://github.com/seu-usuario/sistema-roteirizacao/issues)

## 📄 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.
```
install_deps.bat
```

Este script irá:
- Criar um ambiente virtual Python
- Instalar as dependências do backend
- Construir o frontend (se o Node.js estiver instalado)
- Configurar o banco de dados

### 4. Iniciar o Sistema

Execute o script de inicialização:
```
start.bat
```

O sistema estará disponível em: `http://localhost:8000`

## 🛠️ Desenvolvimento

### Configuração do Ambiente de Desenvolvimento

1. **Backend** (Python):
   ```bash
   # Ativar ambiente virtual
   .\venv\Scripts\activate
   
   # Instalar dependências de desenvolvimento
   pip install -r requirements-dev.txt
   
   # Iniciar servidor de desenvolvimento
   uvicorn backend.main:app --reload
   ```

2. **Frontend** (React):
   ```bash
   cd frontend
   
   # Instalar dependências
   npm install
   
   # Iniciar servidor de desenvolvimento
   npm start
   ```

   O frontend de desenvolvimento estará disponível em: `http://localhost:3000`

## 🚦 Inicialização Automática

Para configurar o sistema para iniciar automaticamente com o Windows:

1. Pressione `Win + R`
2. Digite `shell:startup` e pressione Enter
3. Crie um atalho para o arquivo `start.bat`

## 🔧 Solução de Problemas

### Problemas Comuns

- **Erro ao instalar dependências**:
  - Verifique se o Python está adicionado ao PATH
  - Execute o terminal como administrador
  - Atualize o pip: `python -m pip install --upgrade pip`

- **Frontend não carrega**:
  - Verifique se o Node.js está instalado
  - Execute `npm install` na pasta frontend
  - Limpe o cache do navegador

- **Erros de banco de dados**:
  - Verifique se o arquivo `.env` está configurado corretamente
  - Execute as migrações: `alembic upgrade head`

## 📞 Suporte

Para suporte técnico, entre em contato:
- E-mail: suporte@empresa.com
- Telefone: (00) 1234-5678

## 📄 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE.txt](LICENSE.txt) para detalhes.
4. Visualize as rotas otimizadas no mapa e na tabela
5. Exporte os resultados se necessário

## Estrutura do Projeto

```
Sistema_de_roterização/
├── backend/               # Código do servidor
│   ├── app/               # Aplicação principal
│   ├── models/            # Modelos de dados
│   ├── routers/           # Rotas da API
│   └── utils/             # Utilitários
└── frontend/              # Aplicativo React
    ├── public/            # Arquivos estáticos
    └── src/               # Código-fonte
        ├── components/    # Componentes React
        └── pages/         # Páginas da aplicação
```

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para mais detalhes.
=======
# Roterizador
>>>>>>> 2e9c65dcedbccdf310b57f174aee8d3bd6a3f669
