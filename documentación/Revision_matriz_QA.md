# Revisión de la matriz QA

**Actualización posterior del 2026-11-27:** el Dashboard ya fue implementado con acceso administrativo, consultas reales y tour voluntario. Ver [alcance y pruebas](Dashboard.md). La brecha QA-002 queda atendida en código/SQL, pendiente reejecución visual y actualización del Excel; el análisis de la matriz que sigue conserva el estado del archivo recibido.

Fecha: 2026-11-27. Fuente: `Matriz_QA_Comercial_Nova.xlsx`, proporcionada por el usuario en la carpeta `matriz-prueba`, hojas **Matriz**, **Pantallas** y **Enunciado**. Se revisaron valores, fórmulas de resumen y definición de casos, y se contrastaron los puntos principales con código y documentación de Nova. El Excel original no se modificó ni se exportó otra versión.

Esta es una revisión de la evidencia registrada, no una nueva ejecución de los escenarios. Las observaciones en Brave se atribuyen al archivo recibido; no se presentan como sesiones de navegador realizadas durante esta revisión. Tampoco se verificaron aquí los estados remotos de Supabase o la configuración actual del proceso en ejecución.

## Resultado general

| Estado registrado | Casos | Lectura correcta |
| --- | --- | --- |
| Aprobado | 32 | 26 reportados con Brave real y seis con DOM/red simulados. Un aprobado aplica solo a su escenario, no a toda la pantalla. |
| Pendiente | 14 | Hay planificación, pero no resultado de ejecución para ese escenario. |
| Bloqueado | 2 | Alta y cambios de credenciales dependen de configuración administrativa de Auth según el registro. |
| Brecha | 2 | Dashboard sin indicadores y ausencia de control de versión en edición de producto. |
| Fallido | 0 | No hay filas con ese estado; no significa ausencia de defectos, porque existen brechas y flujos sin ejecutar. |

Los 50 IDs son únicos. Los conteos se reconciliaron contra las filas, no solo contra los valores guardados del resumen. Las fórmulas de `Matriz!B5,D5,F5,B7,D7,F7` coinciden con esos conteos. La lista de estados ya contempla **Fallido**.

La matriz separa correctamente evidencia histórica, pruebas simuladas y observaciones reportadas en navegador. La principal falta es completar operaciones con persistencia y probar condiciones concurrentes, no agregar muchos casos de apertura de pantallas.

## Qué cerrar primero en los casos existentes

| Orden | IDs / relación académica | Acción concreta | Criterio de cierre |
| --- | --- | --- | --- |
| 1 | QA-041; P1 y sección 5.4 | Registrar una venta completa con producto QA, incluyendo variante de vender exactamente todo el stock. | Evidenciar stock inicial/final, ID, total, detalle y movimiento; sin duplicados. La variante inválida debe mostrar rechazo sin escrituras. |
| 2 | QA-042 y QA-043; P1 y defensa | Cambiar existencias entre validar/confirmar y luego ensayar veinte pedidos distintos sobre la última unidad. | Rechazos de stock coherentes; una venta aceptada para una unidad, stock final cero y movimientos íntegros. UUID distintos entre ventas, mismo UUID solo en reintentos. |
| 3 | QA-044; P2 | Implementar primero control optimista de versión en base/backend/formulario. Después probar dos empleados. | Primer guardado aceptado; segundo obsoleto rechazado, borrador conservado y opción de revisar cambios. Sigue siendo brecha, no un test aprobado por tener modal. |
| 4 | QA-038 y QA-039; P1/P4 | Crear, editar, recargar y registrar una entrada de inventario sobre datos QA. | Persistencia verificada; editar campos comerciales no cambia stock; entrada produce un solo movimiento. |
| 5 | QA-046; P4 | Separar guardado de perfil, vinculación y duplicado de vinculación. | Comprobar cada resultado por separado. Editar perfil sin cambiar correo puede probarse sin Auth Admin si se administra otra cuenta autorizada. |
| 6 | QA-021 y QA-022 | Resolver configuración administrativa cuando corresponda y ejecutar altas/cambios autorizados. | Cuenta y perfil consistentes. No confundir falta de configuración con pantalla inexistente. |
| 7 | QA-035, QA-045 y QA-047; P3 | Login inválido, permisos por rol/inactivo y sesión cronometrada. | Rechazos observables, sin sesión indebida; aviso a 120 s, continuación correcta y cierre a 180 s sin respuesta. |
| 8 | QA-036, QA-037, QA-040, QA-049 y QA-050; P3/P4/P5/P6 | Completar filtros/paginación, carga real de archivos por rol, móvil y arranque limpio. | Evidencias por entorno y revisión, con resultados recuperables y sin dependencia de conocimiento verbal del equipo. |

