@echo off
title Iniciar Sistema de Roteirização (Modo Simples)
color 0A

echo ===========================================
echo  SISTEMA DE ROTEIRIZAÇÃO - INICIALIZAÇÃO
echo ===========================================
echo.

:: Verificar Python
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Python não encontrado. Instale Python 3.8+ (https://www.python.org/downloads/)
    pause
    exit /b 1
)

:: Verificar Node.js
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js não encontrado. Instale Node.js 14+ (https://nodejs.org/)
    pause
    exit /b 1
)

:: Configurar ambiente virtual
echo Configurando ambiente virtual...
if not exist ".venv" (
    python -m venv .venv
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRO] Falha ao criar o ambiente virtual.
        pause
        exit /b 1
    )
)

call .venv\Scripts\activate
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao ativar o ambiente virtual.
    pause
    exit /b 1
)

:: Instalar dependências do backend
echo Instalando dependências do backend...
if exist "requirements.txt" (
    pip install -r requirements.txt
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRO] Falha ao instalar as dependências do backend.
        pause
        exit /b 1
    )
) else (
    echo [AVISO] Arquivo requirements.txt não encontrado.
)

:: Instalar dependências do frontend
echo Instalando dependências do frontend...
cd frontend
if exist "package.json" (
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRO] Falha ao instalar as dependências do frontend.
        pause
        exit /b 1
    )
) else (
    echo [AVISO] Arquivo package.json não encontrado.
)
cd ..

:: Iniciar backend
echo Iniciando o backend (http://localhost:8000)...
start "Backend" cmd /k "cd backend && .venv\Scripts\activate && python start_server.py"

:: Pequena pausa para o backend iniciar
timeout /t 5 /nobreak >nul

:: Iniciar frontend
echo Iniciando o frontend (http://localhost:3000)...
start "Frontend" cmd /k "cd frontend && npm start"

echo.
echo ===========================================
echo  SISTEMA INICIALIZADO COM SUCESSO!
echo ===========================================
echo.
echo Acesse o sistema em: http://localhost:3000
echo Documentação da API: http://localhost:8000/api/docs
echo.
pause
