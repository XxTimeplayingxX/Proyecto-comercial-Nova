(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
  const cart = new Map();
  const storageKey = `nova:venta-pendiente:${$('punto-venta').dataset.user}`;
  let page = 1, category = '', productsRequest, customersRequest, searchTimer, customerTimer;
  let validated = false, busy = false, pending = null;
  const text = (tag, value, className) => {
    const node = document.createElement(tag); node.textContent = value;
    if (className) node.className = className;
    return node;
  };
  function message(value, success = false) {
    const box = $('venta-mensaje'); box.textContent = value; box.hidden = !value;
    box.classList.toggle('pos__message--success', success);
  }
  function locked() { return busy || pending !== null; }
  async function read(url, signal) {
    const response = await fetch(url, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 401 ? 'La sesión venció. Inicia sesión nuevamente.' : data.title || 'No se pudo consultar la información. Inténtalo de nuevo.');
    return data;
  }
  function skeleton(kind) { const node = document.createElement('span'); node.className = `pos-skeleton pos-skeleton--${kind}`; return node; }
  function loadingProducts() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 8; i++) {
      const card = document.createElement('article'); card.className = 'pos-card pos-card--skeleton'; card.setAttribute('aria-hidden', 'true');
      const top = document.createElement('div'); top.className = 'pos-card__top';
      const identity = document.createElement('div'); identity.append(skeleton('sku'), skeleton('name'), skeleton('description'));
      top.append(skeleton('image'), identity);
      const bottom = document.createElement('div'); bottom.className = 'pos-card__bottom';
      const price = document.createElement('div'); price.append(skeleton('label'), skeleton('price')); bottom.append(price, skeleton('button'));
      card.append(top, bottom); fragment.append(card);
    }
    $('venta-productos').replaceChildren(fragment); $('venta-productos').setAttribute('aria-busy', 'true');
    $('venta-anterior').disabled = $('venta-siguiente').disabled = true;
    $('venta-catalogo-error').hidden = true; $('venta-catalogo-estado').textContent = 'Buscando productos…';
  }
  function productImage(product) {
    const box = document.createElement('span'); box.className = 'pos-card__image';
    const fallback = () => { box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 5 5 3-3 5 5"/><circle cx="16" cy="9" r="1"/></svg>'; };
    fallback();
    if (product.imagen) {
      try {
        const url = new URL(product.imagen, location.origin);
        if (url.protocol === 'https:' || url.origin === location.origin && product.imagen.startsWith('/') && !product.imagen.startsWith('//')) {
          const img = document.createElement('img'); img.src = url.href; img.alt = product.nombre; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
          img.addEventListener('error', fallback, { once: true }); box.replaceChildren(img);
        }
      } catch { /* Keep the explicit image fallback. */ }
    }
    return box;
  }
  function productCard(product) {
    const card = document.createElement('article'); card.className = 'pos-card';
    const top = document.createElement('div'); top.className = 'pos-card__top';
    const identity = document.createElement('div');
    identity.append(text('span', product.sku, 'pos-card__sku'), text('h3', product.nombre), text('p', product.categoria?.name || 'Sin categoría', 'pos-card__category'));
    top.append(productImage(product), identity);
    const status = product.stock === 0 ? 'Sin existencias' : `${product.stock} en stock`;
    const stock = text('span', status, `pos-card__stock${product.stock === 0 ? ' pos-card__stock--empty' : product.estado === 'bajo' ? ' pos-card__stock--low' : ''}`);
    const bottom = document.createElement('div'); bottom.className = 'pos-card__bottom';
    const price = document.createElement('div'); price.append(text('small', 'Precio unitario'), text('strong', money.format(product.precio), 'pos-card__price'));
    const add = text('button', product.stock ? '+ Agregar' : 'Sin stock', 'pos-card__add'); add.type = 'button';
    add.dataset.productId = product.id; add.dataset.stock = product.stock;
    add.setAttribute('aria-label', `Agregar ${product.nombre} al pedido`);
    add.disabled = locked() || !product.stock || (cart.get(product.id)?.cantidad || 0) >= product.stock;
    add.addEventListener('click', () => {
      if (locked()) return;
      const existing = cart.get(product.id), quantity = (existing?.cantidad || 0) + 1;
      if (quantity > product.stock) return message('Ya agregaste todas las unidades disponibles de este producto.');
      cart.set(product.id, { productoId: product.id, nombre: product.nombre, sku: product.sku, precio: product.precio, stock: product.stock, cantidad: quantity });
      invalidate(); renderCart();
    });
    bottom.append(price, add); card.append(top, stock, bottom); return card;
  }
  async function loadProducts() {
    productsRequest?.abort(); productsRequest = new AbortController(); const request = productsRequest;
    loadingProducts();
    try {
      const query = new URLSearchParams({ buscar: $('venta-buscar').value.trim(), pagina: page });
      if (category) query.set('categoria', category);
      const data = await read(`/api/ventas/productos?${query}`, request.signal);
      if (request !== productsRequest || request.signal.aborted) return;
      $('venta-productos').replaceChildren(...data.items.map(productCard));
      if (!data.items.length) $('venta-productos').append(text('p', 'No hay productos que coincidan con tu búsqueda.', 'pos__empty'));
      $('venta-catalogo-estado').textContent = `${data.items.length} productos en esta página · Datos del catálogo`;
      $('venta-pagina').textContent = `Página ${page}`;
      $('venta-anterior').disabled = page <= 1; $('venta-siguiente').disabled = !data.hayMas;
    } catch (e) {
      if (e.name !== 'AbortError' && request === productsRequest) {
        $('venta-productos').replaceChildren(); $('venta-catalogo-error').hidden = false;
        $('venta-catalogo-error-texto').textContent = e.message; $('venta-catalogo-estado').textContent = 'Catálogo no disponible';
      }
    } finally { if (request === productsRequest) $('venta-productos').setAttribute('aria-busy', 'false'); }
  }
  async function loadCategories() {
    try {
      const data = await read('/api/productos/filtros?activos=true');
      for (const item of data.categorias) {
        const button = text('button', item.name); button.type = 'button'; button.dataset.category = item.id; button.setAttribute('aria-pressed', 'false');
        $('venta-categorias').append(button);
      }
    } catch { $('venta-categorias').setAttribute('aria-label', 'Categorías no disponibles; puedes buscar por nombre o SKU'); }
  }
  async function loadCustomers() {
    customersRequest?.abort(); customersRequest = new AbortController(); const request = customersRequest;
    $('venta-cliente').setAttribute('aria-busy', 'true');
    try {
      const data = await read(`/api/ventas/clientes?${new URLSearchParams({ buscar: $('venta-cliente-buscar').value.trim() })}`, request.signal);
      if (request !== customersRequest || request.signal.aborted) return;
      const select = $('venta-cliente'), selected = select.value, selectedLabel = select.selectedOptions[0]?.textContent;
      select.replaceChildren(new Option('Consumidor final · Venta rápida', ''), ...data.map(x => new Option(x.name, x.id)));
      if (selected && !data.some(x => String(x.id) === selected)) select.add(new Option(selectedLabel, selected));
      select.value = selected;
      $('venta-cliente-estado').textContent = 'Se muestran hasta 20 coincidencias. Consumidor final no requiere cliente.';
    } catch (e) { if (e.name !== 'AbortError') $('venta-cliente-estado').textContent = `${e.message} Puedes usar consumidor final.`; }
    finally { if (request === customersRequest) $('venta-cliente').setAttribute('aria-busy', 'false'); }
  }
  function invalidate() {
    validated = false; message(''); $('venta-recibo').hidden = true;
  }
  function controls() {
    $('venta-cliente-campos').disabled = locked();
    $('venta-validar').disabled = locked() || cart.size === 0;
    $('venta-confirmar').disabled = busy || !(validated || pending);
    $('venta-confirmar').textContent = busy ? 'Procesando…' : pending ? 'Reintentar la misma venta' : `Confirmar venta${validated ? ` · ${money.format(total())}` : ''}`;
    $('venta-limpiar').disabled = locked() || !cart.size;
    $('pedido-etapa').textContent = busy ? 'Procesando' : pending ? 'Por confirmar' : validated ? 'Validado' : 'Borrador';
    document.querySelectorAll('.pos-card__add').forEach(button => {
      button.disabled = locked() || Number(button.dataset.stock) === 0 || (cart.get(Number(button.dataset.productId))?.cantidad || 0) >= Number(button.dataset.stock);
    });
  }
  function total() { return [...cart.values()].reduce((sum, item) => sum + Math.round(item.precio * 100) * item.cantidad, 0) / 100; }
  function renderCart() {
    const container = $('pedido-items'); container.replaceChildren();
    if (!cart.size) {
      const empty = document.createElement('div'); empty.className = 'pos__cart-empty';
      empty.append(text('span', '＋'), text('strong', 'Tu pedido empieza aquí'), text('p', 'Agrega productos del catálogo para preparar una venta.')); container.append(empty);
    }
    for (const item of cart.values()) {
      const line = document.createElement('article'); line.className = 'pos-line';
      const heading = document.createElement('div'); heading.className = 'pos-line__heading';
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'pos-line__remove';
      remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>';
      remove.setAttribute('aria-label', `Quitar ${item.nombre}`); remove.disabled = locked();
      remove.addEventListener('click', () => { if (!locked()) { cart.delete(item.productoId); invalidate(); renderCart(); } });
      heading.append(text('h4', item.nombre), remove);
      const bottom = document.createElement('div'); bottom.className = 'pos-line__bottom';
      const quantity = document.createElement('div'); quantity.className = 'pos-line__quantity';
      const minus = text('button', '−'), plus = text('button', '+');
      minus.type = plus.type = 'button'; minus.setAttribute('aria-label', `Reducir cantidad de ${item.nombre}`); plus.setAttribute('aria-label', `Aumentar cantidad de ${item.nombre}`);
      const input = document.createElement('input'); input.type = 'number'; input.min = 1; input.max = Math.max(item.stock, item.cantidad); input.step = 1; input.value = item.cantidad;
      input.id = `venta-cantidad-${item.productoId}`;
      input.setAttribute('aria-label', `Cantidad de ${item.nombre}`); input.disabled = locked();
      minus.disabled = locked() || item.cantidad <= 1; plus.disabled = locked() || item.cantidad >= item.stock;
      const change = value => {
        if (locked()) return;
        if (!Number.isInteger(value) || value < 1 || value > item.stock) { input.value = item.cantidad; message(`Selecciona entre 1 y ${item.stock} unidades de ${item.nombre}.`); return; }
        item.cantidad = value; invalidate(); renderCart(); $(`venta-cantidad-${item.productoId}`)?.focus();
      };
      minus.addEventListener('click', () => change(item.cantidad - 1)); plus.addEventListener('click', () => change(item.cantidad + 1));
      input.addEventListener('change', () => change(Number(input.value)));
      quantity.append(minus, input, plus); bottom.append(quantity, text('strong', money.format(item.precio * item.cantidad)));
      line.append(heading, text('p', `${item.sku} · ${money.format(item.precio)} c/u`, 'pos-line__sku'), bottom); container.append(line);
    }
    $('pedido-tipos').textContent = `${cart.size} ${cart.size === 1 ? 'producto' : 'productos'}`;
    const units = [...cart.values()].reduce((sum, item) => sum + item.cantidad, 0);
    $('pedido-unidades').textContent = `${units} ${units === 1 ? 'unidad' : 'unidades'}`;
    $('pedido-total').textContent = money.format(total());
    $('pedido-precio-nota').textContent = validated ? 'Precios consultados. El total definitivo se confirma al registrar.' : 'Importe estimado. Valida el pedido para consultar los precios actuales.';
    controls();
  }
  function payload() { return { clienteId: $('venta-cliente').value ? Number($('venta-cliente').value) : null, items: [...cart.values()].map(x => ({ productoId: x.productoId, cantidad: x.cantidad })) }; }
  async function post(url, body) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json',
      RequestVerificationToken: $('venta-seguridad').querySelector('input').value }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => null);
    return { response, data };
  }
  $('venta-validar').addEventListener('click', async () => {
    if (locked() || !cart.size) return;
    busy = true; validated = false; message('Consultando precios y existencias…'); renderCart();
    try {
      const { response, data } = await post('/api/ventas/validar', payload());
      if (response.status === 401) throw new Error('La sesión venció. Inicia sesión nuevamente.');
      if (response.status !== 200 && response.status !== 409 || !Array.isArray(data?.items)) throw new Error(data?.title || 'No se pudo validar el pedido. Inténtalo de nuevo.');
      for (const line of data.items) {
        const item = cart.get(line.productoId);
        if (item) Object.assign(item, { nombre: line.nombre, sku: line.sku, precio: line.precio, stock: line.stock });
      }
      validated = data.valida === true;
      message(validated ? 'Pedido validado. Revisa los precios actualizados y confirma la venta.' : data.errores.join('\n'), validated);
    } catch (e) { message(e.message); }
    finally { busy = false; renderCart(); }
  });
  async function confirmSale() {
    if (busy || !pending && !validated) return;
    if (!pending) {
      const operation = { payload: { ...payload(), requestId: crypto.randomUUID() }, lines: [...cart.values()].map(x => ({ ...x })) };
      try { sessionStorage.setItem(storageKey, JSON.stringify(operation)); pending = operation; }
      catch { message('No se pudo guardar el identificador de recuperación en esta pestaña. Habilita el almacenamiento de sesión antes de confirmar.'); return; }
    }
    busy = true; message('Registrando la venta. Espera la confirmación del servidor…'); renderCart();
    try {
      const { response, data } = await post('/api/ventas', pending.payload);
      if (!response.ok) {
        // A definitive rejection rolls back the RPC. An uncertain result keeps the exact request for replay.
        if (response.status >= 400 && response.status < 500 && data?.code !== 'REQUEST_ID_REUSED') {
          sessionStorage.removeItem(storageKey); pending = null; validated = false;
        }
        throw new Error(response.status === 401 ? 'La sesión venció. Inicia sesión nuevamente.' : data?.title || 'No se pudo confirmar la venta. Reintenta el mismo pedido.');
      }
      if (!Number.isSafeInteger(data?.saleId) || data.saleId <= 0 || typeof data.total !== 'number' || data.total <= 0) throw new Error('La respuesta no confirmó el registro. Reintenta la misma venta.');
      try { sessionStorage.removeItem(storageKey); } catch { /* The confirmed RPC result remains authoritative; a leftover snapshot can only replay it. */ }
      pending = null; validated = false; cart.clear();
      $('venta-recibo').textContent = `✓ Venta #${data.saleId} ${data.replayed ? 'recuperada' : 'registrada'} · Total confirmado: ${money.format(data.total)}.`;
      $('venta-recibo').hidden = false; message('La venta está confirmada y el inventario fue actualizado.', true);
      $('venta-cliente').value = ''; loadProducts();
    } catch (e) { message(`${e.message}${pending ? ' El pedido está protegido: usa «Reintentar la misma venta» sin cambiar sus artículos.' : ' Revisa el pedido y vuelve a validarlo.'}`); }
    finally { busy = false; renderCart(); }
  }
  $('venta-confirmar').addEventListener('click', confirmSale);
  $('venta-limpiar').addEventListener('click', () => { if (!locked()) { cart.clear(); invalidate(); renderCart(); } });
  $('venta-cliente').addEventListener('change', () => { if (!locked()) { invalidate(); renderCart(); } });
  $('venta-buscar').addEventListener('input', () => {
    clearTimeout(searchTimer); productsRequest?.abort(); productsRequest = null; page = 1; loadingProducts(); searchTimer = setTimeout(loadProducts, 300);
  });
  $('venta-cliente-buscar').addEventListener('input', () => { clearTimeout(customerTimer); customersRequest?.abort(); customersRequest = null; customerTimer = setTimeout(loadCustomers, 300); });
  $('venta-categorias').addEventListener('click', event => {
    const button = event.target.closest('[data-category]'); if (!button) return;
    clearTimeout(searchTimer); category = button.dataset.category; page = 1;
    $('venta-categorias').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === button))); loadProducts();
  });
  $('venta-anterior').addEventListener('click', () => { page--; loadProducts(); });
  $('venta-siguiente').addEventListener('click', () => { page++; loadProducts(); });
  $('venta-reintentar').addEventListener('click', loadProducts);
  document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('venta-buscar').focus(); } });
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (saved?.payload?.requestId && Array.isArray(saved.payload.items) && saved.payload.items.length && Array.isArray(saved.lines)) {
      pending = saved; saved.lines.forEach(item => cart.set(item.productoId, item));
      if (saved.payload.clienteId) { $('venta-cliente').add(new Option('Cliente de la operación pendiente', saved.payload.clienteId)); $('venta-cliente').value = saved.payload.clienteId; }
      message('Hay una venta sin confirmación en esta pestaña. Reintenta la misma operación para recuperar su resultado sin duplicarla.');
    }
  } catch { message('No se pudo leer la recuperación de esta pestaña. Revisa cualquier operación anterior antes de registrar otra venta.'); }
  renderCart(); loadProducts(); loadCategories(); loadCustomers();
})();
