# Nova

## Nueva venta

La opción **Ventas** abre `/Ventas`: catálogo con búsqueda por nombre/SKU, categorías, skeletons por tarjeta, carrito y cliente opcional. Primero **Validar pedido** consulta precios y stock reales; después **Confirmar venta** usa el RPC transaccional existente. Las operaciones sin respuesta conservan su UUID para recuperarse sin duplicar la venta. La barra lateral usa un drawer en móvil y el resumen se adapta a pantallas pequeñas.

[Documentación de ventas](documentación/Ventas.md) y carpeta **Nova local — ventas** en [Postman](documentación/Comercial_Nova.postman_collection.json). No se implementó aún historial de ventas, cobro bancario, factura fiscal ni simulador.

## Editar productos

Cada fila del catálogo ofrece íconos de **Ver detalles** y **Editar producto**. Con mouse o teclado aparecen desde la derecha; en móvil permanecen visibles y las filas se adaptan a tarjetas. La edición reutiliza el modal del alta, carga los valores actuales y guarda mediante `PATCH /api/productos/{id}`. SKU y stock permanecen de solo lectura. Permite previsualizar y quitar la referencia de imagen, sin eliminar archivos remotos.

Contrato, validaciones y errores: [documentación de productos](documentación/Productos.md). Cada API local y el flujo de sesión/antifalsificación están documentados en la [colección Postman](documentación/Comercial_Nova.postman_collection.json). La carga de imágenes ya está integrada con el bucket público `product-images`, hasta 5 MB en JPEG/PNG/WebP y solo por administradores activos. Consultar [Storage, configuración, beneficios y costos](documentación/Storage.md).

## Nuevo producto y modal reutilizable

En `/Productos`, **Nuevo producto** abre un formulario modal con la paleta azul y tipografía Inter del proyecto. Permite registrar nombre, SKU (manual o generado), categoría y marca activas, estado comercial, descripción opcional, archivo de imagen o URL HTTPS, precio y stock mínimo. El stock inicial es cero; las entradas se registran mediante ajustes de inventario. El archivo se sube al guardar mediante `POST /api/productos/imagen`; si falla la carga no se guarda el producto. Las mismas opciones están disponibles en edición.

`POST /api/productos` requiere sesión y token antifalsificación; el servidor envía `POST /rest/v1/products?select=id` con `Prefer: return=representation`, clave publicable y JWT del usuario. RLS exige un administrador activo. No se envía `stock`; se respeta su valor predeterminado. El formulario conserva los datos ante errores, identifica SKU duplicado y permisos insuficientes, y actualiza listado e indicadores al confirmar la creación. Los reintentos de una escritura no son automáticos.

El componente compartido está en `Views/Shared/_Modal.cshtml`, configurado con `Models/ModalOptions.cs`. Recibe ID, título, descripción, parcial de contenido y, opcionalmente, ID de formulario y texto de envío. Incluir `modal.css` y `modal.js`; usar `data-modal-open="ID"` para abrir y `data-modal-close` para cerrar. El diálogo nativo gestiona foco y Escape. `data-busy="true"` bloquea el cierre durante una operación. El formulario de producto vive en `Pages/Shared/_ProductoFormulario.cshtml`, con estilos y lógica propios.

Validación del 2026-11-25: compilación y 14 comprobaciones HTTP en un host temporal con autenticación y Supabase simulados (creación, contrato saliente, CSRF, autorización, campos inválidos, duplicado y permisos); render Razor y sintaxis JavaScript comprobados. No se insertaron productos en Supabase. Revisión visual en navegador y prueba de escritura con una sesión real pendientes.

## Catálogo de productos

La pantalla `/Productos` está disponible desde el sidebar después del login. Conserva el layout compartido, la tipografía Inter y la paleta azul. Ofrece búsqueda por nombre o SKU, filtros por marca, categoría y estado, paginación, actualización manual y detalle en un diálogo accesible. Las opciones de marca y categoría se consultan en Supabase. No se incluyen productos ni indicadores de demostración en la pantalla.

Los controladores usan la clave publicable configurada y el token de la sesión web para respetar los permisos RLS. Las respuestas del catálogo no se almacenan en caché. No guardes el correo, la contraseña ni tokens en archivos del repositorio.

| Ruta local (GET, requiere sesión) | Consulta de Supabase |
| --- | --- |
| `/api/productos?buscar=&marca=&categoria=&estado=&pagina=1&tamano=10` | `products?select=*,brands(id,name),categories(id,name)`; filtros por marca, categoría y búsqueda por nombre/SKU. |
| `/api/productos/kpi` | Productos activos, clasificados usando `stock` y `minimum_stock`. |
| `/api/productos/filtros` | Tablas `brands` y `categories`. |
| `/api/productos/{id}` | `products?id=eq.{id}&select=*,brands(id,name),categories(id,name)`. |

Los KPI son globales y no cambian con los filtros: total de productos activos, disponibles (`stock > minimum_stock`), stock bajo (`0 < stock <= minimum_stock`) y agotados (`stock = 0`). Los inactivos se pueden consultar en la tabla pero no forman parte de esos indicadores. La colección Postman no documenta un RPC específico para estos cuatro indicadores; se calculan en el servidor con filas reales de `products`. El RPC de dashboard puede contar stock bajo de otra forma y no se mezcla con estos resultados.

