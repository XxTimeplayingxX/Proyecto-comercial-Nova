# Imágenes de productos y Supabase Storage

Consulta: 2026-11-25. Precios en USD, sujetos a cambios; revisar la página oficial antes de contratar. Este documento separa la investigación de la integración disponible.

## Estado del proyecto

Configuración desplegada el 2026-11-25: bucket `product-images`, público, máximo 5 MiB (5.242.880 bytes), MIME `image/jpeg`, `image/png` y `image/webp`. No se cambió el plan ni se contrataron servicios. El bucket está dedicado a fotografías comerciales no confidenciales: cualquiera con su URL puede leerlas.

Creación y edición admiten seleccionar un archivo y previsualizarlo antes de subir, o conservar una URL HTTPS/ruta local absoluta segura. Al guardar, `POST /api/productos/imagen` sube el archivo y devuelve una URL pública; POST/PATCH de producto guarda esa URL en `products.image_path`. Quitar la imagen desvincula el producto (`null`), sin borrar objetos. La firma de URL privadas no es necesaria para este bucket público y no se implementó.

Políticas aplicadas en `storage.objects` (RLS continúa activo):

- `nova_product_images_admin_insert`: solo `authenticated` cuyo `nova_private.active_role()` sea `admin`, dentro de `catalogo/{auth.uid()}/` y del bucket exacto.
- `nova_product_images_admin_select`: lectura/listado de metadatos del bucket solo para administradores activos. La URL pública de una fotografía no requiere sesión.
- Sin políticas de UPDATE ni DELETE: Nova no sobrescribe ni borra archivos existentes. Un reemplazo usa UUID nuevo. Los vendedores y usuarios anónimos no tienen política de carga.

DDL aplicado: [storage_product_images.sql](storage_product_images.sql). No se cambiaron políticas de productos, perfiles o ventas, ni la función de roles existente.

## Qué ofrece y cómo se usaría

