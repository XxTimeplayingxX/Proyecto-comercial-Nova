# Nuestra historia — timeline editorial

Actualizado: 2026-11-26. Pantalla autenticada `/NuestraHistoria`.

## Relato y diseño

Se reemplazó la introducción genérica por la historia ficticia de **Ernesto Salazar**, quien comienza vendiendo baterías. Se mantiene un tono comercial sobrio con humor discreto en notas secundarias. La página aclara que personaje, fechas y escenas pertenecen al proyecto académico y que las fotografías fueron generadas con IA.

Etapas: 1968 (baterías y primer mostrador), 1986 (primer local), 2005 (computadoras y crecimiento del equipo) y 2026 (Nova actual imaginada). No constituyen datos históricos verificados de una empresa real.

El timeline alterna texto e imágenes en escritorio, con una línea central, marcadores, progreso de lectura y navegación sticky por año. En móvil pasa a una sola columna con línea lateral. Se conservan misión, visión y valores, y se actualiza la cita final para conectarla con el fundador ficticio. Mantiene Inter y los azules existentes.

## Imágenes

Cuatro fotografías editoriales en blanco y negro, generadas para esta tarea y guardadas dentro del proyecto:

- `wwwroot/images/nova-story-origen.png`: Ernesto organizando baterías junto a una radio; se reutiliza en portada y primera etapa.
- `wwwroot/images/nova-story-local.png`: primer local de radios, casetes y calculadoras.
- `wwwroot/images/nova-story-evolucion.png`: atención en una tienda de computadoras.
- `wwwroot/images/nova-story-presente.png`: showroom contemporáneo y atención a un cliente.

Son PNG de 1536 × 1024. Se conservan sin enlaces a servicios externos, con texto alternativo y dimensiones explícitas. La portada tiene prioridad de carga; las cuatro imágenes del timeline usan carga diferida y decodificación asíncrona. No se usó ni modificó el bucket de productos, ni se sustituyeron imágenes de catálogo.

## Parallax y accesibilidad

`wwwroot/js/story.js` actualiza las imágenes con `requestAnimationFrame`, agrupando eventos de scroll/resize en un solo frame. El desplazamiento vertical está limitado a ±24 px; el recorte dispone de 32 px extra por borde para no descubrir espacios vacíos. Los textos y pies permanecen estáticos.

El parallax se desactiva hasta 700 px y cuando se solicita `prefers-reduced-motion`. La preferencia también desactiva transiciones y scroll suave. `IntersectionObserver` revela las etapas progresivamente cuando está disponible; sin JavaScript, el contenido completo permanece visible. El año activo usa `aria-current="location"` y las etapas son una lista ordenada semántica con fechas y enlaces locales.

Archivos principales: `Pages/NuestraHistoria.cshtml`, `wwwroot/css/story.css` y `wwwroot/js/story.js`. No se agregaron dependencias, APIs, tablas ni cambios de contratos; no corresponde modificar Postman para esta entrega.

## Comprobaciones

Compilación correcta, sin errores ni advertencias. En un host local aislado se comprobaron el HTML Razor, los cuatro enlaces/etapas, la declaración de ficción, las cuatro imágenes con respuesta HTTP 200 y firma PNG, los cinco marcos de parallax y las cuatro cargas diferidas. Sintaxis JS y pruebas con geometría/DOM simulados: límite de desplazamiento, progreso acotado, una sola actualización por frame, año activo único y desactivación por pantalla pequeña/movimiento reducido.

Las imágenes generadas se inspeccionaron visualmente. Queda pendiente inspección de la página y animación en un navegador real; las comprobaciones con DOM simulado no equivalen a esa revisión.
