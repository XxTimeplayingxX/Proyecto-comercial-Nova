# Contexto para agentes — Comercial Nova

Última actualización: 2026-11-25.

## Propósito y mantenimiento

Este archivo es la memoria de trabajo del proyecto. Leerlo al comenzar y actualizarlo cuando cambien la arquitectura, los contratos, el estado de implementación o los siguientes pasos. Mantenerlo breve y enlazar documentación detallada.

Distinguir siempre lo implementado en código, lo documentado como desplegado, lo probado y lo propuesto. No marcar tareas como terminadas sin evidencia. Al cerrar una tarea relevante, actualizar el estado, las limitaciones y el punto por donde continuar. Las prioridades propuestas aquí no sustituyen las instrucciones del usuario.

## Qué estamos construyendo

Comercial Nova es un prototipo universitario para un comercio de tecnología. La base actual permite iniciar sesión y consultar el catálogo e inventario. La documentación de la API contempla también clientes, ventas, movimientos de stock y estadísticas; su existencia en la API no significa que tengan una pantalla implementada.

## Arquitectura y responsabilidades

Es una sola aplicación C# con ASP.NET Core 10 (`net10.0`), MVC y Razor Pages. No hay proyectos separados de frontend y backend en este repositorio.

| Parte | Responsabilidad y ubicación |
| --- | --- |
| Frontend | HTML generado con Razor en `Pages/` y `Views/`; CSS y JavaScript en `wwwroot/`. Usa JavaScript para consultar las API locales del catálogo. |
| Backend web | `Program.cs` configura servicios, autenticación y rutas. `Controllers/` recibe solicitudes; `Infrastructure/` comunica con Supabase mediante HTTP. |
| Datos y autenticación | Supabase Auth y Data API sobre PostgreSQL. Los permisos dependen del usuario y de RLS. El frontend no ejecuta SQL directamente. |
| Contratos | `Models/` y `Dtos/` representan entradas, productos, respuestas y notificaciones. |
| Referencia de API | `documentación/` contiene contratos, colección Postman y SQL. |

Flujo del catálogo: navegador → `/api/productos...` en Nova → servicio HTTP → Supabase con token del usuario → respuesta de Nova → interfaz.

## Frontend actual

- `Views/Login/Index.cshtml`: formulario de inicio de sesión; recursos en `wwwroot/css/login.css` y `wwwroot/js/login.js`.
- `Pages/Index.cshtml`: bienvenida; el menú la presenta como Dashboard. No asumir que ya integra los indicadores de ventas.
- `Pages/Productos.cshtml`: catálogo con búsqueda por nombre o SKU, filtros por marca, categoría y estado, paginación, actualización manual, indicadores y diálogo de detalle. Lógica en `wwwroot/js/productos.js` y estilos en `wwwroot/css/productos.css`.
- `Pages/NuestraHistoria.cshtml`: pantalla informativa.
- `Pages/NotFound.cshtml`: pantalla para rutas inexistentes con estado HTTP 404.
- `Pages/Shared/_WorkspaceLayout.cshtml`: sidebar, cabecera y estructura compartida. Identidad visual azul y tipografía Inter; estilos comunes en `theme.css` y `site.css`.
- `Views/Shared/_ToastStack.cshtml` y `wwwroot/js/toast.js`: notificaciones reutilizables de éxito, información, error y advertencia.

Mantener estados de carga, vacío y error recuperable. No inventar productos, fotografías o indicadores para simular una integración. Los KPI fallidos deben mostrar ausencia de datos, no ceros falsos.

## Backend web actual

- `Controllers/LoginController.cs` y `Infrastructure/SupabaseAuthService.cs`: login contra Supabase Auth; cookie cifrada `Nova.Session`, `HttpOnly`, con vencimiento ligado al token. La opción Recordarme permite persistencia hasta ese vencimiento. Actualmente se requiere iniciar sesión otra vez al expirar; no asumir renovación automática.
- El token de acceso se conserva en las propiedades de autenticación y el servidor lo usa para consultar datos. No enviarlo al JavaScript ni guardarlo en el repositorio.
- `Infrastructure/SupabaseCatalogoService.cs`: consulta `products` con relaciones `brands` y `categories`; lee rangos de hasta 500 filas hasta agotar resultados. También consulta las tablas de marcas y categorías.
- Controladores del catálogo: `ProductosController`, `ProductosKpiController`, `ProductosFiltroController`, `ProductoDetalleController` y base compartida `CatalogoControllerBase`.