Storage almacena los archivos en buckets separados de las filas del catálogo. Permite servir imágenes mediante CDN y controlar las operaciones con políticas RLS. Un bucket público permite que cualquiera que tenga la URL lea la imagen; las escrituras siguen sujetas a permisos. Un bucket privado requiere acceso autorizado o URL firmadas con vencimiento. [Modelo de acceso oficial](https://supabase.com/docs/guides/storage/buckets/fundamentals).

La configuración elegida es lectura pública y subida por administradores. Si en el futuro se requieren documentos privados, deben ir en otro bucket privado, con sus políticas y resolución de URL; no reutilizar este bucket para documentos personales.

Flujo implementado:

1. Elegir archivo JPEG, PNG o WebP hasta 5 MB. La vista previa local usa una URL temporal del navegador, que se libera al cambiar o cerrar el flujo.
2. Al guardar, enviar multipart al backend con cookie y antifalsificación. Se comprueba tamaño, MIME y firma/estructura básica del formato; no es una decodificación completa ni un servicio antivirus. El nombre original no se usa como ruta.
3. El servidor sube mediante Storage API a `catalogo/{usuario}/{uuid}.{ext}` con JWT de usuario, clave publicable y `x-upsert:false`. No usa claves privilegiadas ni guarda bytes en PostgreSQL. La clave y URL existentes de Supabase bastan: no hay nuevas credenciales que configurar.
4. Tras respuesta de Storage, guardar la URL en el producto mediante las APIs existentes. Si falla el producto, conservar la URL en el formulario para reintentar sin volver a subir.
5. Reemplazar genera otro objeto. No borrar automáticamente el anterior ni un archivo tras un timeout: podría estar referenciado por un producto guardado. Storage y producto no constituyen una transacción única.
6. La limpieza de archivos no referenciados queda como tarea de mantenimiento manual desde el Dashboard tras revisar referencias. Cancelar después de una carga exitosa o perder su respuesta puede dejar un archivo huérfano; no hay reintentos automáticos de la carga ni limpieza automática en esta entrega.

## API local y endpoints Storage

`POST /api/productos/imagen`: cookie `Nova.Session` y cabecera `RequestVerificationToken` del formulario autenticado. Cuerpo multipart con campo de archivo **archivo**. No establecer manualmente Content-Type al usar FormData: el navegador agrega el boundary. Máximo del archivo 5 MB; límite de solicitud multipart 6 MB. Solo administrador activo según RLS.

Respuesta HTTP 201:

```json
{
  "ruta": "catalogo/UUID-USUARIO/UUID-ARCHIVO.png",
  "url": "https://TU-PROYECTO.supabase.co/storage/v1/object/public/product-images/catalogo/UUID-USUARIO/UUID-ARCHIVO.png"
}
```

400: archivo ausente/vacío, tamaño, MIME/firma no permitidos o antifalsificación; 401: sesión; 403: perfil no autorizado; 413: petición por encima del límite del servidor; 502/503: Storage no disponible o carga sin confirmación. Algunos errores legacy de Storage incluyen el 403 dentro del cuerpo con HTTP 400; el servicio normaliza ese caso sin exponer la respuesta externa completa.

Endpoint de salida: `POST /storage/v1/object/product-images/catalogo/{usuario}/{uuid}.{ext}`, bytes del archivo, `apikey`, `Authorization: Bearer JWT`, Content-Type de imagen y `x-upsert:false`. Lectura: `GET /storage/v1/object/public/product-images/{ruta}` sin JWT. Las URLs y variables están documentadas en la carpeta **Storage — imágenes de productos** de Postman.

Código: `Infrastructure/SupabaseStorageService.cs`, `Controllers/ProductoImagenController.cs`, cliente HTTP `SupabaseStorage` en `Program.cs`, campo de archivo en `_ProductoFormulario.cshtml` y flujo de carga en `producto-form.js`.

## Verificación y pendientes

Bucket, límite, MIME, políticas y RLS verificados por consulta tras desplegar. El asesor de seguridad no añadió incidencias de Storage; mantiene el aviso preexistente de [protección de contraseñas filtradas desactivada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No se cambió Auth ni el plan.

Compilación correcta y 17 casos HTTP contra Storage simulado: PNG/JPEG/WebP, rutas únicas, nombre original ignorado, tamaño, firmas/MIME, archivo ausente, CSRF, sesión, denegación directa y legacy de permisos, error externo y cabeceras. También se verificaron Razor y sintaxis JS. No se subieron imágenes reales ni se modificaron productos para estas pruebas. Pendiente una carga HTTP real con JWT de administrador y prueba negativa con vendedor, además de revisión visual en navegador.

La subida estándar es adecuada para archivos pequeños de hasta 6 MB; para archivos mayores la documentación recomienda subidas reanudables. [Subidas estándar](https://supabase.com/docs/guides/storage/uploads/standard-uploads).

## Costos y utilidad para un proyecto pequeño

| Concepto | Free | Pro |
| --- | --- | --- |
| Plan base | USD 0/mes | Desde USD 25/mes |
| Almacenamiento de archivos incluido | 1 GB | 100 GB |
| Salida sin caché incluida | 5 GB | 250 GB |
| Salida con caché incluida | 5 GB | 250 GB |
| Almacenamiento adicional | Sin tarifa de excedente en Free; sujeto a sus límites | USD 0.0213 por GB/mes por encima de lo incluido |
| Salida adicional sin caché | Sujeta a límites Free | USD 0.09/GB |
| Salida adicional con caché | Sujeta a límites Free | USD 0.03/GB |

Las cuotas de salida no deben sumarse como una única bolsa intercambiable. Pro incluye créditos de cómputo para una instancia Micro; otros tamaños/proyectos y servicios pueden sumar costos. Free puede pausarse tras una semana de inactividad y tiene un máximo de dos proyectos activos. Las transformaciones de imagen no están incluidas en Free. Fuentes: [planes y precios](https://supabase.com/pricing), [medición y precio de Storage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size).

Estimación propia: 1.000 imágenes de 200 KB ocupan aproximadamente 200 MB; 10.000 descargas de ese tamaño representan aproximadamente 2 GB de transferencia, sin contar otros usos ni caché. Un catálogo pequeño con imágenes optimizadas puede caber en Free. La recomendación para el prototipo es empezar dentro de esas cuotas, comprimir imágenes antes de subir y revisar tanto almacenamiento como tráfico. No asumir que poco espacio implica poco tráfico ni que Free se amplía automáticamente pagando solo el excedente.

Beneficios para Nova: integración con Auth/RLS, archivos fuera del repositorio y de las filas de PostgreSQL, y distribución de imágenes mediante CDN. Elegir Pro cuando las necesidades reales de disponibilidad, uso o límites lo justifiquen; no hace falta contratarlo para comenzar un catálogo pequeño dentro de Free.
