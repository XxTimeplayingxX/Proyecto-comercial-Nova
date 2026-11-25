#!/usr/bin/env bash
set -euo pipefail

# Permite ejecutar el script desde cualquier directorio.
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$PROJECT_DIR"

if ! command -v dotnet >/dev/null 2>&1; then
  printf 'No se encontró dotnet. Instala el SDK de .NET 10 y vuelve a intentarlo.\n' >&2
  exit 1
fi

printf 'Limpiando Comercial Nova...\n'
dotnet clean Nova.csproj

printf '\nIniciando Comercial Nova...\n'
exec dotnet run --project Nova.csproj
