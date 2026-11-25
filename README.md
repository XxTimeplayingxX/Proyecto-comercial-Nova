# Nova

Prototipo universitario para un comercio de tecnología. El proyecto usa C# y ASP.NET Core 10 con MVC registrado. La pantalla inicial muestra **Bienvenidos** con HTML, CSS y JavaScript. Se sirve como archivo estático y funciona sin conexión a Supabase. En esta etapa quedan pendientes los controladores y las rutas de API.

## Ejecutar en local

Instala el SDK de .NET 10 y abre una terminal en la carpeta del proyecto. Ejecuta:

```powershell
dotnet run --project Nova.csproj
```

Abre [http://localhost:5180](http://localhost:5180). Para detener el servidor, presiona `Ctrl+C`.

## Estructura

| Ubicación | Función |
| --- | --- |
| `Program.cs` | Registra MVC, las opciones de Supabase y el cliente HTTP mediante inyección de dependencias. |
| `Models/Producto.cs` | Modelo inicial de un producto. |
| `Dtos/ProductoDto.cs` | Contrato de ejemplo para exponer un producto y su disponibilidad. |
| `Infrastructure/SupabaseOptions.cs` | Configuración del cliente para la Data API de Supabase. |
| `wwwroot/` | Pantalla de bienvenida y sus recursos. |

## Conexión futura a Supabase

Cuando se incorporen los controladores, los servicios podrán recibir `IHttpClientFactory` por constructor y solicitar `CreateClient("Supabase")`. El cliente apunta a `/rest/v1/` y envía una clave publicable en el encabezado `apikey`. Para usarlo en desarrollo, configura estas variables en PowerShell:

```powershell
$env:Supabase__ProjectUrl = 'https://TU-PROYECTO.supabase.co'
$env:Supabase__PublishableKey = 'sb_publishable_TU_CLAVE'
dotnet run --project Nova.csproj
```

El flujo previsto es navegador → API de Nova → Data API de Supabase. Define los permisos y las políticas de seguridad por fila (RLS) de las tablas que expongas. Para operaciones de usuarios autenticados, el backend deberá enviar su token de acceso en el encabezado `Authorization` de cada solicitud correspondiente. Consulta la [Data API de Supabase](https://supabase.com/docs/guides/api) y la [guía de claves de API](https://supabase.com/docs/guides/getting-started/api-keys).

## Publicar en GitHub

Crea un repositorio vacío llamado `proyecto-comercial-nova`, sin agregar un README desde GitHub, y conecta el repositorio local:

```powershell
git remote add origin https://github.com/TU-USUARIO/proyecto-comercial-nova.git
git push -u origin main
```

Para subir cambios posteriores, agrega los archivos que correspondan con `git add`, guarda el cambio con `git commit` y ejecuta `git push`. Consulta la [guía de GitHub para subir código local](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).