Rutas locales de consulta actuales, todas GET y con sesión:

| Ruta | Función |
| --- | --- |
| `/api/productos?buscar=&marca=&categoria=&estado=&pagina=1&tamano=10` | Listado, filtros y paginación. |
| `/api/productos/kpi` | Indicadores globales de inventario. |
| `/api/productos/filtros` | Opciones de marca y categoría. |
| `/api/productos/{id}` | Detalle por ID. |

Creación implementada: `POST /api/productos` con sesión y antifalsificación. Envía categoría, marca, SKU, nombre, precio, mínimo, estado, descripción e imagen a `POST /rest/v1/products?select=id` con `Prefer: return=representation`; el JWT del usuario y RLS restringen la escritura a administradores activos. Omite stock inicial (default cero); las entradas se hacen por ajustes. `GET /api/productos/filtros?activos=true` devuelve opciones activas para el formulario.

Frontend de creación: botón **Nuevo producto**, parcial `Pages/Shared/_ProductoFormulario.cshtml`, `wwwroot/js/producto-form.js` y `wwwroot/css/producto-form.css`. Shell reutilizable: `Views/Shared/_Modal.cshtml` + `Models/ModalOptions.cs`, `modal.js` y `modal.css`; configurable con título, descripción, parcial y formulario. Diálogo nativo con foco/Escape; bloqueo de cierre al guardar. Stock inicial de solo lectura, descripción opcional y URL HTTPS de imagen; no hay carga de archivos. Tras éxito refresca listado y KPI. No hay reintentos automáticos de escritura.

El estado de stock y los indicadores se calculan actualmente en C#; la paginación del listado se realiza en Nova tras obtener las filas. Los KPI consideran productos activos y no cambian con los filtros: disponible si `stock > minimum_stock`, bajo si `0 < stock <= minimum_stock`, agotado si `stock = 0`. Los inactivos pueden consultarse en la tabla y no cuentan en los KPI.

## Estado y diferencia pendiente de integración

La documentación en `documentación/README.md` y `documentación/Productos.md` registra como desplegados en Supabase:

- Vista `public.vw_product_catalog`, con estado calculado y campos del catálogo.
- RPC `public.get_inventory_summary`, con KPI globales.
- Verificación SQL del 2026-11-25 y permisos para `authenticated`, con vista `security_invoker`.

**El servicio C# actual todavía no consume esa vista ni ese RPC.** Consulta las tablas y calcula los resultados en Nova. No confundir los endpoints documentados de Supabase con las rutas locales ya implementadas. Las rutas `/Products/GetKpis`, `GetProducts`, `GetBrands`, `GetCategories` y `GetDetail` mencionadas en `Productos.md` son sugerencias históricas, no las rutas locales actuales.

La documentación registra pruebas HTTP con JWT real como pendientes. En la elaboración de este archivo solo se revisaron código y documentos: no se ejecutaron pruebas de aplicación ni se verificó el estado remoto de Supabase. Los conteos registrados en los documentos son observaciones históricas, no valores que deban fijarse en la interfaz.

## Hacia dónde vamos

Orden de continuación propuesto a partir del estado del repositorio; confirmar el alcance de cada nueva tarea con la solicitud del usuario:

1. Validar el flujo real de login y catálogo con una sesión autorizada, incluidos errores, filtros, detalle y vencimiento de sesión.
2. Alinear la integración de productos con la vista y el RPC documentados, revisando DTO, filtros, conteos y paginación en Supabase. Actualizar también la documentación que haya quedado desfasada.
3. Definir Storage e imágenes: bucket, acceso público o privado y resolución de rutas. Actualmente `image_path` puede ser nulo; se admiten URL HTTPS o rutas locales absolutas y se usa un ícono si la imagen falta o falla.
4. Acordar el siguiente módulo funcional. La API documenta clientes, ventas, ajustes y estadísticas, pero no hay una prioridad de implementación confirmada en este archivo.

## Ejecutar y comprobar

Requiere SDK de .NET 10. Desde la raíz:

```powershell
dotnet build Nova.csproj
dotnet run --project Nova.csproj
```

