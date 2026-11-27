(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const opener = $('workspace-tour-start'), dialog = $('workspace-tour');
  if (!opener || !dialog) return;
  let steps = [], index = 0, target, frame;
  function visible(el) {
    if (!el || el.closest('[inert]')) return false;
    const rect = el.getBoundingClientRect();
    return el.getClientRects().length > 0 && rect.width > 0 && rect.right > 0 && rect.left < innerWidth;
  }
  function find(selector) { return [...document.querySelectorAll(selector)].find(visible); }
  function buildSteps() {
    const result = [];
    function add(selector,title,description) {
      const element = find(selector); if (element) result.push({ element,title,description });
    }
    add('#workspace-tour-start','Te damos la bienvenida','Este recorrido explica las opciones disponibles en tu pantalla. Solo se abre cuando pulsas «¿Primera vez por aquí?». Usa Siguiente y Anterior; no guarda ni modifica información.');
    add('#workspace-menu-abrir, #workspace-sidebar-toggle','Tu espacio de trabajo','Desde el menú puedes cambiar de módulo. En escritorio puedes ocultar la barra y ajustar su ancho; en teléfono se abre como un panel.');
    add('.workspace__nav a[href="/Bienvenida"]','Dashboard administrativo','Solo los administradores pueden consultar el resumen global: ventas, inventario y productos más vendidos.');
    add('.workspace__nav a[href="/Productos"]','Tu catálogo','Busca productos, consulta sus existencias y abre sus detalles. Las operaciones de administración dependen de tus permisos.');
    add('.workspace__nav a[href="/Ventas"]','Registra una venta','Busca productos, prepara el carrito y valida precios y existencias antes de confirmar. La base de datos decide si hay stock suficiente.');
    add('.workspace__nav a[href="/Vendedores"]','Equipo comercial','Como administrador puedes consultar perfiles, vincular cuentas y gestionar vendedores. Crear credenciales requiere la configuración administrativa del servidor.');
    add('#dashboard-periodos','Elige un periodo','Hoy, esta semana o este mes cambian ventas, ranking y listado. La semana comienza el lunes y se utiliza la hora de Ecuador.');
    add('#dashboard-kpis','Indicadores con datos reales','Las ventas corresponden al periodo elegido. Productos activos y stock son valores actuales; los agotados se muestran por separado. Un fallo de conexión no se presenta como cero.');
    add('#dashboard-chart','La evolución diaria','Este gráfico siempre muestra los últimos siete días, incluido hoy, aunque cambies el periodo del resumen.');
    add('#dashboard-top','Los productos más vendidos','Compara las unidades vendidas en el periodo. La barra refleja su posición frente al producto más vendido; el precio indicado es el actual del catálogo.');
    add('#dashboard-recent','Consulta tus operaciones','Recorre las ventas del periodo y abre Ver detalle para revisar artículos, vendedor y total. Registrada describe una venta; no certifica un cobro bancario.');
    add('#buscar, #venta-buscar','Encuentra lo que necesitas','Busca por nombre o SKU. Espera a que termine la consulta antes de elegir un resultado; un estado vacío significa que no hubo coincidencias.');
    add('#filtros','Combina los filtros','Puedes combinar marca, categoría y estado. Limpiar filtros recupera el catálogo; los indicadores superiores siguen mostrando el inventario activo global.');
    add('[data-modal-open="nuevo-producto"]','Agrega un producto','Abre un formulario sin abandonar el catálogo. Las existencias iniciales son cero; los ingresos se registran por separado para conservar la trazabilidad.');
    add('#resultados','Las acciones de cada producto','Consulta el detalle desde la fila. La edición y los ingresos de stock necesitan permisos administrativos; la trazabilidad permite revisar los movimientos cuando tu rol lo autoriza.');
    add('#pedido-items','Prepara el pedido','Agrega unidades y revisa cantidades. Si las existencias cambian, el sistema te avisará; no necesitas cambiar de pantalla para corregir el carrito.');
    add('#venta-validar','Primero valida, después confirma','Validar consulta precios y stock sin reservar unidades. Confirmar intenta registrar la venta. Si se pierde la respuesta, conserva el mismo pedido y utiliza su recuperación.');
    add('#ficha-vendedor','La ficha del vendedor','Revisa nombre, correo, rol y estado. Los avisos de configuración explican qué operaciones están disponibles. Guardar un perfil y cambiar credenciales son operaciones diferentes.');
    add('#vendedores-buscar','Encuentra a tu equipo','Filtra el directorio por nombre o correo. Los indicadores resumen los perfiles registrados, activos e inactivos.');
    add('#vendedor-nuevo','Vincula una cuenta existente','Si la persona ya tiene cuenta en Supabase Auth, utiliza su UUID para asociarla a un perfil comercial. Esta opción no crea nuevas credenciales.');
    add('a[href="/Vendedores/Nuevo"]','Crea una cuenta comercial','Agregar vendedor abre la ficha completa. Para crear credenciales el servidor debe tener configurado el acceso administrativo de Auth.');
    add('#vendedores-listado','Consulta y administra perfiles','Desde cada perfil puedes abrir su ficha y consultar sus comprobantes. Otro administrador debe gestionar tu propia cuenta.');
    add('#story-timeline','Recorre nuestra historia','Desplázate por las etapas o utiliza los enlaces de año. El relato y sus fotografías son ficticios; el movimiento se reduce según tus preferencias.');
    add('#workspace-account','Tu cuenta y tu sesión','Pulsa tu correo para ver nombre, rol y duración de la sesión o cerrar sesión. Tras dos minutos sin actividad aparece un aviso; al tercer minuto sin responder se cierra.');
    return result;
  }
  function position() {
    if (!dialog.open || !target) return;
    const rect = target.getBoundingClientRect(), width = dialog.offsetWidth, height = dialog.offsetHeight;
    const viewportHeight = window.visualViewport?.height || innerHeight;
    const left = Math.max(12,Math.min(rect.left,innerWidth-width-12));
    const below = rect.bottom+12, above = rect.top-height-12;
    const top = below+height <= viewportHeight-12 ? below : above >= 12 ? above : Math.max(12,viewportHeight-height-12);
    dialog.style.left = `${left}px`; dialog.style.top = `${top}px`;
  }
  function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(position); }
  function showStep() {
    target?.classList.remove('nova-tour-target');
    const step = steps[index]; target = step.element;
    target.classList.add('nova-tour-target');
    target.scrollIntoView({ block:'center', behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    $('workspace-tour-title').textContent = step.title;
    $('workspace-tour-description').textContent = step.description;
    $('workspace-tour-progress').textContent = `Recorrido guiado · ${index+1} de ${steps.length}`;
    $('workspace-tour-prev').disabled = index === 0;
    $('workspace-tour-next').textContent = index === steps.length-1 ? 'Finalizar ✓' : 'Siguiente →';
    const dots = $('workspace-tour-dots'); dots.replaceChildren();
    steps.forEach((_,i) => { const dot = document.createElement('span'); dot.classList.toggle('active',i <= index); dots.append(dot); });
    position(); schedule(); $('workspace-tour-title').focus({ preventScroll:true });
  }
  opener.addEventListener('click',() => {
    if (dialog.open) return;
    if (document.querySelector('dialog[open]')) {
      window.NovaToasts?.show({ status:'information',title:'Termina la operación actual',message:'Cierra el diálogo abierto antes de comenzar el recorrido.' }); return;
    }
    steps = buildSteps(); index = 0;
    if (!steps.length) return;
    dialog.showModal(); showStep();
  });
  $('workspace-tour-close').addEventListener('click',() => dialog.close());
  $('workspace-tour-prev').addEventListener('click',() => { if (index > 0) { index--; showStep(); } });
  $('workspace-tour-next').addEventListener('click',() => { if (index < steps.length-1) { index++; showStep(); } else dialog.close(); });
  dialog.addEventListener('close',() => { target?.classList.remove('nova-tour-target'); target = null; cancelAnimationFrame(frame); opener.focus({ preventScroll:true }); });
  window.addEventListener('resize',schedule); window.addEventListener('scroll',schedule,true);
  window.visualViewport?.addEventListener('resize',schedule);
  const idle = $('workspace-idle');
  if (idle) new MutationObserver(() => { if (idle.open && dialog.open) dialog.close(); }).observe(idle,{ attributes:true,attributeFilter:['open'] });
})();
