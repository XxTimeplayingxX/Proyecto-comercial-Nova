# Contexto para agentes — Comercial Nova

Última actualización: 2026-11-27.

## Propósito y mantenimiento

Este archivo es la memoria de trabajo del proyecto. Leerlo al comenzar y actualizarlo cuando cambien la arquitectura, los contratos, el estado de implementación o los siguientes pasos. Mantenerlo breve y enlazar documentación detallada.

Distinguir siempre lo implementado en código, lo documentado como desplegado, lo probado y lo propuesto. No marcar tareas como terminadas sin evidencia. Al cerrar una tarea relevante, actualizar el estado, las limitaciones y el punto por donde continuar. Las prioridades propuestas aquí no sustituyen las instrucciones del usuario.

## Qué estamos construyendo

Comercial Nova es un prototipo universitario para un comercio de tecnología. La base actual permite iniciar sesión, consultar y gestionar productos, y preparar, validar y registrar ventas en `/Ventas`. La documentación de la API contempla también clientes, movimientos de stock y estadísticas; no asumir que cada contrato tiene una pantalla de administración implementada.

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

- Navegación y sesión: correo/avatar abre perfil propio; sidebar de escritorio ocultable y redimensionable de 200–340 px, con persistencia local e íconos animados. `workspace-controls.css`, `workspace.js`, `session.js` y layout compartido. Modal de inactividad a los 120 s, cierre a los 180 s, explícitamente acordado con el usuario. Respeta movimiento reducido. [Contrato](documentación/Sesion.md).
- `Pages/Ventas.cshtml`: nueva venta con búsqueda/categorías, ocho skeletons por carga, carrito, cliente opcional, validación y confirmación. Estilos y lógica en `ventas.css` y `ventas.js`. Navegación responsive compartida en `_WorkspaceNav` y `workspace.js`; drawer modal hasta 900 px. Ver `documentación/Ventas.md`.
- `Views/Login/Index.cshtml`: formulario de inicio de sesión; recursos en `wwwroot/css/login.css` y `wwwroot/js/login.js`.
- `Pages/Index.cshtml` y `Index.cshtml.cs`: dashboard solo admin, con verificación de perfil activo antes del render; indicadores, periodos, gráfico de siete días, ranking, ventas paginadas y detalle. `dashboard.css/js`; consultas nuevas documentadas en `documentación/Dashboard.md`. Seller entra a Ventas y no ve el enlace al dashboard.
- Recorrido guiado en la cabecera **¿Primera vez por aquí?**, solo por clic. `tour.css/js`, diálogo nativo, pasos de los elementos visibles según página/rol, sin escrituras ni inicio automático. Cede al aviso de inactividad y respeta movimiento reducido. Ver `documentación/Dashboard.md`.
- `Pages/Productos.cshtml`: catálogo con búsqueda por nombre o SKU, filtros por marca, categoría y estado, paginación, actualización manual, indicadores y diálogo de detalle. Lógica en `wwwroot/js/productos.js` y estilos en `wwwroot/css/productos.css`.
- **Agregar stock** en las acciones del producto reutiliza el diálogo compartido. Muestra stock del listado y estimación, acepta cantidad entera, motivo y observaciones opcionales. Refresca tabla/KPI tras confirmar. Parcial `_StockFormulario.cshtml`, `stock-form.js` y `stock-form.css`.
- `Pages/Vendedores.cshtml` y `wwwroot/js/vendedores.js`: directorio administrativo, búsqueda, métricas, vinculación de una cuenta Auth existente y edición/activación de perfiles seller. [Guía y contrato](documentación/Vendedores.md).
- `Pages/VendedorFicha.cshtml` expone `/Vendedores/Nuevo` y `/Vendedores/Editar/{id}` con credenciales, rol, estado y comprobantes. Auth Admin requiere `Supabase__AuthAdminKey` solo en el servidor. `SupabaseAuthAdminService` limita su uso a Auth. La Data API de perfiles conserva JWT de usuario y la vinculación manual por UID sigue disponible. [SQL de apoyo](documentación/vendedores_alta.sql).
- **Ver trazabilidad** en las acciones del producto abre `_TrazabilidadProducto.cshtml` con alta, movimientos, vendedor y comprador registrado. El punto de ingreso opcional se guarda en el motivo de nuevos movimientos. [Contrato](documentación/Trazabilidad.md).
- `Pages/NuestraHistoria.cshtml`: timeline ficticio de Ernesto Salazar (1968, 1986, 2005 y 2026), quien comienza con baterías. Fotografías IA en blanco y negro `nova-story-*.png` dentro de `wwwroot/images/`; no son archivos del catálogo ni de Storage. `story.css` y `story.js`: etapas alternadas, navegación por año, progreso, revelado y parallax de ±24 px con requestAnimationFrame, estático hasta 700 px y con movimiento reducido. Ver `documentación/Historia.md`.
- `Pages/NotFound.cshtml`: pantalla para rutas inexistentes con estado HTTP 404.
- `Pages/Shared/_WorkspaceLayout.cshtml`: sidebar, cabecera y estructura compartida. Identidad visual azul y tipografía Inter; estilos comunes en `theme.css` y `site.css`.
- `Views/Shared/_ToastStack.cshtml` y `wwwroot/js/toast.js`: notificaciones reutilizables de éxito, información, error y advertencia.