El perfil local usa `http://localhost:5180` en Development. Configurar `Supabase:ProjectUrl` y `Supabase:PublishableKey` mediante `appsettings.Local.json` o variables `Supabase__ProjectUrl` y `Supabase__PublishableKey`; las variables tienen prioridad. El archivo local está excluido de Git y de la publicación. No copiar credenciales a este documento.

Para limpiar y levantar el proyecto en un solo paso desde PowerShell en Windows, usar:

```powershell
.\iniciar.cmd
```

`iniciar.cmd` funciona sin Bash y sin modificar la política de ejecución de scripts de PowerShell. Ejecuta `dotnet clean Nova.csproj` y, si termina correctamente, `dotnet run --project Nova.csproj`, desde la carpeta del propio archivo.

Si se dispone de Bash (por ejemplo, una terminal Git Bash en Windows), también se puede ejecutar desde la raíz:

```bash
bash iniciar.sh
```

`iniciar.sh` ejecuta `dotnet clean Nova.csproj` y, si termina correctamente, `dotnet run --project Nova.csproj`. Resuelve la carpeta del proyecto respecto al script, por lo que también admite invocación mediante su ruta desde otro directorio. Detener con `Ctrl+C`. Antes de limpiar, detener cualquier instancia anterior de Nova que mantenga los archivos de compilación en uso.

No se identificó un proyecto de pruebas automatizadas en la estructura revisada. Para cambios de código, compilar y verificar el flujo afectado; registrar qué se probó y qué depende de acceso a Supabase. Un cambio exclusivamente documental no requiere ejecutar la aplicación.

## Reglas de trabajo

- En cada entrega que incluya modificaciones al proyecto, mostrar al usuario el comando para limpiar y ejecutar desde PowerShell: `.\iniciar.cmd`. Incluir también la alternativa directa `dotnet run --project Nova.csproj`. Ofrecer `bash iniciar.sh` solo si usa una terminal con Bash disponible. Mostrar los comandos de ejecución en la respuesta final, también cuando el cambio sea solo documental.
- Mantener controladores delgados y comunicación con Supabase en servicios; conservar los contratos en DTO/modelos.
- Usar el token del usuario y respetar RLS; no sustituirlo por claves privilegiadas para evitar restricciones.
- Nunca versionar contraseñas, JWT, cookies, claves privadas o archivos de configuración local. No registrarlos en logs.
- No modificar existencias directamente: la API documenta `adjust_stock` para ajustes y `register_sale` para ventas. Las ventas usan un UUID por operación y reutilizan ese UUID en reintentos.
- Las escrituras de prueba deben usar datos de prueba. La documentación distingue permisos de administrador y vendedor; verificar el contrato antes de ampliar funciones.
- Mantener documentación y Postman junto a cambios de API. Distinguir propuesta, despliegue y prueba; no afirmar que ejecutar SQL como administrador prueba los permisos HTTP de un usuario.
- Conservar cambios ajenos y evitar refactorizaciones fuera del alcance de la tarea.

## Documentos para retomar

- [README principal](README.md): ejecución, login, estructura y comportamiento actual del catálogo.
- [API y mantenimiento](documentación/README.md): contratos disponibles y estado documentado de Supabase.
- [Productos: SQL y REST](documentación/Productos.md): vista, RPC, filtros, ejemplos y verificaciones registradas.
- [SQL de inventario](documentación/inventario.sql) y [consultas de productos](documentación/productos_consultas.sql).
- [Colección Postman](documentación/Comercial_Nova.postman_collection.json).

## Última entrega

- 2026-11-25: implementados modal reutilizable y creación de productos. Contrato contrastado con Postman y esquema/restricciones/políticas reales mediante consultas de solo lectura. Compilación correcta y 14 comprobaciones HTTP en host temporal aislado con autenticación y Supabase simulados; se comprobó render Razor, payload, cabeceras, CSRF, autorización, validaciones, duplicados y permisos. Sintaxis JavaScript válida. Corregida validación decimal para independencia de configuración regional. No se escribieron datos reales. Pendientes prueba de creación con sesión real y revisión visual: Computer Use no pudo determinar la URL de Chrome y detuvo la inspección.
- 2026-11-25: creado este documento de contexto tras revisar estructura, código, documentación e historial reciente. El trabajo visible más reciente es la pantalla de productos y sus controladores. Pendiente continuar con la tarea que indique el usuario; la integración de vista/RPC y su validación HTTP siguen señaladas arriba.
