# Guía para defender Comercial Nova

Preparación: 2026-11-26. Basada en el PDF académico **CASO DE ESTUDIO PROYECTO FINAL.pdf**, secciones 5, 7 y 8 (pp. 2–4), y en la [revisión del caso y del código](Caso_de_estudio.md). Es un guion propuesto; no afirma que la demostración ya se haya realizado.

## Idea central

«Comercial Nova necesita crecer sin perder el control de sus ventas e inventario. Priorizamos una venta validada por el servidor y registrada mediante una operación transaccional en la base. La interfaz facilita la operación, y la separación de responsabilidades permite entender y mantener el sistema. El prototipo tiene límites que identificamos y un plan para comprobarlos».

No dedicar la mayor parte de la exposición a colores o animaciones. La interfaz demuestra facilidad de uso; la defensa técnica se apoya en recorrido de datos, integridad, responsabilidades, pruebas y decisiones.

## Presentación sugerida de diez minutos

Duración propuesta, no impuesta por el PDF. Ajustarla al tiempo del docente y repartir bloques entre los integrantes; todos deben entender el flujo de venta.

| Tiempo | Lámina o bloque | Qué decir y mostrar |
| --- | --- | --- |
| 0:00–1:00 | Problema y prioridad | Los seis síntomas combinan datos, arquitectura, UX y mantenimiento. Prioridad: evitar una venta inconsistente. No atribuir causas históricas que no se investigaron. |
| 1:00–2:15 | Diseño | Diagrama navegador → Nova → Supabase. Un solo proyecto, responsabilidades separadas. Explicar MVC/Razor Pages y dónde vive la operación de inventario. |
| 2:15–3:15 | Tecnologías | Comparar ASP.NET/Razor con React + Node/TypeScript usando la matriz. Justificar alcance, complejidad y mantenimiento, sin afirmar superioridad universal. |
| 3:15–6:45 | Demostración | Buscar, preparar pedido, validar, caso inválido y registro válido con datos de prueba. Mostrar qué se envía y quién decide precios y stock. |
| 6:45–8:00 | Pruebas e integridad | Explicar transacción, concurrencia e idempotencia con ejemplos distintos. Indicar cuáles pruebas fueron simuladas y cuáles reales se alcanzaron a ejecutar. |
| 8:00–9:00 | UX, mantenimiento y móvil | Modal reutilizable, estados de carga/error, responsive y documentación para otro equipo. Nuestra historia es contenido ficticio complementario. |
| 9:00–10:00 | Límites y continuidad | Edición concurrente sin versión, prueba de veinte ventas pendiente, pruebas versionadas y despliegue reproducible. Cerrar con lo que el prototipo sí demuestra y las condiciones para evolucionar. |

## Demostración preparada

### Preparación previa

Usar un administrador y un vendedor de prueba activos, un producto de prueba identificable y existencias conocidas. No usar ventas reales para ensayar. Registrar el stock inicial consultado; no fijar valores de producción en las láminas.

Verificar antes de presentar: configuración local de Supabase, conexión, permisos, disponibilidad del producto y sesión. El alta de vendedores puede permanecer bloqueada sin Auth Admin; no depender de ella para iniciar la demo. La sesión avisa a los dos minutos sin interacción y termina a los tres: responder al aviso durante explicaciones largas. Consultar [Sesión](Sesion.md).

Desde PowerShell, detener una instancia anterior antes de limpiar y arrancar:

```powershell
.\iniciar.cmd
```

Alternativa sin limpieza:

```powershell
dotnet run --project Nova.csproj
```

Abrir `http://localhost:5180`. Preparar capturas propias como respaldo, indicando su fecha y si proceden de un entorno simulado. Ocultar datos personales y credenciales. Si falla la conexión, explicar la limitación y usar evidencia previamente obtenida; no presentar una simulación como conexión real.

### Recorrido y resultado esperado

