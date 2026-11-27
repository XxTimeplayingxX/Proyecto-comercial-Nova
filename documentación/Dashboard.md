# Dashboard administrativo y recorrido guiado

Actualizado: 2026-11-27. Pantalla `/Bienvenida`; referencia visual aportada por el usuario. Identidad Inter/azul y layout compartido; sin dependencias JavaScript externas.

## Alcance implementado

- Indicadores de ventas del periodo, número de operaciones completadas, productos activos y stock bajo.
- Filtros **Hoy**, **Esta semana** y **Este mes**. Semana desde lunes; límites de calendario en `America/Guayaquil`, inicio incluido y fin excluido al comienzo del día siguiente a hoy.
- Gráfico de los últimos siete días, incluido el día actual. Este gráfico conserva su ventana aunque cambie el periodo de los otros bloques; la pantalla y el tour lo explican.
- Top tres productos por unidades vendidas del periodo, con categoría, precio **actual** y barra relativa al más vendido. Los empates se ordenan por ID.
- Ventas del periodo paginadas de cinco en cinco, orden `created_at DESC, id DESC`, y detalle en el modal reutilizable. No hay un límite artificial de cinco ventas totales.
- Estados de carga, vacío y error con reintento; solicitudes anteriores canceladas/ignoradas al cambiar el periodo. No se representan errores como ceros ni se muestran datos de ejemplo.
- Tabla con desplazamiento horizontal en pantallas pequeñas, KPI en dos columnas y ranking/gráfico adaptables. Movimiento reducido.

Los importes y el conteo incluyen solo `sales.status='completed'`; la tabla incluye también `cancelled` del periodo. Se muestran **Registrada** y **Anulada**, no estados de pago inventados. El comprobante no es una factura fiscal ni confirma un cobro bancario. El detalle usa el precio histórico de `sale_details.unit_price` y su subtotal, aunque cambie el precio del catálogo.

Los productos son activos actuales; stock bajo significa `0 < stock <= minimum_stock`. Los agotados (`stock=0`) se informan por separado. Estos datos no son un inventario histórico del periodo. Los siete días sin ventas se rellenan con cero únicamente tras una consulta válida. No hay polling ni indicador ficticio de «sincronizado»; se muestra la fecha de consulta confirmada y un botón Actualizar.

La tabla es consulta administrativa por los periodos disponibles. No reemplaza un módulo independiente de historial general con rangos arbitrarios, búsqueda y exportación.

## Diferenciación de roles y seguridad

| Capa | Comportamiento |
| --- | --- |
| Login | Admin entra a `/Bienvenida`; seller a `/Ventas`. La misma decisión aplica al visitar `/` o `/Login` con sesión. |
| Navegación | Dashboard y Vendedores se renderizan solo para el claim de rol admin. Productos, Ventas y Nuestra historia continúan disponibles según sus contratos. |
| Página | `[Authorize(Roles="admin")]`; `IndexModel.OnGetAsync` consulta además el perfil activo real con JWT antes de mostrar la página. Perfil degradado/inactivo: 403. No se pudo verificar por error externo/configuración: 503. |
| API local | Cookie de Nova, `[Authorize(Roles="admin")]`, sin caché. Un vendedor no obtiene los datos invocando la URL directamente. |
| RPC | `SECURITY INVOKER`, `search_path=''`, comprobación de `auth.uid()` y `nova_private.active_role()='admin'`. Conserva RLS. Sin EXECUTE para PUBLIC/anon; authenticated puede ejecutar pero el cuerpo rechaza seller o perfil no activo. |
| HTTP a Supabase | Clave publicable configurada y JWT del usuario obtenidos solo en servidor. No se usa Auth Admin para el dashboard. |

El claim de menú puede quedar desactualizado hasta un nuevo login; la página y los RPC comprueban el perfil actual para que un administrador degradado no conserve acceso al panel. Esta entrega no rediseña las autorizaciones de todos los demás módulos.

## Consultas y despliegue Supabase

Se leyeron esquema, restricciones, políticas y las funciones existentes `get_dashboard_summary` y `get_top_products`. Se conservaron sin modificaciones. Para obtener un payload consistente, siete días, vendedores, detalle y paginación con una validación administrativa explícita se agregaron:

