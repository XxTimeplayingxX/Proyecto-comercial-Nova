# Resolución de los seis problemas del caso

Actualizado: 2026-11-27. Fuente: enunciado académico aportado por el usuario, también analizado en [Caso de estudio](Caso_de_estudio.md). Este documento distingue lo implementado, lo comprobado y lo propuesto; complementa la [guía de defensa](Defensa_del_proyecto.md).

## 1. Vender únicamente cuando hay stock suficiente

### Protección existente en Supabase, confirmada por lectura remota

`public.register_sale` llama a `nova_private.register_sale`. La función privada comprueba usuario y perfil activo admin/seller, cantidades positivas y tamaño del pedido. Para cada producto ejecuta una actualización condicional equivalente a:

```sql
update public.products
set stock = stock - r.quantity, updated_at = now()
where id = r.product_id and is_active and stock >= r.quantity
returning * into prod;
```

Si no actualiza una fila, lanza `PT409 / INSUFFICIENT_STOCK` y revierte toda la venta. PostgreSQL serializa escrituras sobre la misma fila; la condición se vuelve a comprobar cuando procede tras esperar una modificación concurrente. Por ello la decisión está en la base, no en una lectura anterior ni solo en el botón. Referencias: [bloqueos de PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html), [aislamiento Read Committed](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED). No se sustituyó ni modificó la función remota: la protección ya existía.

La tabla también tiene `CHECK (stock >= 0)`. Esa restricción es una última barrera, no reemplaza comprobar la cantidad ni registrar movimientos. No se modifica stock con PATCH directo.

El bloqueo transaccional por UUID evita duplicar **el mismo pedido**. La actualización condicional del producto protege **pedidos distintos**. No confundir idempotencia con control de existencias.

### Experiencia implementada en esta entrega

- Stock cero: la tarjeta muestra **Sin stock** y no permite agregar desde el catálogo.
- Si se escribe cantidad 3 y el stock consultado es 2: restaura la cantidad anterior y muestra un toast de advertencia con solicitado/disponible; no envía una venta.
- `POST /api/ventas/validar`: ante stock cero responde 409 con «no tiene existencias»; ante cantidad superior indica cuánto se solicitó y cuánto hay. La pantalla muestra los errores en un toast y junto al carrito, y bloquea confirmar.
- Si el stock cambia **después** de validar, `POST /api/ventas` recibe el rechazo final del RPC y Nova muestra el toast **Venta rechazada por falta de stock**. Se requiere revisar y validar de nuevo. No se inventa una cifra de stock a partir de ese rechazo, porque la respuesta final no la contiene.
- Si el resultado es incierto por conexión, conserva UUID y cuerpo exacto para recuperación manual. No se trata como rechazo de stock ni se genera otra operación.

El mensaje permanente permanece disponible si no carga el servicio de toasts. Las comprobaciones de interfaz no sustituyen la validación del servidor; `/validar` no reserva existencias.

### Pruebas realizadas el 2026-11-27

| Nivel | Resultado | Límite |
| --- | --- | --- |
| RPC real, SQL administrativo con identidad emulada | Seis casos aprobados: stock cero; 3 con stock 2; venta exacta; replay sin otro descuento; UUID con otro pedido; reversión completa de varias líneas. | No prueba HTTP con JWT, políticas RLS por rol ni simultaneidad de sesiones. |
| Aislamiento de datos de prueba | Script completo en una transacción revertida; consulta posterior encontró cero productos de esa prueba persistidos. | Las secuencias PostgreSQL pueden avanzar aunque se haga rollback. |
| Interfaz con DOM/red simulados | Seis escenarios aprobados de bloqueo, cantidad inválida, toasts de validación/registro, recuperación y fallback sin toasts. | No es inspección visual ni ejecución en navegador real. |
| HTTP/Razor con Supabase simulado | Reejecutados 24 casos POST del host temporal: stock, precios, UUID, permisos, antifalsificación, errores y recuperaciones; ocho skeletons comprobados. | Host temporal no versionado; no es integración HTTP real con Supabase. |
| Compilación | Cero errores y advertencias, salida temporal. | No demuestra despliegue productivo. |

Pruebas focalizadas que ahora quedan **versionadas**:

- [ventas_stock.sql](pruebas/ventas_stock.sql): ejecutar completo y en una sola sesión administrativa, preferiblemente en QA. Crea productos identificados como prueba, carga por `adjust_stock` y revierte al finalizar. Si una herramienta detiene el script ante un error, ejecutar `ROLLBACK` en esa misma sesión antes de continuar.
- [ventas-stock-ui.mjs](../scripts/pruebas/ventas-stock-ui.mjs): prueba del script real con DOM y red mínimos simulados, sin dependencias externas. Desde la raíz, con Node.js 20 o posterior:

```powershell
node scripts/pruebas/ventas-stock-ui.mjs
```

Node es requisito de esta comprobación, no del programa ASP.NET. El entorno de trabajo las ejecutó mediante su runtime Node disponible. Pendientes: veinte ventas simultáneas con UUID distintos, sesión HTTP real y revisión visual.

## 2. Evitar sobrescrituras entre empleados

**Propuesta, todavía no implementada:** control de concurrencia optimista en la edición comercial del producto.

