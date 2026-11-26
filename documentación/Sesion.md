# Navegación, cuenta y tiempos de sesión

Actualizado: 2026-11-26.

## Tiempos acordados

| Control | Tiempo y comportamiento |
| --- | --- |
| Aviso de inactividad | A los 120 segundos sin interacción se abre **¿Aún sigues allí?**, con ícono SVG animado y cuenta regresiva. |
| Cierre por inactividad | A los 180 segundos sin respuesta se envía el cierre de sesión. Se acordó un minuto de margen después del aviso. |
| Continuar | **Sí, continuar** solicita actividad al servidor. Solo si se confirma, cierra el modal y comienza un nuevo período de inactividad. Escape no descarta este aviso. |
| Máximo absoluto de Nova | 60 minutos desde login, o hasta `expires_at` del token si vence antes. La actividad no amplía ese límite. |
| JWT de Supabase | Su duración real proviene de `expires_in` y `expires_at` en la respuesta de login. Se muestra en Mi cuenta; no se asumió ni modificó la configuración remota del proyecto. |

Supabase documenta una expiración predeterminada habitual de una hora, configurable por proyecto. Esto no confirma el valor configurado en este proyecto. Nova no implementa renovación con refresh token. [Sesiones y expiración oficiales](https://supabase.com/docs/guides/auth/sessions).

`Infrastructure/NovaSessionPolicy.cs` centraliza 120/180 segundos y 60 minutos. Login registra última actividad, vencimiento real del token y expiración absoluta en propiedades de la cookie cifrada; no los obtiene de parámetros controlados por el navegador. `OnValidatePrincipal` rechaza la cookie en solicitudes posteriores si ya pasaron 180 segundos o venció el plazo absoluto. Las cookies anteriores sin estos datos se rechazan: volver a iniciar sesión después de actualizar.

**Recordarme** mantiene la cookie al cerrar el navegador, pero no evita estos vencimientos. El cierre elimina la cookie de Nova; no cambia la configuración de Supabase ni revoca por sí mismo un JWT ya emitido. El navegador nunca recibe el token en estas APIs de sesión.

## Actividad y varias pestañas

`session.js` observa interacción real: teclado, puntero y scroll. Reporta actividad como máximo cada 15 segundos durante interacción continua y una vez al terminar, con debounce de un segundo. Las consultas automáticas, polling o la cuenta regresiva no mantienen viva la sesión. Una vez visible el aviso, mover el mouse no lo confirma: se necesita el botón.

Se usa reloj del servidor para los metadatos y se revisan los plazos al recuperar foco/visibilidad. Pestañas del mismo usuario comunican actividad y cierre mediante BroadcastChannel cuando está disponible; el servidor sigue siendo la autoridad aunque el JavaScript esté suspendido. No se guarda JWT ni credenciales en almacenamiento web.

El aviso puede superponerse a otro diálogo sin destruir su formulario. El cierre no elimina `sessionStorage` de recuperación de ventas: si un registro quedó incierto, volver a entrar con el mismo usuario y recuperar el mismo UUID, sin registrar de nuevo con otro identificador.

## Perfil y endpoints

Al pulsar el correo/avatar se abre **Mi cuenta**, con nombre, apellido, correo, rol, tiempo restante y duración emitida del token. Nombres/rol se consultan desde el perfil propio activo de `public.profiles`, usando JWT de usuario. El correo corresponde a la identidad de la sesión. El panel permite cerrar sesión con el POST existente `/Login/Salir` y antifalsificación.

| Método | Ruta | Funcionamiento |
| --- | --- | --- |
| GET | `/api/sesion` | Cookie válida. Consulta perfil propio activo y devuelve `nombre,apellido,email,rol,venceEn,tokenVenceEn,tokenDuracionSegundos,ultimaActividad,ahora,avisoSegundos,inactividadSegundos,maximoMinutos`. Timestamps Unix en segundos. No registra actividad ni devuelve JWT. |
| POST | `/api/sesion/actividad` | Cookie válida y `RequestVerificationToken` del layout autenticado. Sin cuerpo. Actualiza solo última actividad y reemite cookie conservando vencimiento absoluto y token. Devuelve `ultimaActividad,venceEn,ahora`. No recupera una sesión ya vencida. |

Errores: 400 antifalsificación en POST; 401 sesión vencida/ausente; 403 perfil no activo en GET; 502/503 si falla la consulta de Supabase. Las páginas protegidas redirigen al login ante sesión inválida. Ejemplos en **Nova local — sesión** de Postman. No se crearon tablas ni se modificaron políticas o tiempos remotos de Auth.

## Sidebar y accesibilidad

En escritorio, el botón junto al título muestra/oculta toda la barra lateral con transición suave. El borde derecho ajusta su ancho por arrastre entre 200 y 340 px; flechas, Home y End permiten hacerlo con teclado, y doble clic restaura 216 px. Se interpreta “arrastrable” como redimensionar el sidebar, no como convertirlo en una ventana flotante.

Ancho/visibilidad se conservan en `localStorage` bajo `nova:sidebar`. Al ocultar, la navegación queda `inert` para evitar foco invisible. Hasta 900 px se mantiene el drawer móvil con foco nativo y Escape. Los íconos tienen movimiento al activar una opción, también tras cargar la página destino. Todas las animaciones respetan `prefers-reduced-motion`.

## Correcciones en vendedores

El correo de **Agregar vendedor** era readonly cuando faltaba `AuthAdminKey`. Ahora siempre es editable en alta; la ausencia de esa clave sigue impidiendo crear la cuenta y mantiene la explicación/alternativa de vinculación. En edición se conserva readonly para correo si no hay acceso administrativo de Auth. No se agregó ni expuso una clave privilegiada.

El switch usa pista fija, indicador posicionado al 50% y transformación vertical para centrarlo; cambia de estado con transición, sin depender de márgenes que lo desplacen. No cambia el contrato de alta ni sus restricciones.

## Comprobaciones

Compilación correcta. Host temporal con cookies reales de ASP.NET y Supabase simulado: expiración absoluta/por token, última actividad, rechazo de cookies antiguas, CSRF, perfil y correo editable sin Auth Admin. Pruebas JS con reloj y DOM simulados: aviso a 120 segundos, cierre a 180, continuar, vencimiento absoluto, ocultar/mostrar sidebar, límites por teclado/arrastre y persistencia. Pasaron 33 comprobaciones. Sintaxis JavaScript comprobada. Estas pruebas no sustituyen revisión visual en navegador; no se cambiaron cuentas ni configuración remota de Auth.