- `public.nova_dashboard(p_period text default 'semana', p_page integer default 1) RETURNS jsonb`.
- `public.nova_dashboard_sale(p_id bigint) RETURNS jsonb`.

Migración remota aplicada: **nova_dashboard_admin**. DDL versionado: [dashboard.sql](dashboard.sql), copia del SQL aplicado; no es una nueva migración que deba ejecutarse además de la registrada. No se modificaron tablas, políticas, existencias, ventas, funciones anteriores ni plan de Supabase. Tampoco se crearon cuentas o ambientes.

Las consultas agrupan `sales`/`sale_details`, consultan `products`/`categories` y relacionan el perfil del vendedor. El detalle consulta el nombre del cliente o «Consumidor final» sin exponer correo, identificación ni teléfono. Las funciones operan con los permisos del usuario. El listado y el detalle devuelven IDs de venta como texto para evitar pérdida de precisión en JavaScript.

El asesor de seguridad remoto no reportó nuevos avisos por estas funciones; conservó el aviso previo de protección de contraseñas filtradas de Auth desactivada. No se cambió esa configuración.

## API local

GET autenticados de lectura; no requieren antifalsificación. El navegador no envía JWT ni clave Supabase. Los POST de PostgREST indicados debajo son llamadas **de lectura** a RPC desde el servidor, no registros de venta.

### GET `/api/dashboard?periodo=semana&pagina=1`

`periodo`: `hoy`, `semana` o `mes`; `pagina`: entero entre 1 y 100000. Página fija de cinco ventas. Envía `{p_period,p_page}` a `POST /rest/v1/rpc/nova_dashboard`.

Respuesta 200:

```text
{
  period, from, to, generatedAt, page,
  summary: { salesTotal, salesCount, productsCount, lowStockCount, outOfStockCount },
  daily: [{ date, amount }],
  topProducts: [{ id, name, price, category, units, revenue }],
  recentSales: [{ id, date, total, status, seller }],
  totalRows
}
```

`daily` contiene siete fechas; `topProducts` hasta tres filas; `recentSales` hasta cinco. Un periodo válido sin operaciones devuelve agregados cero y listas vacías. `totalRows` incluye las ventas del periodo, no solo completadas, para paginar la tabla.

### GET `/api/dashboard/ventas/{id}`

ID bigint positivo. Envía `{p_id}` a `POST /rest/v1/rpc/nova_dashboard_sale`. Respuesta 200:

```text
{ id, date, total, status, seller, customer,
  items: [{ name, sku, quantity, price, subtotal }] }
```

Si el RPC devuelve JSON null, Nova responde 404. No se envían UUID de operación ni tokens al navegador.

Errores locales: **400** filtros/ID inválidos; **401** sin sesión; **403** rol/perfil no autorizado; **404** detalle ausente; **502** rechazo/error de Supabase no clasificable como autorización; **503** conexión/configuración/JSON inválido. Se usan mensajes locales, sin volcar respuestas externas completas.

Cuatro solicitudes de referencia en **Dashboard administrativo** de [Postman](Comercial_Nova.postman_collection.json): dos GET locales y dos RPC remotos, con parámetros, respuestas y errores. `dashboard_sale_id` es un ID de consulta que debe reemplazarse por uno visible de prueba; no es un contador ni dato de la interfaz.

## Recorrido guiado

La cabecera compartida ofrece **¿Primera vez por aquí?** en las páginas del workspace. El recorrido:

1. Se abre exclusivamente al pulsar esa opción; no se dispara en login, carga, primer uso ni por almacenamiento local.
2. Construye pasos para los elementos presentes y visibles: navegación disponible para ese rol, dashboard, catálogo, carrito, vendedores/ficha, historia y cuenta.
3. Explica cada opción sin enviar formularios, navegar automáticamente ni modificar datos. Para otra página, el usuario navega y vuelve a iniciarlo allí.
4. Muestra progreso, Anterior, Siguiente y Finalizar; permite cerrar o usar Escape. Es un `dialog` nativo con foco contenido, título enfocado por paso y retorno al botón iniciador al cerrar.
5. Resalta el elemento y posiciona la ayuda dentro del viewport. En móvil/menú oculto se omiten enlaces que no están visibles; se explica el botón de navegación. No abre ni cambia la preferencia del sidebar.
6. No se superpone a una operación con otro diálogo abierto. Si aparece el aviso de inactividad, cierra el tour para dar prioridad a la sesión. El recorrido no mantiene viva una sesión por sí solo.
7. Respeta movimiento reducido y funciona sin librerías, cookies nuevas ni endpoints adicionales.