El servicio recorre todas las páginas de Supabase para no truncar los indicadores. El estado se filtra en C# porque depende de la comparación entre dos columnas. La tabla pagina el resultado en el servidor de Nova. Para catálogos grandes conviene implementar un RPC paginado que devuelva el estado calculado y sus conteos en una única consulta.

`image_path` se muestra cuando es una URL HTTPS o una ruta local absoluta. Si falta o falla se usa un ícono, sin inventar fotografías. La colección no especifica el bucket ni un endpoint para resolver rutas relativas de Storage o firmar imágenes privadas. El formulario de alta admite `description`, verificado en el esquema; el diálogo de detalle actual todavía no presenta ese campo.

La pantalla muestra estados de carga, ausencia de coincidencias y errores recuperables. Los indicadores fallidos muestran `—`, nunca ceros inventados. Una sesión vencida solicita iniciar sesión otra vez.

Prototipo universitario para un comercio de tecnología. El proyecto usa C# y ASP.NET Core 10 con MVC, HTML, CSS y JavaScript. La pantalla inicial solicita el inicio de sesión y, con una sesión válida, muestra **Bienvenidos**.

## Ejecutar en local

Instala el SDK de .NET 10 y abre una terminal en la carpeta del proyecto. Ejecuta:

```powershell
dotnet run --project Nova.csproj
```

Abre [http://localhost:5180](http://localhost:5180) para iniciar sesión. Para ver la pantalla de ruta inexistente, abre [http://localhost:5180/404](http://localhost:5180/404). Para detener el servidor, presiona `Ctrl+C`.

## Estructura

| Ubicación | Función |
| --- | --- |
| `Program.cs` | Registra MVC, las opciones de Supabase y el cliente HTTP mediante inyección de dependencias. |
| `Models/Producto.cs` | Contrato de Supabase y clasificación del estado de stock. |
| `Dtos/ProductoDto.cs` | Contratos del catálogo, detalle e indicadores de inventario. |
| `Controllers/LoginController.cs` | Presenta el formulario, valida la solicitud y crea la sesión web. |
| `Infrastructure/SupabaseAuthService.cs` | Cliente HTTP de Supabase Auth, registrado por inyección de dependencias. |
| `Dtos/SupabaseLoginDto.cs` | Contrato del correo, la contraseña y los datos de sesión que usa Nova. |
| `Views/Shared/_ToastStack.cshtml` | Notificaciones apilables con variantes `Success`, `Information`, `Error` y `Warning`. |
| `Pages/NotFound.cshtml` | Pantalla que se muestra cuando la dirección no existe. Conserva el estado HTTP 404. |
| `Pages/`, `Views/` y `wwwroot/` | Pantallas de bienvenida y login, con sus recursos. |

## Configurar el login de Supabase

Usa la URL del proyecto y su clave publicable. En desarrollo puedes guardarlas en `appsettings.Local.json`, excluido de Git y de la publicación. Las variables de entorno tienen prioridad y también sirven fuera de desarrollo:

```powershell
$env:Supabase__ProjectUrl = 'https://TU-PROYECTO.supabase.co'
$env:Supabase__PublishableKey = 'sb_publishable_TU_CLAVE'
dotnet run --project Nova.csproj
```

El controlador envía `email` y `password` a `POST /auth/v1/token?grant_type=password`. Si Supabase devuelve HTTP 200 con una sesión válida, Nova crea una cookie de autenticación cifrada y `HttpOnly`, redirige a la bienvenida y muestra el toast de éxito. **Recordarme en este equipo** conserva la cookie al cerrar el navegador hasta el vencimiento indicado por Supabase. El prototipo solicita un nuevo login al vencer el token. Si Supabase rechaza la solicitud o no está disponible, el formulario muestra el toast de error. [Documentación de Supabase Auth](https://supabase.com/docs/guides/auth/passwords)

El cliente HTTP nombrado `Supabase` queda disponible para futuras solicitudes a la Data API bajo `/rest/v1/`. Los servicios podrán enviar el token de acceso del usuario en `Authorization` y aplicar los permisos y políticas RLS correspondientes. [Data API de Supabase](https://supabase.com/docs/guides/api)

## Notificaciones

Cada toast dura seis segundos por defecto y se puede cerrar con la ×. La barra y el temporizador se pausan mientras el puntero o el foco estén en la notificación. Para mostrar un toast desde JavaScript en una página que use `_ToastStack`, llama a `NovaToasts.show({ status: "information", title: "Título", message: "Mensaje" })`. Usa `durationSeconds` para ajustar la duración de un aviso.

## Publicar en GitHub

Crea un repositorio vacío llamado `proyecto-comercial-nova`, sin agregar un README desde GitHub, y conecta el repositorio local:

```powershell
git remote add origin https://github.com/TU-USUARIO/proyecto-comercial-nova.git
git push -u origin main
```

Para subir cambios posteriores, agrega los archivos que correspondan con `git add`, guarda el cambio con `git commit` y ejecuta `git push`. Consulta la [guía de GitHub para subir código local](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).