Mantener estados de carga, vacío y error recuperable. No inventar productos, fotografías o indicadores para simular una integración. Los KPI fallidos deben mostrar ausencia de datos, no ceros falsos.

## Backend web actual

- `DashboardController`, `SupabaseDashboardService` y `DashboardDto`: GET `/api/dashboard` y `/api/dashboard/ventas/{id}` solo admin. RPC `nova_dashboard` y `nova_dashboard_sale` de lectura, SECURITY INVOKER con perfil admin activo y RLS; migración remota `nova_dashboard_admin`. Semana desde lunes y calendario America/Guayaquil. Productos/stock actuales; ventas/top por periodo, gráfico siempre siete días. DDL aplicado `documentación/dashboard.sql`. No utiliza Auth Admin ni modifica ventas/stock. Login redirige admin a dashboard y seller a Ventas; toast de éxito compartido en layout.

- `NovaSessionPolicy` fija aviso 120 s, cierre por inactividad 180 s y máximo absoluto local 60 min, limitado por vencimiento real del token. CookieEvents rechaza cookies vencidas/antiguas sin metadatos. `GET /api/sesion` consulta perfil propio activo y devuelve tiempos sin JWT. `POST /api/sesion/actividad` exige antifalsificación y reemite cookie con igual expiración absoluta. Interacción humana reportada por JS; polling no renueva. No se cambió JWT expiry remoto ni se implementó refresh. `expires_in` y `expires_at` reales del login alimentan el panel de cuenta.
- `Controllers/VentasController.cs`, `Dtos/VentaDto.cs`, `Infrastructure/SupabaseVentasService.cs`: búsqueda paginada para venta, clientes, validación sin escritura y registro por RPC. Nuevas APIs `GET /api/ventas/productos`, `GET /api/ventas/clientes`, `POST /api/ventas/validar`, `POST /api/ventas`. Sesión en todas y antifalsificación en POST; no aceptar precios ni vendedor del navegador.
- El RPC `register_sale` ya existente toma precios, descuenta stock y escribe venta/detalle/movimientos de forma transaccional. Guardar UUID y pedido exacto antes de enviar; ante resultado incierto conservarlos en sessionStorage por usuario y reintentar directamente el RPC, sin prevalidar el stock ya descontado ni generar otro UUID. No agregar un reintento automático de escritura.
- `Controllers/LoginController.cs` y `Infrastructure/SupabaseAuthService.cs`: login contra Supabase Auth; cookie cifrada `Nova.Session`, `HttpOnly`, con vencimiento ligado al token. La opción Recordarme permite persistencia hasta ese vencimiento. Actualmente se requiere iniciar sesión otra vez al expirar; no asumir renovación automática.
- El token de acceso se conserva en las propiedades de autenticación y el servidor lo usa para consultar datos. No enviarlo al JavaScript ni guardarlo en el repositorio.
- El login consulta el perfil activo con el token antes de emitir la cookie y guarda el rol comercial. Para vincular vendedores se crea la cuenta en Supabase Auth y se registra su UUID en Nova. `VendedoresController` y `SupabasePersonalService` implementan `GET/POST /api/vendedores` y `PATCH /api/vendedores/{id}` con permisos de administrador activo. SQL remoto en `documentación/vendedores.sql`.
- `GET /api/productos/{id}/trazabilidad` consulta el alta y el historial con cursor, con perfil administrador activo. Las ventas se relacionan con vendedor y comprador mediante `stock_movements.sale_id`.
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

