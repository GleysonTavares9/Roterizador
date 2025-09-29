@echo off
setlocal

cd frontend

echo =============================================
echo  Iniciando Frontend (React)
echo =============================================
echo.

echo [1/3] Verificando Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Node.js não encontrado. Por favor, instale o Node.js 14 ou superior.
    pause
    exit /b 1
)

echo [2/3] Verificando dependências...
if not exist "node_modules" (
    echo Dependências não encontradas. Instalando...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERRO] Falha ao instalar as dependências do frontend.
        pause
        exit /b 1
    )
)

echo [3/3] Iniciando servidor de desenvolvimento...
echo.
echo Acesse: http://localhost:3000
echo.

call npm start

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERRO] Falha ao iniciar o servidor frontend.
    pause
    exit /b 1
)

endlocal
