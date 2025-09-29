@echo off
echo Iniciando o Sistema de Roteirização de Coleta de Resíduos...
echo.

REM Define os diretórios
set "BACKEND_DIR=backend"
set "FRONTEND_DIR=frontend"

REM Verifica se o diretório do backend existe
if not exist "%BACKEND_DIR%" (
    echo Erro: Diretório do backend não encontrado: %BACKEND_DIR%
    pause
    exit /b 1
)

REM Verifica se o diretório do frontend existe
if not exist "%FRONTEND_DIR%" (
    echo Erro: Diretório do frontend não encontrado: %FRONTEND_DIR%
    pause
    exit /b 1
)

REM Fecha processos antigos que possam estar em execução
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1

echo Verificando ambiente virtual do backend...
if not exist "%BACKEND_DIR%\venv" (
    echo Criando ambiente virtual...
    python -m venv "%BACKEND_DIR%\venv"
    
    echo Instalando dependências do backend...
    call "%BACKEND_DIR%\venv\Scripts\activate.bat"
    pip install -r "%BACKEND_DIR%\requirements.txt"
    pip install werkzeug uvicorn fastapi
) else (
    call "%BACKEND_DIR%\venv\Scripts\activate.bat"
)

echo.
echo Iniciando o backend...
start "Backend" /D "%BACKEND_DIR%" cmd /k "call venv\Scripts\activate.bat && python run.py"

REM Aguarda o backend iniciar
echo Aguardando o backend iniciar...
timeout /t 10 /nobreak >nul

REM Verifica se node_modules existe no frontend
if not exist "%FRONTEND_DIR%\node_modules" (
    echo Instalando dependências do frontend...
    cd /d "%FRONTEND_DIR%"
    call npm install
    cd /d "%~dp0"
)

echo Iniciando o frontend...
start "Frontend" /D "%FRONTEND_DIR%" cmd /k "npm start"

echo.
echo Sistema sendo iniciado...
echo - Backend: http://localhost:8000
echo - Frontend: http://localhost:3000
echo.
echo As dependências só serão instaladas na primeira execução ou se forem removidas.
echo.
echo Aguarde alguns instantes até que ambos os servidores estejam completamente inicializados.
pause
