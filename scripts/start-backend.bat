@echo off
setlocal

cd backend

echo =============================================
echo  Iniciando Backend (FastAPI)
echo =============================================
echo.

echo [1/3] Verificando ambiente Python...
python --version
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Python não encontrado. Por favor, instale o Python 3.8 ou superior.
    pause
    exit /b 1
)

echo [2/3] Verificando dependências...
pip list | findstr "uvicorn fastapi" >nul
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Dependências não encontradas. Execute install-dependencies.bat primeiro.
    pause
    exit /b 1
)

echo [3/3] Iniciando servidor de desenvolvimento...
echo.
echo Acesse: http://localhost:8000
echo Documentação da API: http://localhost:8000/docs
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERRO] Falha ao iniciar o servidor backend.
    pause
    exit /b 1
)

endlocal