Entradas de inventario: `POST /api/productos/{id}/stock` con sesión y antifalsificación. Envía el JWT del usuario al RPC existente `adjust_stock`, limitado a administradores activos. El RPC incrementa stock y escribe el movimiento en una transacción. Ante confirmación incierta se bloquea el reenvío en el mismo diálogo y se indica verificar el historial. Ver [contrato y comprobaciones](documentación/Productos.md#agregar-stock).

Frontend de creación: botón **Nuevo producto**, parcial `Pages/Shared/_ProductoFormulario.cshtml`, `wwwroot/js/producto-form.js` y `wwwroot/css/producto-form.css`. Shell reutilizable: `Views/Shared/_Modal.cshtml` + `Models/ModalOptions.cs`, `modal.js` y `modal.css`; configurable con título, descripción, parcial y formulario. Diálogo nativo con foco/Escape; bloqueo de cierre al guardar. Stock inicial de solo lectura, descripción opcional e imagen por archivo o URL. Tras éxito refresca listado y KPI. No hay reintentos automáticos de escritura.

Storage desplegado: bucket público `product-images`, máximo 5 MB, JPEG/PNG/WebP. RLS de objetos permite INSERT solo a administrador activo en `catalogo/{auth.uid()}/` y SELECT de metadatos solo a administrador. Sin UPDATE/DELETE. Servicio `SupabaseStorageService` y `POST /api/productos/imagen` (multipart `archivo`, sesión y antifalsificación); JWT y clave publicable solo en servidor. El formulario sube al guardar, guarda URL pública en el producto y conserva la URL para reintentar si falla el producto. Desvincular no borra objetos. No cargar documentos privados aquí. Ver `documentación/Storage.md` y DDL aplicado `documentación/storage_product_images.sql`.

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
3. Verificar carga real con JWT admin/vendedor en el bucket ya configurado, y definir mantenimiento de archivos huérfanos. No borrar imágenes referenciadas ni intentar limpieza automática tras una respuesta incierta.
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

No hay un proyecto .NET de pruebas automatizadas. Hay dos pruebas focalizadas versionadas de stock: `scripts/pruebas/ventas-stock-ui.mjs` (Node 20+, DOM/red simulados) y `documentación/pruebas/ventas_stock.sql` (RPC real, sesión SQL administrativa, datos de prueba y rollback; no prueba JWT/RLS ni concurrencia). Ver `documentación/Resolucion_casos.md`. Para cambios de código, compilar y verificar el flujo afectado; registrar qué se probó y qué depende de acceso a Supabase. Un cambio exclusivamente documental no requiere ejecutar la aplicación.

## Reglas de trabajo

- Documentar cada modificación junto con su implementación: mantener este archivo y los documentos del módulo actualizados con comportamiento, contratos, comprobaciones y pendientes. Toda API nueva o modificada debe registrarse también en `documentación/Comercial_Nova.postman_collection.json`, explicando método, ruta, autenticación, parámetros/cuerpo, respuestas y errores. Distinguir rutas locales de Nova de endpoints de Supabase.
- En cada entrega que incluya modificaciones al proyecto, mostrar al usuario el comando para limpiar y ejecutar desde PowerShell: `.\iniciar.cmd`. Incluir también la alternativa directa `dotnet run --project Nova.csproj`. Ofrecer `bash iniciar.sh` solo si usa una terminal con Bash disponible. Mostrar los comandos de ejecución en la respuesta final, también cuando el cambio sea solo documental.
- Mantener controladores delgados y comunicación con Supabase en servicios; conservar los contratos en DTO/modelos.
- Usar el token del usuario y respetar RLS; no sustituirlo por claves privilegiadas para evitar restricciones.
- Nunca versionar contraseñas, JWT, cookies, claves privadas o archivos de configuración local. No registrarlos en logs.
- No modificar existencias directamente: la API documenta `adjust_stock` para ajustes y `register_sale` para ventas. Las ventas usan un UUID por operación y reutilizan ese UUID en reintentos.
- Las escrituras de prueba deben usar datos de prueba. La documentación distingue permisos de administrador y vendedor; verificar el contrato antes de ampliar funciones.
- Mantener documentación y Postman junto a cambios de API. Distinguir propuesta, despliegue y prueba; no afirmar que ejecutar SQL como administrador prueba los permisos HTTP de un usuario.
- Conservar cambios ajenos y evitar refactorizaciones fuera del alcance de la tarea.

## Documentos para retomar

- [Guía técnica para la defensa](documentación/Guia_tecnica_de_defensa.md). Controladores, flujos de pantalla, validaciones vinculadas al PDF y justificación de ASP.NET Core, PostgreSQL y Supabase.

- [Dashboard y recorrido](documentación/Dashboard.md): APIs, SQL aplicado, roles, periodos, definiciones de KPI y evidencias. Pruebas focalizadas `scripts/pruebas/dashboard-tour.mjs` y `documentación/pruebas/dashboard.sql`.

- [Revisión de la matriz QA](documentación/Revision_matriz_QA.md): 50 casos del Excel, prioridad de ejecución, brechas, rangos de resumen y nuevos escenarios propuestos.

- [Resolución práctica de los seis casos](documentación/Resolucion_casos.md): stock y toasts, pruebas versionadas, propuesta de concurrencia optimista y plan de QA/UX/móvil.

- [Caso de estudio y cobertura](documentación/Caso_de_estudio.md): diagnóstico del PDF académico, trazabilidad con código, conceptos del curso, comparación tecnológica y brechas.
- [Defensa del proyecto](documentación/Defensa_del_proyecto.md): guion de diez minutos, demo válida/inválida, respuestas al PDF y evidencias pendientes antes de presentar/publicar.

- [README principal](README.md): ejecución, login, estructura y comportamiento actual del catálogo.
- [API y mantenimiento](documentación/README.md): contratos disponibles y estado documentado de Supabase.
- [Productos: SQL y REST](documentación/Productos.md): vista, RPC, filtros, ejemplos y verificaciones registradas.
- [SQL de inventario](documentación/inventario.sql) y [consultas de productos](documentación/productos_consultas.sql).
- [Colección Postman](documentación/Comercial_Nova.postman_collection.json).

## Última entrega

- 2026-11-27: creada la guía técnica de defensa tras contrastar el PDF original con el código. Incluye todos los controladores, pantallas y validaciones por capa, comparación tecnológica y demo válida/inválida. Revisión documental sin cambios funcionales ni ejecución de pruebas de aplicación. Continúan pendientes la concurrencia de ventas con sesiones reales y el control de versiones en edición de productos.

- 2026-11-27: implementado dashboard responsive según referencia con consultas reales, detalle en modal y acceso admin en página/API/RPC. Migración `nova_dashboard_admin` aplicada; dos RPC SECURITY INVOKER, sin cambios a ventas/stock/RLS previos. Login/menú diferenciados para seller. Tour compartido voluntario por clic, pasos por página, foco/progreso y prioridad de inactividad. Compilación correcta, comprobaciones SQL de solo lectura bajo authenticated/identidad emulada aprobadas, 23 casos HTTP/Razor en host con Supabase simulado y ocho escenarios DOM/red simulados aprobados. Asesor remoto solo aviso Auth previo. Postman y documentación actualizados. Pendientes navegador/teclado/teléfono reales y HTTP con JWT real; no se publicó GitHub ni se aprobaron automáticamente casos del Excel.

- 2026-11-27: revisado Excel externo Matriz_QA_Comercial_Nova.xlsx sin modificarlo. Conciliados 50 casos únicos: 32 aprobados (26 reportados Brave y 6 simulados), 14 pendientes, 2 bloqueados, 2 brechas. Fórmulas y validación terminan en fila 60 y deben ampliarse al agregar casos; falta contador visible de Fallidos. Documentadas prioridades, mejoras de evidencia y propuestas QA-051–060 en Revision_matriz_QA.md. Editar vendedor existe; prioridad funcional es concurrencia optimista y cierre de venta real, seguida de historial general. No se reejecutaron escenarios ni se verificó el entorno remoto; sin APIs nuevas o cambios de Postman.

- 2026-11-27: revisado enunciado y RPC real con plugin Supabase. Confirmado descuento atómico condicional `stock >= cantidad`; sin cambios de SQL/RLS remotos. Añadidos toasts de advertencia para cantidades/validación/rechazo final de stock y mensajes con solicitado/disponible en servicio. Seis casos reales de RPC aprobados con identidad emulada y rollback; consulta posterior sin productos de prueba persistidos (secuencias pueden avanzar). Seis escenarios DOM/red simulados y 24 casos POST reejecutados con Supabase simulado; compilación sin errores/advertencias. Dos scripts focalizados versionados y Postman/guías actualizados. Concurrencia real, HTTP con JWT e inspección visual pendientes; edición optimista es propuesta, no implementada. No se crearon ambientes, CI, commit ni push.

- 2026-11-26: documentado en README el error de configuración de login tras clonar. El mensaje proviene de OptionsValidationException: requiere URL HTTPS y PublishableKey con prefijo sb_publishable_. El archivo local está ignorado y cada integrante debe configurarlo; añadidos ejemplo sin credenciales, precedencia de variables y reinicio. Revisión de código, sin cambios funcionales ni APIs; no se verificó el equipo del compañero ni se ejecutó login remoto.

- 2026-11-26: revisado el texto completo del PDF académico de cuatro páginas y contrastado con código/contratos. Añadidas matriz de los seis problemas, diagnóstico, arquitectura/POO/MVC, comparación de dos alternativas y guía de defensa con demo y preguntas del PDF. Límite destacado: PATCH comercial filtra solo por ID, sin versión esperada; concurrencia real de ventas pendiente y distinta de la idempotencia por UUID. Revisión exclusivamente documental, sin ejecutar aplicación, escrituras en Supabase, commit ni push. Las pruebas temporales históricas no son una suite versionada. Continuar con ensayos reales sobre datos de prueba y guardar evidencias saneadas; no afirmar que ya se completaron. Índices README actualizados; 29 enlaces locales comprobados, JSON Postman válido y diff sin errores de formato. Ninguna API modificada por esta tarea.

- 2026-11-26: rediseñada Nuestra historia como timeline editorial del fundador ficticio Ernesto Salazar, con cuatro etapas y cuatro fotografías IA en blanco y negro guardadas en el proyecto. Humor discreto, ficción declarada y conservación de misión/visión/valores. Compilación y comprobaciones de Razor, recursos y parallax con DOM/geometría simulados aprobadas; imágenes inspeccionadas. Pendiente revisión visual del sitio en navegador. Documentación en `documentación/Historia.md`; no hay APIs nuevas ni cambios de contratos/Postman.
- 2026-11-26: corregido espaciado del modal de vinculación (fieldset sin padding por regla compartida) mediante contenedor propio, inputs compactos y una columna en móvil. Confirmada ausencia de AuthAdminKey en configuración local/entorno revisado, sin mostrar valores. El alta sigue bloqueada sin esa clave; ahora muestra un aviso destacado antes del formulario y explicación accesible en el botón. Documentado diagnóstico y configuración segura en `documentación/Vendedores.md`. Compilación y nueve comprobaciones de HTML/Razor en host aislado aprobadas; inspección visual pendiente. No se configuraron secretos ni se crearon cuentas reales; no hay APIs nuevas ni cambios de contrato.
- 2026-11-26: corregidos correo readonly en alta sin Auth Admin y centrado del switch. Sidebar desktop ocultable/redimensionable con teclado/arrastre, persistencia y movimiento de íconos. Panel de perfil propio y aviso de inactividad 2 min/cierre 3 min acordados. Límite local absoluto 60 min o expiración previa del token. Dos APIs de sesión documentadas en Postman y `documentación/Sesion.md`. Compilación y 33 comprobaciones en host temporal con cookies reales, Supabase/DOM/reloj simulados; sin cambios remotos. Requiere volver a iniciar sesión. La ausencia de AuthAdminKey sigue impidiendo crear credenciales; no se eludió ni configuró esa clave. Pendiente revisión visual real.
- 2026-11-25: fichas completas de alta y edición conectadas al listado. Migración `nova_alta_cuentas_comerciales` aplicada y comprobada con datos de prueba revertidos. Pasaron 45 comprobaciones HTTP/Razor en host simulado. La clave de Auth Admin falta en la configuración local. Pendientes cambios reales de credenciales e inspección visual. [Guía](documentación/Vendedores.md).
- 2026-11-25: implementados **Vendedores**, vinculación y edición de perfiles seller, validación de perfil activo en login, cierre de sesión y trazabilidad por producto. Migración `nova_vendedores_perfiles` aplicada. Prueba SQL por roles en transacción revertida y 31 comprobaciones HTTP/Razor con Supabase simulado aprobadas. Se comprobó la relación con movimientos para la venta registrada. Quedan pendientes una prueba con cuentas reales y revisión visual en navegador. Ver [Vendedores](documentación/Vendedores.md) y [Trazabilidad](documentación/Trazabilidad.md).
- 2026-11-25: implementado **Agregar stock** y `POST /api/productos/{id}/stock` con el RPC existente `adjust_stock`. Firma, permisos y transacción verificados sin escrituras en Supabase. Compilación correcta y 21 comprobaciones con host aislado y Supabase simulado. Contrato y Postman actualizados. Pendientes inspección visual (control del navegador no disponible para la URL) y prueba con sesión real sobre datos de prueba.
- 2026-11-25: configurado bucket público `product-images` (5 MB, JPEG/PNG/WebP) y dos políticas RLS acotadas a rol/bucket/carpeta, sin sobrescritura/borrado. Integrados selector, vista previa y subida al guardar por nueva API `POST /api/productos/imagen`. Bucket/políticas verificados por SQL y asesor de seguridad consultado (solo aviso previo de contraseñas filtradas de Auth). Compilación correcta y 17 casos de subida en host aislado con Storage simulado. No se subieron fotos reales ni se cambió el plan. Documentación/JSON actualizados. Pendientes prueba con JWT real e inspección visual.
- 2026-11-25: implementada nueva venta en `/Ventas`, cuatro APIs locales y navegación compartida responsive. Contrato del RPC y esquema revisados con consultas de solo lectura; sin cambios remotos. Documentación en `documentación/Ventas.md` y carpeta **Nova local — ventas** de Postman. Compilación temporal correcta y 24 casos POST en host aislado con Supabase simulado, además de búsquedas, Razor con ocho skeletons y sintaxis JS. Pendientes pruebas con sesión/stock reales, concurrencia e inspección visual (host de navegador no disponible). Sin ventas reales ni descuentos de inventario durante pruebas.
- 2026-11-25: edición integrada en el modal de alta mediante `PATCH /api/productos/{id}`; detalle ampliado con descripción e IDs de relaciones. SKU y stock no se incluyen en el PATCH saliente a Supabase. Acciones con SVG de detalle/edición, transición derecha a izquierda con hover/foco, visibles en táctil y tabla como tarjetas hasta 600 px. Imagen por URL con vista previa y desvinculación, sin eliminar archivos remotos. Investigación de Storage en `documentación/Storage.md`: consulta remota de solo lectura confirmó ausencia de buckets/políticas; no se desplegó carga ni se cambió el plan. Documentación y colección Postman se actualizan junto con el código.
- Validación de edición: compilación con salida temporal correcta (la instancia abierta bloquea `bin/`); 17 casos HTTP en host aislado con autenticación y Supabase simulados aprobados. Comprobados filtro PATCH por ID, cabeceras, exclusión de SKU/stock, imagen null/ruta local, errores, DTO de detalle, Razor, sintaxis JS y JSON/scripts de Postman. Pendientes revisión visual y escritura con sesión real. Detener la instancia anterior antes de ejecutar `.\iniciar.cmd`.
- 2026-11-25: implementados modal reutilizable y creación de productos. Contrato contrastado con Postman y esquema/restricciones/políticas reales mediante consultas de solo lectura. Compilación correcta y 14 comprobaciones HTTP en host temporal aislado con autenticación y Supabase simulados; se comprobó render Razor, payload, cabeceras, CSRF, autorización, validaciones, duplicados y permisos. Sintaxis JavaScript válida. Corregida validación decimal para independencia de configuración regional. No se escribieron datos reales. Pendientes prueba de creación con sesión real y revisión visual: Computer Use no pudo determinar la URL de Chrome y detuvo la inspección.
- 2026-11-25: creado este documento de contexto tras revisar estructura, código, documentación e historial reciente. El trabajo visible más reciente es la pantalla de productos y sus controladores. Pendiente continuar con la tarea que indique el usuario; la integración de vista/RPC y su validación HTTP siguen señaladas arriba.
