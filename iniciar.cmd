@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 exit /b 1

where dotnet >nul 2>&1
if errorlevel 1 (
    echo No se encontro dotnet. Instala el SDK de .NET 10 y vuelve a intentarlo.
    exit /b 1
)

echo Limpiando Comercial Nova...
dotnet clean Nova.csproj
if errorlevel 1 exit /b 1

echo.
echo Iniciando Comercial Nova...
dotnet run --project Nova.csproj
exit /b %errorlevel%