| Paso | Acción | Qué demuestra / evidencia a guardar |
| --- | --- | --- |
| 1 | Entrar como vendedor y abrir Ventas. Buscar por nombre o SKU. | Catálogo y estados de carga; respuesta de `GET /api/ventas/productos` sin credenciales visibles. |
| 2 | Agregar una cantidad permitida y pulsar Validar pedido. | El servidor devuelve cantidades, precios e importes; validar no reserva ni descuenta stock. |
| 3 | Mostrar un caso inválido sin escritura: mediante Postman enviar a `/api/ventas/validar` una cantidad superior al stock conocido. Usar la cookie y antifalsificación locales según la colección. | Esperado: 409 con errores de stock. También puede mostrarse 400 con cantidad cero. El control de la UI no debe usarse como única prueba de validación. |
| 4 | Regresar al pedido válido, validar y confirmar una sola vez con datos de prueba. | Esperado: ID de venta y total confirmado. Verificar stock posterior y trazabilidad con cuenta admin; cantidades y movimiento deben corresponder a la venta. |
| 5 | Explicar cómo se recupera una respuesta incierta. Si se ensayó previamente, repetir el pedido exacto con su UUID en el entorno de prueba. | Esperado del RPC: misma venta y `replayed:true`, sin otro descuento. No generar otro UUID ni improvisar una desconexión durante la defensa. |
| 6 | Mostrar Productos en ancho de teléfono y abrir un diálogo. | Adaptación del layout y acciones disponibles sin hover. Registrar si la comprobación fue con navegador real o solo revisión de CSS. |

Una venta de prueba confirmada sí modifica el entorno de prueba. No borrar movimientos ni restaurar stock con PATCH directo; cualquier ajuste posterior debe usar el flujo autorizado y conservar el motivo.

### Cómo explicar el código sin leer archivos enteros

- [VentaDto.cs](../Dtos/VentaDto.cs): cantidades positivas, de 1 a 100 artículos y productos no duplicados. `RegistrarVentaInput` añade el UUID al contrato de validación.
- [VentasController.cs](../Controllers/VentasController.cs): rutas, sesión, antifalsificación y traducción de conflictos a respuestas comprensibles.
- [SupabaseVentasService.cs](../Infrastructure/SupabaseVentasService.cs): consulta de precios/stock y envío de IDs/cantidades al RPC. `RegistrarAsync` no prevalida reintentos: una operación ya confirmada debe poder recuperarse aunque haya agotado el stock.
- [ventas.js](../wwwroot/js/ventas.js): carrito, pedido pendiente y UUID en `sessionStorage`, bloqueo de doble envío y recuperación manual.
- [SupabaseCatalogoService.cs](../Infrastructure/SupabaseCatalogoService.cs): edición sin stock/SKU y sin control de versión. Usarlo para explicar con honestidad la mejora pendiente.

## Respuestas a las cuatro preguntas del PDF

### 1. ¿Qué ocurre si veinte vendedores intentan vender la última unidad?

«La disponibilidad que ve la pantalla puede quedar desactualizada. Validar antes de vender mejora la experiencia, pero la decisión final debe ser atómica en PostgreSQL. Nova envía la venta al RPC `register_sale`, cuyo contrato documenta verificación de existencias y registro transaccional. Para demostrar veinte vendedores necesitamos ejecutar solicitudes con UUID distintos sobre una unidad de prueba: esperamos una venta aceptada, diecinueve rechazos de stock y stock final cero. Esa prueba concurrente real está pendiente según la evidencia actual».

Explicación adicional si la piden: dos vendedores representan **dos operaciones distintas**; no deben compartir UUID. El bloqueo para un UUID evita duplicar reintentos, pero no prueba por sí mismo la exclusión entre pedidos distintos. Antes de garantizar el resultado concurrente hay que verificar el mecanismo de actualización/bloqueo de productos y los resultados reales.

Plan del ensayo, aún no ejecutado: preparar stock 1 por ajustes autorizados; sincronizar veinte solicitudes de cantidad 1 con identidad y UUID válidos; registrar respuestas; consultar stock y filas de venta, detalle y movimiento. Si hay dos ventas aceptadas, stock negativo o inconsistencias, el criterio falla. Una prueba secuencial o un mock que devuelve 409 no demuestra concurrencia real.

### 2. ¿Por qué MVC y qué pasaría sin utilizarlo?

«Permite separar la presentación de la recepción de solicitudes y de los datos/operaciones. En Nova combinamos MVC y Razor Pages: vistas y páginas muestran la interfaz, los controladores locales validan solicitudes y los servicios encapsulan llamadas a Supabase. Esta organización ayuda a localizar cambios y entender el código».

«Sin MVC también podríamos organizar bien el sistema con otro patrón. El riesgo es mezclar HTML, HTTP, permisos y acceso a datos en un solo lugar; evitar esa mezcla es la decisión importante. MVC por sí solo no impide sobreventas ni reemplaza pruebas».

### 3. ¿Qué mantienen si el presupuesto se reduce a la mitad?

«Conservaríamos autenticación, permisos, productos, venta, integridad de inventario y evidencia de pruebas. Mantendríamos un solo proyecto web y una base central; reduciríamos primero animaciones, contenido editorial, imágenes pesadas y funciones accesorias. Pospondríamos reportes avanzados y una aplicación móvil nativa».