No es necesario volver a crear esos casos con otros IDs: faltan ejecuciones y, en QA-044, implementación. Ninguna de estas operaciones se ejecutó como parte de esta revisión documental.

## Casos adicionales que sí aportan cobertura

Propuesta para ampliar la matriz a partir de QA-051. Todos empiezan como **Pendiente**. La evidencia SQL/simulada histórica puede enlazarse como antecedente sin aprobar automáticamente su equivalente real.

| ID propuesto | Escenario adicional | Resultado esperado | Enunciado |
| --- | --- | --- | --- |
| QA-051 | La venta se guarda pero se pierde la respuesta; reintentar el mismo cuerpo y UUID, incluida recarga de la pestaña. | Recupera el mismo ID sin otro descuento. No prevalida stock ya descontado. | P1/P3 |
| QA-052 | Reutilizar UUID con otro cliente o cantidades. | 409 de conflicto; no crea otra venta ni cambia la anterior. | P1 |
| QA-053 | Pedido con dos productos: primera línea disponible y segunda agotada. | Se revierte todo: tampoco queda descontada la primera línea ni una venta parcial. | P1 |
| QA-054 | Enviar precios, total o identidad de vendedor manipulados desde un cliente de prueba. | Se usan precios de base e identidad autenticada; no se acepta un total ni vendedor arbitrario del navegador. | P1/P3 |
| QA-055 | Omitir cantidades, enviar cero, negativo, decimal o productos duplicados directamente a las API de venta. | Rechazo de entrada sin escritura, incluso al saltarse las validaciones HTML. | P1/P3 |
| QA-056 | Crear un producto con SKU ya registrado. | Conflicto comprensible, ningún duplicado y formulario conservado para corregir. | P3/P4 |
| QA-057 | Doble clic o clics repetidos al confirmar con red lenta. | Controles bloqueados durante envío y una sola operación; no se generan nuevas ventas por cada clic. | P1/P4 |
| QA-058 | Fallo de catálogo, selectores o KPI, seguido de reintento. | Diferencia ausencia de datos de cero real; sale del estado de carga y permite recuperarse sin inventar resultados. | P3/P4 |
| QA-059 | Recorrer modales con teclado, cerrarlos y revisar el foco. | Etiquetas y errores accesibles, foco contenido y recuperado; Escape respeta el estado de guardado. | P4/P6 |
| QA-060 | Cerrar sesión y usar Atrás, abrir una ruta protegida y consultar una API. | No recupera acceso protegido ni permite escribir. El estado visible debe reflejar que hace falta autenticarse. | P3 |

Ampliar también QA-040 con vendedor sin permiso de carga, archivo válido, tamaño límite/superior, extensión/MIME incompatibles y fallo después de subir pero antes de guardar el producto. Ampliar QA-047 con vencimiento absoluto, regreso tras suspender la pestaña y actividad entre dos pestañas. Registrar cada variante con un sub-ID si necesita resultado independiente.

## Ajustes concretos a la matriz

