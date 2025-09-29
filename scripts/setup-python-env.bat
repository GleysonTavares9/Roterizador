@echo off
echo =============================================
echo  Configuração do Ambiente Python
echo =============================================
echo.

echo [1/5] Verificando Python...
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Python não encontrado. Por favor, instale o Python 3.8 ou superior.
    echo Baixe em: https://www.python.org/downloads/
    echo ^>^>^> LEMBRE-SE de marcar a opção "Add Python to PATH" durante a instalação! <<<
    pause
    exit /b 1
)

python -c "import sys; exit(0) if sys.version_info >= (3, 8) else exit(1)" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Versão do Python inferior a 3.8. Por favor, atualize o Python.
    pause
    exit /b 1
)

echo [2/5] Verificando pip...
python -m pip --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERRO] pip não encontrado. Por favor, instale o pip.
    echo Execute: python -m ensurepip --upgrade
    pause
    exit /b 1
)

echo [3/5] Atualizando pip...
python -m pip install --upgrade pip
if %ERRORLEVEL% neq 0 (
    echo [AVISO] Falha ao atualizar o pip. Continuando com a instalação...
)

echo [4/5] Instalando virtualenv...
python -m pip install virtualenv
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha ao instalar o virtualenv.
    pause
    exit /b 1
)

echo [5/5] Criando ambiente virtual...
if not exist "venv" (
    python -m venv venv
    if %ERRORLEVEL% neq 0 (
        echo [ERRO] Falha ao criar o ambiente virtual.
        pause
        exit /b 1
    )
)

echo.
echo =============================================
echo  Ambiente Python configurado com sucesso!
echo =============================================
echo.
echo Para ativar o ambiente virtual, execute:
echo   venv\Scripts\activate
echo.
echo Depois, instale as dependências com:
echo   pip install -r requirements.txt
echo.
pause
