@echo off
setlocal enabledelayedexpansion

:: =============================================
::  Inicialização do Sistema de Roteirização
:: =============================================
:: Configurações
set BACKEND_URL=http://localhost:8000
set FRONTEND_URL=http://localhost:3000
set BACKEND_TITLE=Backend - Sistema de Roteirização
set FRONTEND_TITLE=Frontend - Sistema de Roteirização
set PYTHON=python
set NPM=npm

:: Configurar PYTHONPATH para incluir o diretório raiz e o backend
set PYTHONPATH=%~dp0;%~dp0backend

:: Verificar se o Python está instalado
where %PYTHON% >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Python não encontrado no PATH.
    echo Por favor, instale o Python ou adicione-o ao PATH do sistema.
    pause
    exit /b 1
)

:: Verificar se o Node.js/npm está instalado
where %NPM% >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [AVISO] Node.js/npm não encontrado. O frontend pode não funcionar corretamente.
    timeout /t 2 >nul
)

:: Iniciar Backend
echo Iniciando Backend...
start "%BACKEND_TITLE%" cmd /k "cd /d %~dp0backend && set PYTHONPATH=%~dp0backend && %PYTHON% -m uvicorn main:app --host 0.0.0.0 --port 8000"

:: Iniciar Frontend
echo Iniciando Frontend...
start "%FRONTEND_TITLE%" cmd /k "cd /d %~dp0\frontend && %NPM% start"

:: Mensagem final
echo.
echo ============================================
echo  SISTEMA INICIALIZADO COM SUCESSO!
echo ============================================
echo.
echo  Acesse o sistema: %FRONTEND_URL%
echo  Acesse a API: %BACKEND_URL%
echo  Acesse a documentação: %BACKEND_URL%/docs
echo.
echo  Pressione qualquer tecla para encerrar esta janela...
pause >nul