La prueba de navegación real con teclado, Escape, zoom, teléfono y lector de pantalla sigue pendiente; los tests de DOM no certifican todos los comportamientos del diálogo nativo.

## Archivos

- `Pages/Index.cshtml` y `Index.cshtml.cs`: dashboard y verificación administrativa de página.
- `Dtos/DashboardDto.cs`, `Controllers/DashboardController.cs`, `Infrastructure/SupabaseDashboardService.cs`, registro en `Program.cs`.
- `Pages/Shared/_DashboardVenta.cshtml`: contenido del modal reutilizable.
- `wwwroot/css/dashboard.css`, `wwwroot/js/dashboard.js`: presentación y consultas.
- `Pages/Shared/_WorkspaceLayout.cshtml`, `_WorkspaceNav.cshtml`, `LoginController`: entrada al tour, menú y landing por rol. Toast de login centralizado en el layout para que también lo reciba el vendedor.
- `wwwroot/css/tour.css`, `wwwroot/js/tour.js`: recorrido compartido.

## Comprobaciones realizadas

| Nivel | Resultado | Límite |
| --- | --- | --- |
| Compilación .NET | Cero errores/advertencias; salida temporal. | No es inspección visual. |
| SQL remoto con `SET LOCAL ROLE authenticated` e identidad emulada | Periodos, resumen contra sumas directas, stock bajo, siete días, límites, paginación vacía, detalle, ausencia, rechazo seller/sin perfil y falta de EXECUTE para anon comprobados. | Solo lectura, transacción revertida. No es HTTP con JWT real. |
| Host aislado HTTP/Razor con cookies ASP.NET y Supabase simulado | 23 comprobaciones aprobadas: anónimo, seller, admin, cookie admin degradada, perfil inactivo, render, tres periodos, filtros, página, cabeceras/payload, detalle, 404/400, redirección seller y errores externos. | Host temporal no versionado; no es conexión real de navegador a Supabase. |
| JavaScript completo con DOM/red simulados | Ocho escenarios aprobados: ceros/vacío, error, reintento, cambio de periodo, respuesta obsoleta ignorada, tour solo por clic, pasos/foco y prioridad de otros diálogos/inactividad. | No sustituye navegador real, layout, teclado nativo ni dispositivo físico. |
| Asesor remoto | Solo aviso de Auth previo. | No se cambió la configuración de contraseñas. |

Scripts reproducibles versionados:

- [SQL de comprobación](pruebas/dashboard.sql): ejecutar completo en una sesión SQL administrativa; usa perfiles admin/seller activos existentes y emula identidad bajo rol authenticated, sin crear ni modificar registros.
- [Prueba de interfaz y tour](../scripts/pruebas/dashboard-tour.mjs), Node 20+:

```powershell
node scripts/pruebas/dashboard-tour.mjs
```

Pendientes: inspección visual real de la referencia, teléfono/teclado, acceso HTTP con JWT admin/seller real, desempeño con volumen y actualización de la matriz Excel después de reejecutar sus casos. No se actualizan sus aprobados automáticamente por esta implementación.

Relación académica: P3 (roles/regresión), P4 (orientación y detalle sin abandonar el contexto), P5 (contratos/documentación), P6 (responsive). El dashboard no resuelve la edición simultánea P2 ni sustituye la prueba concurrente de ventas P1.

## Ejecutar

Detener una instancia anterior y, desde PowerShell en la raíz:

```powershell
.\iniciar.cmd
```

Alternativa directa:

```powershell
dotnet run --project Nova.csproj
```

Abrir `http://localhost:5180` e iniciar sesión como administrador. No se hizo commit ni push.
