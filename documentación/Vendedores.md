# Vendedores y acceso comercial

`/Vendedores` usa el layout compartido de Nova. El directorio muestra perfiles administrativos y de venta, el correo actual de Supabase Auth, el estado y el número e importe acumulado de sus ventas completadas. Desde el listado se accede a `/Vendedores/Nuevo` y `/Vendedores/Editar/{id}`. Las fichas permiten seleccionar el rol y estado, gestionar credenciales y consultar el desglose de ventas completadas.

## Alta y edición desde Nova

Configura una clave de Supabase Auth administrativa `sb_secret_…` en la variable de servidor `Supabase__AuthAdminKey` o en `Supabase:AuthAdminKey` dentro de `appsettings.Local.json` excluido de Git. La clave se usa exclusivamente para llamadas a `/auth/v1/admin/users`. El registro y edición del perfil comercial y la lectura de ventas siguen usando el JWT del administrador y las reglas de la Data API. [Claves de Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

En **Agregar vendedor**, indica nombre, apellido, correo institucional, rol y estado. La contraseña inicial y su confirmación deben coincidir, tener al menos ocho caracteres y un número y ocupar como máximo 72 bytes. Nova confirma el correo proporcionado en el alta administrativa. El usuario entra por `/Login` con esas credenciales si el perfil está activo.

**Editar vendedor** permite actualizar el correo y el perfil y asignar una contraseña nueva en un formulario independiente. La contraseña vigente nunca se lee ni se muestra. Un administrador puede gestionar otras cuentas, incluida la promoción o degradación de otro perfil, y necesita otro administrador para gestionar su propia cuenta. Los cambios de rol aparecen en la navegación del usuario cuando inicia sesión de nuevo.

El alta usa el mismo UUID de operación para Auth y perfil. Si se interrumpe, reenvía los mismos datos desde la misma ficha. Si Auth ya creó la cuenta, conserva la contraseña del primer envío al completar el perfil. En edición, Nova guarda un correo distinto antes de guardar el perfil. Si se interrumpe entre ambos pasos, vuelve a aplicar los cambios desde la ficha. Las reglas del perfil y la migración de apoyo están en [vendedores_alta.sql](vendedores_alta.sql).

## Habilitar un vendedor

1. En **Supabase → Authentication → Users**, crea una cuenta de correo y contraseña para el vendedor. Confirma el correo según el flujo del proyecto y copia el **User UID** de la cuenta.
2. En Nova, inicia sesión como administrador. En **Vendedores → Vincular cuenta existente**, pega el UUID e ingresa nombre y apellido. **Vincular vendedor** crea el perfil activo con rol `seller`. Esta alternativa funciona con la clave publicable existente.
3. El vendedor entra por **/Login** con el correo y contraseña de esa cuenta y registra sus operaciones en **Ventas**. La cuenta de Auth y su perfil comparten el UUID que se guarda como vendedor en la venta. Usa **Cerrar sesión** en el menú para cambiar de cuenta en el mismo navegador.

Nova comprueba el perfil activo antes de emitir la cookie y toma el rol de la tabla `profiles`. Si tenías una sesión abierta antes de esta actualización, vuelve a iniciar sesión para que la cookie incluya el rol. Desactivar un vendedor bloquea un nuevo login en Nova y los permisos operativos sujetos a RLS incluso si todavía conserva una cookie. Reactivar conserva el mismo ID y el historial. La creación de credenciales se hace en Auth. [Creación administrativa de usuarios](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

## Contrato local

Todas las rutas usan cookie `Nova.Session` y requieren un administrador activo. POST y PATCH también requieren `RequestVerificationToken` obtenido de `GET /Vendedores` con la misma sesión.

| Método y ruta | Entrada y respuesta |
| --- | --- |
| `GET /api/vendedores` | **200** `{total, activos, inactivos, items:[{id,nombre,apellido,email,role,activo,ventas,total}]}`. `email` puede ser null. Métricas de ventas completadas. |
| `POST /api/vendedores` | `{usuarioId,nombre,apellido}`, UUID válido, campos requeridos de hasta 80 caracteres cada uno. **201** `{id}`. La cuenta debe existir, tener contraseña y correo confirmado y estar libre de otro perfil. |
| `PATCH /api/vendedores/{id}` | `{nombre,apellido,activo}`, ambos nombres de hasta 80 caracteres y booleano requerido. **200** `{id}`. Solo modifica perfiles con rol `seller`. |
| `GET /api/vendedores/{id}` | **200** perfil con los campos del directorio y `propio`. **404** si no existe. |
| `GET /api/vendedores/{id}/comprobantes` | `antesDe` opcional. **200** `{siguiente,items:[{id,fecha,total}]}`, hasta 20 ventas completadas. IDs y cursor como texto. |
| `POST /api/vendedores/alta` | `{operacionId,nombre,apellido,email,rol,activo,clave,confirmacion}`. Rol `seller` o `admin`; `activo` obligatorio. **201** `{id}`. |
| `PATCH /api/vendedores/{id}/cuenta` | `{nombre,apellido,email,rol,activo}`. **200** `{id}`. |
| `POST /api/vendedores/{id}/clave` | `{clave,confirmacion}`. **204** sin cuerpo. |

Los errores son **400** validación/antifalsificación, **401** sesión, **403** rol o estado, **404** perfil no editable en PATCH, **409** cuenta no vinculable o ya vinculada en POST, **502/503** fallo de Supabase o confirmación incierta. Si se pierde la respuesta de una escritura, recarga el directorio. El UUID único impide crear el mismo perfil dos veces.

`POST /Login/Salir` usa cookie y antifalsificación del formulario. Borra la cookie de Nova y responde **302** hacia el login. Una petición sin sesión redirige a `/Login`; con token antifalsificación inválido devuelve **400**.

Nova consume `GET /rest/v1/rpc/nova_seller_directory` con orden estable y rangos, `POST /rest/v1/rpc/nova_link_seller` con `p_auth_id`, `p_first_name` y `p_last_name`, y `PATCH /rest/v1/profiles?id=eq.{id}&role=eq.seller&select=id` con `Prefer: return=representation`. Envía el JWT del administrador. Los RPC verifican el rol activo dentro de las funciones privadas y restringen el directorio a las cuentas con perfil comercial. No se solicitan ni se devuelven contraseñas.

Migración `nova_vendedores_perfiles` aplicada en Supabase el 2026-11-25. [SQL versionado](vendedores.sql). Se verificaron por SQL la lectura con administrador, la vinculación, el rechazo de duplicados, el cambio de estado y el bloqueo de vendedor en una transacción revertida al final.

Pasaron 31 comprobaciones HTTP/Razor en un host con Supabase simulado, incluidas verificación de perfil en login, cierre de sesión, antifalsificación, restricciones por rol y trazabilidad. Quedan pendientes el flujo con cuentas reales y la inspección visual.

Migración `nova_alta_cuentas_comerciales` aplicada el 2026-11-25. Se comprobó por SQL el alta, reintento, cambio de rol y estado, bloqueo de la cuenta propia y restricción para vendedores. La transacción se revirtió. Pasaron 45 comprobaciones HTTP/Razor con Auth y Data API simulados, incluidas las fichas, los comprobantes, la edición de correo y el restablecimiento. La configuración local aún necesita la clave de Auth Admin para verificar credenciales reales.
