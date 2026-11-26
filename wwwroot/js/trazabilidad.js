(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const modal = $('trazabilidad');
  const history = $('trazabilidad-historial');
  const message = $('trazabilidad-mensaje');
  const more = $('trazabilidad-mas');
  const dates = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
  const numbers = new Intl.NumberFormat('es-EC');
  const labels = { entry: 'Entrada', sale: 'Venta', exit: 'Salida' };
  const saleStates = { completed: 'Completada', cancelled: 'Cancelada' };
  let id, cursor, request;

  function text(tag, value, cls) {
    const node = document.createElement(tag);
    node.textContent = value;
    if (cls) node.className = cls;
    return node;
  }

  function time(value) {
    const node = text('time', dates.format(new Date(value)));
    node.dateTime = value;
    return node;
  }

  function movement(item) {
    const row = document.createElement('li');
    const header = text('div', '', 'trazabilidad__encabezado');
    const change = item.stockNuevo - item.stockAnterior;
    header.append(text('strong', labels[item.tipo] || 'Movimiento'),
      text('span', `${change > 0 ? '+' : ''}${numbers.format(change)} un.`, change > 0 ? 'trazabilidad__entrada' : 'trazabilidad__salida'),
      time(item.fecha));
    row.append(header);
    const details = document.createElement('dl');
    const fields = [
      ['Unidades', numbers.format(item.cantidad)],
      ['Stock anterior → nuevo', `${numbers.format(item.stockAnterior)} → ${numbers.format(item.stockNuevo)}`],
      ['Registró', item.responsable || 'Sin perfil disponible']
    ];
    if (item.venta) {
      fields.push(['Venta', `#${item.venta.id}${item.venta.estado ? ` · ${saleStates[item.venta.estado] || item.venta.estado}` : ''}`],
        ['Vendedor', item.venta.vendedor || 'Sin vendedor disponible'],
        ['Comprador', item.venta.comprador || 'Cliente no registrado']);
    }
    for (const [label, value] of fields) {
      const field = document.createElement('div');
      field.append(text('dt', label), text('dd', value));
      details.append(field);
    }
    row.append(details);
    if (item.motivo) row.append(text('p', item.motivo, 'trazabilidad__motivo'));
    return row;
  }

  async function load() {
    if (request) return;
    const controller = new AbortController();
    request = controller;
    more.disabled = true;
    history.setAttribute('aria-busy', 'true');
    message.textContent = 'Consultando movimientos…';
    try {
      const query = cursor ? `?antesDe=${encodeURIComponent(cursor)}` : '';
      const response = await fetch(`/api/productos/${id}/trazabilidad${query}`, {
        signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' }
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('La sesión venció. Inicia sesión nuevamente.');
      if (response.status === 403) throw new Error('Se requiere un administrador activo.');
      if (!response.ok) throw new Error(data.title || 'No se pudo consultar el historial.');
      if (controller.signal.aborted) return;
      $('trazabilidad-producto').textContent = `${data.producto.nombre} · SKU ${data.producto.sku}`;
      $('trazabilidad-fecha-alta').replaceChildren(time(data.producto.alta));
      $('trazabilidad-alta').hidden = false;
      history.append(...data.items.map(movement));
      cursor = data.siguiente;
      more.hidden = !cursor;
      more.textContent = 'Ver movimientos anteriores';
      message.textContent = history.children.length === 0
        ? 'Este producto no tiene movimientos de inventario registrados.'
        : `${history.children.length} movimientos cargados.`;
    } catch (error) {
      if (controller.signal.aborted) return;
      message.textContent = error.message;
      more.hidden = false;
      more.textContent = 'Reintentar';
    } finally {
      if (request === controller) {
        request = null;
        more.disabled = false;
        history.setAttribute('aria-busy', 'false');
      }
    }
  }

  document.addEventListener('nova:ver-trazabilidad', event => {
    if (modal.open) return;
    request?.abort();
    request = null;
    id = event.detail.id;
    cursor = null;
    $('trazabilidad-producto').textContent = `${event.detail.nombre} · SKU ${event.detail.sku}`;
    $('trazabilidad-alta').hidden = true;
    history.replaceChildren();
    more.hidden = true;
    modal.showModal();
    load();
  });
  modal.addEventListener('close', () => {
    if (modal.open) return;
    request?.abort();
    request = null;
  });
  more.addEventListener('click', load);
})();