El presupuesto no está cuantificado en el caso. No prometer ahorro de 50 % ni gratuidad permanente: habría que medir usuarios, almacenamiento, tráfico y operación, y consultar cuotas vigentes. Autoalojar también tiene costo de mantenimiento. No eliminar autorización o controles de stock para ahorrar.

### 4. ¿Qué se reutiliza al incorporar una aplicación móvil?

«La web responsive ya permite adaptar la consulta al navegador móvil. Para un cliente nativo podríamos reutilizar datos, reglas transaccionales, permisos y los conceptos de contratos de la API. La UI nativa tendría que desarrollarse; el HTML Razor no se convierte automáticamente en pantallas nativas».

Las API locales actuales usan cookie y antifalsificación. Un cliente separado requiere diseñar y probar su autenticación, autorización y manejo de sesión; no basta con copiar el JavaScript ni exponer una clave administrativa. Offline y sincronización son trabajo adicional.

## Otras preguntas probables

| Pregunta | Respuesta defendible |
| --- | --- |
| ¿Dos administradores pueden sobrescribir el precio? | Sí, hoy el PATCH filtra por ID y no verifica versión. Se propone control optimista con conflicto visible. El editor no permite cambiar stock; eso no resuelve la concurrencia de campos comerciales. |
| ¿Por qué no tomar el total del navegador? | El cliente puede manipularlo. El servidor consulta precios y el RPC determina el total definitivo. La validación previa puede quedar desactualizada. |
| ¿Qué pasa si falla la red después de guardar? | El resultado puede ser incierto. Se conserva pedido/UUID y se reintenta exactamente la operación para recuperar su resultado. No hay reintentos automáticos de escritura. |
| ¿Supabase es todo el backend? | Es el servicio de datos, Auth y Storage. Nova tiene su propio backend ASP.NET: sesión, antifalsificación, DTO, controladores y adaptación HTTP. |
| ¿Se implementó CRUD de clientes? | La venta consulta clientes existentes y admite consumidor final. No hay una pantalla completa de administración de clientes en el alcance actual. |
| ¿Ya probaron todo? | Hay comprobaciones históricas simuladas documentadas por módulo. Quedan sesión/escrituras reales, concurrencia y revisión visual; no hay una suite de pruebas versionada. Mostrar solo evidencias realmente obtenidas. |
| ¿Dónde está el servidor de datos al clonar GitHub? | El código web no recrea por sí solo el proyecto remoto. Requiere configuración y objetos SQL/permisos existentes; falta completar un procedimiento reproducible de aprovisionamiento. |
| ¿El comprobante es una factura? | Es confirmación del registro de venta; no integra facturación fiscal ni cobro bancario. |

## Registro de evidencias para completar antes de exponer

No sustituir los pendientes por capturas ficticias. Completar cada fila solo después de realizar la prueba; guardar archivos sin secretos en una carpeta de evidencias acordada para la entrega.

| ID | Evidencia requerida | Estado al 2026-11-26 |
| --- | --- | --- |
| E1 | Venta válida: stock inicial/final, petición saneada, ID, detalle y movimiento | Pendiente de ensayo real para la sustentación. |
| E2 | Venta inválida: cantidad superior a stock, 409, ausencia de escrituras | Hay pruebas simuladas históricas; pendiente evidencia real. |
| E3 | Repetición de UUID y cuerpo: mismo ID, `replayed:true`, sin duplicado | Contrato/pruebas simuladas documentados; ensayo real pendiente. |
| E4 | Veinte ventas distintas con última unidad | Pendiente. |
| E5 | UI desktop/teléfono: búsqueda, diálogo, carrito y mensajes | CSS/Razor revisados; inspección visual real pendiente. |
| E6 | Arranque desde checkout limpio con configuración documentada | Pendiente. |

## Preparación para GitHub

Esta documentación queda preparada en el árbol de trabajo; **no se hizo commit ni push**. No hay APIs nuevas o modificadas en esta revisión, por lo que no se alteró Postman por esta tarea. La colección ya tiene cambios anteriores que deben revisarse junto con su implementación.

Antes de publicar: revisar los cambios propios y previos con `git status` y `git diff`; comprobar que archivos nuevos requeridos estén incluidos, que la configuración local permanezca ignorada y que no se incorporen evidencias con credenciales. Comprobar la colección JSON y los enlaces. La comprobación de archivos actuales no certifica que todo el historial de Git esté libre de secretos.

La propuesta de exposición puede prepararse ahora; la afirmación de que el prototipo superó concurrencia real debe esperar a E4. No hace falta agregar módulos accesorios para responder al mínimo del caso: sí hace falta mostrar con claridad diagnóstico, decisiones, operación válida/inválida y límites.