1. **Evitar que el resumen deje de contar filas nuevas.** Las fórmulas y la validación de estados terminan en la fila 60: `A11:A60`, `H11:H60` e `I11:I60`. Si se agregan QA-051 en adelante debajo de esa fila, ampliar rangos y validaciones o convertir los casos en tabla de Excel con referencias que crezcan. Verificar también que nuevas filas mantengan formato/filtros.
2. **Agregar un contador de Fallidos.** El desplegable lo permite, pero el resumen solo muestra aprobados, pendientes, bloqueados, brechas y aprobados simulados. Al aparecer un fallido, debe seguir reconciliando el total. Los simulados son un subconjunto de aprobados, no otra categoría para sumar al total.
3. **Agregar responsable, fecha de ejecución y revisión Git/build.** La fuente actual indica día/navegador, pero no permite identificar con precisión qué código se probó. Un resultado anterior no aprueba automáticamente una versión nueva.
4. **Separar severidad de prioridad e incorporar ID de incidencia.** Prioridad define el orden de trabajo; severidad describe el impacto. Vincular cada brecha/fallo/bloqueo con causa, responsable, corrección y resultado de reejecución.
5. **Enlazar evidencia concreta.** La columna K suele indicar «Observación directa» o «Plan QA». Añadir captura, video o petición/respuesta saneada con nombre estable. No incluir contraseñas, JWT, cookies ni claves privilegiadas. Guardar datos iniciales y resultado final en los casos con escritura.
6. **Separar aviso correcto y operación bloqueada.** En QA-021 el esperado dice explicar la dependencia y el resultado confirma el aviso; esa comprobación visual puede aprobarse. El cambio real de credenciales debe seguir como otro caso bloqueado. Así no se mezclan dos objetivos en un solo estado.
7. **Dividir escenarios amplios.** QA-038 agrupa crear/editar; QA-046 agrupa guardar perfil/vincular. Un resultado de una parte no permite cerrar el conjunto. Usar subcasos y un criterio de cierre del grupo.
8. **Distinguir vista y protocolo.** QA-048 ya dice que no se inspeccionó HTTP: conservar el aprobado visual, y añadir la comprobación técnica de respuesta 404. Una pantalla con texto de error también podría responder 200 si se configura mal.
9. **Registrar tamaño del viewport y dispositivo.** QA-026–028 prueban ventana estrecha, no teléfono físico ni flujo completo. Conservar esa evidencia y completar QA-049, incluyendo teclado virtual, carrito, diálogos y toasts.
10. **Usar IDs exactos en trazabilidad.** En la hoja Enunciado, referenciar QA-044 explícitamente para P2 y asignar un caso verificable para incorporación documental de P5, conectado a QA-050.

## Qué funcionalidades agregar ahora

### Prioridad por relación con el profesor

1. **Control de edición simultánea de producto.** Es la brecha funcional más directa respecto a P2. Requiere operación condicional atómica, versión esperada y experiencia de conflicto; no se resuelve creando solo otra pantalla.
2. **Pruebas de regresión reproducibles y configuración de ambientes.** Cierra parte de P3/P5. Fijar revisión, prerrequisitos y pasos de arranque; ampliar las pruebas existentes. Esta revisión no crea ambientes ni CI.
3. **Completar la evidencia de venta real y concurrente.** Aprovecha el flujo existente para responder P1 y la sección 5.4 antes de añadir módulos accesorios.

### Pantallas y alcance de producto

| Elemento | Estado / decisión sugerida |
| --- | --- |
| Dashboard | Incompleto. Implementar indicadores reales con estados de carga/error si se conserva ese nombre; tiene menor prioridad académica que P2. |
| Editar vendedor | Existe. Falta comprobar guardado de perfil y habilitar/probar credenciales donde corresponda; no construirlo desde cero. |
| Historial general y detalle de ventas | Es la siguiente pantalla más útil para consultar una venta, recuperar su ID y facilitar auditoría. Actualmente hay confirmación, trazabilidad y comprobantes por vendedor; no un módulo general. |
| Clientes | Solo búsqueda/selección en venta. Lista, alta y edición son ampliación del alcance empresarial, no un requisito explícito de pantalla del enunciado. |
| Marcas/categorías y movimientos globales | Opcionales para administración completa; ya existen selectores y trazabilidad por producto. |
| Móvil | Completar adaptación/verificación de lo existente. La aplicación nativa no es necesaria para el alcance actual. |

Para la próxima iteración elegiría **concurrencia optimista + cerrar QA-041/042**, y después el historial de ventas. Un Dashboard atractivo sin estos controles no aporta la misma evidencia de solución a los problemas críticos.

## Comprobaciones de esta revisión

- Leídas las tres hojas y reconciliadas las 50 filas y sus estados; sin IDs duplicados.
- Inspeccionadas las seis fórmulas de resumen y el rango/lista de validación.
- Contrastados Dashboard, PATCH de productos y edición de vendedor con código: bienvenida simple, filtro comercial solo por ID y ficha/guardado de perfil existentes.
- No se ejecutaron nuevas pruebas funcionales, SQL, navegador, compilación, escrituras de negocio ni cambios de API. No hay cambios nuevos de Postman por esta revisión.
- No se modificó el Excel original. Las recomendaciones de nuevos casos siguen siendo propuestas, no resultados ejecutados.
