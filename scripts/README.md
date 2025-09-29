# Scripts de Automação

Este diretório contém scripts para facilitar o desenvolvimento e implantação do Sistema de Roteirização.

## 📋 Scripts Disponíveis

### `iniciar_sistema.bat`
O script principal que:
1. Verifica dependências (Python, Node.js, npm)
2. Configura o ambiente virtual Python (`.venv`)
3. Instala dependências do backend e frontend
4. Inicia os servidores backend e frontend

**Uso:**
```
scripts\iniciar_sistema.bat
```

### `setup-python-env.bat`
Configura apenas o ambiente Python:
- Cria/ativa ambiente virtual
- Instala dependências do backend

**Uso:**
```
scripts\setup-python-env.bat
```

### `install-dependencies.bat`
Instala todas as dependências (backend e frontend) sem iniciar os servidores.

**Uso:**
```
scripts\install-dependencies.bat
```

## 🔧 Requisitos
- Python 3.8+
- Node.js 14+
- npm (vem com Node.js)
- Acesso à internet para baixar dependências

## 🚀 Início Rápido
1. Clone o repositório
2. Execute `scripts\iniciar_sistema.bat`
3. Acesse http://localhost:3000

## 🔄 Fluxo de Desenvolvimento
1. Faça suas alterações no código
2. O frontend recarrega automaticamente
3. Para o backend, reinicie o servidor manualmente

## 🛠️ Solução de Problemas
- **Erro de permissão**: Execute como administrador
- **Erro de dependências**: Execute `scripts\install-dependencies.bat`
- **Erro de porta em uso**: Verifique processos nas portas 3000 (frontend) e 8000 (backend)

## 📝 Notas
- O ambiente virtual Python é criado em `.venv/`
- As dependências do Node.js são instaladas em `node_modules/`
- Ambos os diretórios estão no `.gitignore`
