@echo off
setlocal enabledelayedexpansion

echo =============================================
echo  CONFIGURANDO AMBIENTE DE DESENVOLVIMENTO
echo =============================================

:: Verifica se o Python está instalado
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Erro: Python não encontrado. Por favor, instale o Python 3.8 ou superior.
    pause
    exit /b 1
)

:: Verifica se o ambiente virtual existe
if not exist ".venv\" (
    echo Criando ambiente virtual...
    python -m venv .venv
    if %ERRORLEVEL% neq 0 (
        echo Erro ao criar ambiente virtual.
        pause
        exit /b 1
    )
)

:: Ativa o ambiente virtual
call .venv\Scripts\activate
if %ERRORLEVEL% neq 0 (
    echo Erro ao ativar o ambiente virtual.
    pause
    exit /b 1
)

:: Atualiza o pip
echo Atualizando pip...
python -m pip install --upgrade pip
if %ERRORLEVEL% neq 0 (
    echo Aviso: Não foi possível atualizar o pip. Continuando com a versão atual.
)

:: Instala as dependências
echo Instalando dependências...
python -m pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo Erro ao instalar as dependências.
    pause
    exit /b 1
)

:: Instala o pacote em modo desenvolvimento
echo Instalando pacote em modo de desenvolvimento...
python -m pip install -e .
if %ERRORLEVEL% neq 0 (
    echo Aviso: Não foi possível instalar em modo de desenvolvimento. Continuando...
)

:: Cria o banco de dados
echo Criando banco de dados...
python create_tables.py
if %ERRORLEVEL% neq 0 (
    echo Aviso: Não foi possível criar as tabelas do banco de dados.
)

echo.
echo =============================================
echo  AMBIENTE CONFIGURADO COM SUCESSO!
echo =============================================
echo.
echo Para iniciar o servidor, execute:
echo    .\.venv\Scripts\activate
echo    python main.py
echo.
pause
