@echo off
title Ingeniero de Calidad IA - Servidor
color 1F
echo.
echo  ================================================
echo   INGENIERO DE CALIDAD IA - Iniciando servidor...
echo  ================================================
echo.

cd /d "%~dp0"

REM Verificar que Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Python no está instalado o no está en el PATH.
    echo  Instalá Python desde https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Instalar dependencias si no están
echo  Verificando dependencias...
pip install -r requirements.txt -q

echo.
echo  Servidor iniciado en http://localhost:8000
echo  Abriendo la aplicacion en el navegador...
echo.
echo  Para detener el servidor presiona Ctrl+C
echo.

REM Abrir el navegador después de 2 segundos
timeout /t 2 /nobreak >nul
start "" "app.html"

REM Iniciar el servidor
python -m uvicorn servidor:app --host 127.0.0.1 --port 8000 --reload

pause