1. Agregar una versión numérica controlada por la base. El detalle devuelve esa versión junto al formulario.
2. El guardado envía la versión esperada y la operación en base actualiza **atómicamente** solo si coincide, incrementándola. Todos los caminos que cambien los campos protegidos deben mantenerla; no confiar en un número nuevo enviado por el navegador.
3. Si otro empleado guardó antes, el segundo recibe 409 `PRODUCT_CHANGED`, conserva su borrador y ve «Este producto fue actualizado por otra persona. Revisa los cambios antes de guardar».
4. Ofrecer recargar/comparar la versión actual. No sobrescribir ni reintentar automáticamente. Definir qué campos se protegen para decidir si un movimiento de stock debe invalidar una edición comercial.

Ejemplo: Ana y Luis abren versión 7. Ana guarda y la base pasa a 8. Luis intenta guardar esperando 7: se rechaza y puede comparar. Un modal o RLS no resuelve ese conflicto por sí mismo.

El PATCH actual filtra solo por ID. Añadir una consulta de versión **antes** del PATCH tampoco basta: alguien podría escribir entre ambas operaciones. `updated_at` existe, pero no se usa como condición de concurrencia ni se verificó aquí que todos los caminos comerciales lo actualicen. Requiere migración, DTO/API, modal, pruebas con dos sesiones y actualización de Postman; esta entrega no aplicó esa migración.

## 3. Cambiar una función sin romper otras

La alineación de ambientes es necesaria, pero las regresiones también pueden venir de acoplamiento, contratos incompatibles o reglas sin probar. Se necesita combinar:

| Control propuesto | Qué debe coincidir / comprobarse | Estado actual |
| --- | --- | --- |
| Entornos separados | Desarrollo para construir; QA con datos de prueba; producción para datos operativos. | No se crearon ni se verificaron ambientes separados. No asumir que el proyecto remoto conectado es QA. |
| Código y runtime | Misma revisión Git y SDK/runtime .NET 10 compatible; promover el mismo artefacto validado. | Un proyecto `net10.0`; falta fijar y automatizar la cadena de entrega. |
| Base de datos | Mismas migraciones, firmas de RPC, restricciones, permisos y políticas necesarias. Las credenciales y datos son propios de cada ambiente. | Hay SQL/contratos documentados; falta un aprovisionamiento completo y verificable desde cero. |
| Contratos y regresión | Antes de integrar: compilar, ejecutar pruebas focalizadas y revisar login, catálogo, edición, stock, venta y sesión. | Ahora se versionan dos pruebas focalizadas de stock. No hay una suite completa ni CI configurado por esta entrega. |
| Configuración | Nombres de variables, límites de Storage y comportamiento de sesión coherentes; valores y secretos separados. | Configuración local documentada; no se comparó con una producción desplegada. |
| Publicación | Revisar diff, probar en QA, aplicar migraciones compatibles y tener un plan de recuperación. | Procedimiento propuesto, no despliegue ejecutado. |

No igualar datos reales entre ambientes ni copiar claves privilegiadas al repositorio. Mantener APIs estables y pruebas reproducibles aborda un problema distinto al de «funciona en mi máquina».

## 4. Operaciones sencillas y experiencia de usuario

Nova ya mantiene catálogo/carrito en `/Ventas` y reutiliza diálogos para producto, stock y detalle. Conserva búsqueda, skeletons, estados vacío/error y mensajes de recuperación. Evitar encadenar modales; una operación sencilla debe poder completarse sin cambiar repetidamente de contexto.

Comprobar con usuarios de prueba: localizar un producto, agregarlo, corregir una cantidad inválida y confirmar sin ayuda. Revisar foco, teclado, mensajes, doble envío y estado de guardado. Medir el recorrido antes/después; no declarar «UX resuelta» únicamente por tener modales o animaciones. Diseño y validación visual real siguen pendientes.

## 5. Continuidad cuando llega otro desarrollador

Se mantienen [agents.md](../agents.md), [README](../README.md), guías por módulo y [Postman](Comercial_Nova.postman_collection.json). Cada cambio debe indicar propósito, archivos, contrato, configuración, pruebas, límites y siguiente paso. Toda API modificada requiere actualizar también su entrada JSON.

Esta entrega documenta los nuevos mensajes y conserva los scripts de regresión. La explicación debe vivir junto al módulo y enlazarse desde los índices; no acumular toda la implementación en agents.md. La prueba de incorporación consiste en que otra persona clone, configure y ejecute siguiendo el README; todavía no se declara completada.

## 6. Consulta desde dispositivos móviles

El alcance actual es web responsive: drawer lateral hasta 900 px, catálogo de productos como tarjetas hasta 600 px y distribución adaptable del punto de venta. Acciones visibles en dispositivos táctiles y movimiento reducido. No se incorporó una aplicación nativa ni modo offline.

Validación pendiente en anchos de teléfono/tableta y, al menos, un dispositivo real: menú, campos, teclado virtual, modales, carrito y toasts sin tapar controles. La lógica de venta debe seguir funcionando en servidor independientemente del tamaño de pantalla. Las mejoras responsive actuales permiten avanzar sin duplicar el frontend.

## Orden sugerido de continuación

1. Completar inspección visual del flujo y prueba HTTP con cuentas autorizadas sobre datos de prueba.
2. Implementar concurrencia optimista de productos con rechazo recuperable.
3. Ensayar ventas simultáneas reales y conservar resultados saneados.
4. Completar pruebas de regresión y alineación verificable de ambientes antes de automatizar publicación.

No se modificaron funciones, esquema, RLS o plan de Supabase, ni se publicaron cambios en GitHub. Se usó la conexión del plugin para leer definiciones y ejecutar las comprobaciones SQL revertidas, no para enviar mensajes a otras personas.
