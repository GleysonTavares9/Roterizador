@echo off
echo =============================================
echo  Instalando Dependências do Sistema
echo =============================================

echo [1/3] Verificando Python...
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Python não encontrado. Por favor, instale o Python 3.8 ou superior e tente novamente.
    pause
    exit /b 1
)

echo [2/3] Instalando dependências do backend...
cd backend
pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha ao instalar as dependências do backend.
    pause
    exit /b 1
)
cd ..

echo [3/3] Instalando dependências do frontend...
cd frontend
npm install
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha ao instalar as dependências do frontend.
    pause
    exit /b 1
)
cd ..

echo.
echo =============================================
echo  Dependências instaladas com sucesso!
echo =============================================
echo.
pause
