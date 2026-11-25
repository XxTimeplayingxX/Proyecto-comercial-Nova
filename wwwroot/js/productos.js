(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('filtros');
  const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
  const labels = { disponible: 'Disponible', bajo: 'Stock bajo', agotado: 'Agotado', inactivo: 'Inactivo' };
  let page = 1, total = 0, listRequest, detailRequest, searchTimer;
  const text = (tag, value, cls) => {
    const node = document.createElement(tag);
    node.textContent = value;
    if (cls) node.className = cls;
    return node;
  };
  function skeleton(cls) {
    const node = document.createElement('span');
    node.className = `skeleton ${cls}`;
    return node;
  }
  function loadingRows() {
    const rows = document.createDocumentFragment();
    for (let i = 0; i < 10; i++) {
      const tr = document.createElement('tr');
      tr.className = 'catalogo__skeleton-row'; tr.setAttribute('aria-hidden', 'true');
      const first = document.createElement('td');
      const product = document.createElement('div'); product.className = 'producto';
      const identity = document.createElement('div'); identity.className = 'skeleton__identity';
      identity.append(skeleton('skeleton--name'), skeleton('skeleton--sku'));
      product.append(skeleton('skeleton--thumbnail'), identity); first.append(product); tr.append(first);
      for (const cls of ['label', 'category', 'price', 'stock', 'badge', 'action']) {
        const cell = document.createElement('td');
        if (cls === 'price' || cls === 'stock') cell.className = 'numero';
        cell.append(skeleton(`skeleton--${cls}`)); tr.append(cell);
      }
      rows.append(tr);
    }
    return rows;
  }
  function loadingDetail() {
    const box = document.createElement('div'); box.className = 'detalle-skeleton';
    box.setAttribute('aria-hidden', 'true');
    const fields = document.createElement('div'); fields.className = 'detalle-skeleton__campos';
    for (let i = 0; i < 7; i++) fields.append(skeleton('skeleton--label'), skeleton('skeleton--value'));
    box.append(skeleton('detalle-skeleton__imagen'), skeleton('skeleton--badge'), fields);
    return box;
  }
  async function get(url, signal) {
    const response = await fetch(url, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (response.status === 401) throw new Error('La sesión venció. Inicia sesión nuevamente.');
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.title || 'No se pudo consultar Supabase. Inténtalo de nuevo.');
    }
    return response.json();
  }
  function image(product) {
    const box = document.createElement('span');
    box.className = 'producto__imagen';
    const fallback = () => {
      box.replaceChildren();
      box.title = 'Sin imagen disponible';
      // Static icon; database content is always inserted as text.
      box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 5 5 3-3 5 5"/><circle cx="16" cy="9" r="1"/></svg>';
    };
    fallback();
    if (product.imagen) {
      try {
        const url = new URL(product.imagen, location.origin);
        if (url.protocol === 'https:' || (url.origin === location.origin && product.imagen.startsWith('/'))) {
          const img = document.createElement('img');
          img.src = url.href; img.alt = product.nombre; img.loading = 'lazy';
          img.addEventListener('error', fallback, { once: true });
          box.removeAttribute('title'); box.replaceChildren(img);
        }
      } catch { /* An unusable image path gets the same explicit fallback. */ }
    }
    return box;
  }
  function badge(product) { return text('span', labels[product.estado] || 'Sin estado', `estado estado--${product.estado}`); }
  function row(product) {
    const tr = document.createElement('tr');
    const first = document.createElement('td');
    const identity = document.createElement('div'); identity.className = 'producto';
    const name = document.createElement('div');
    name.append(text('span', product.nombre, 'producto__nombre'), text('span', `SKU: ${product.sku}`, 'producto__sku'));
    identity.append(image(product), name); first.append(identity); tr.append(first);
    tr.append(text('td', product.marca?.name ?? 'Sin marca'), text('td', product.categoria?.name ?? 'Sin categoría'));
    tr.append(text('td', money.format(product.precio), 'numero'));
    tr.append(text('td', `${product.stock} ${product.stock === 1 ? 'unidad' : 'unidades'}`, `numero stock--${product.estado}`));
    const status = document.createElement('td'); status.append(badge(product)); tr.append(status);
    const action = document.createElement('td');
    const button = text('button', 'Ver detalle', 'producto__ver'); button.type = 'button';
    button.setAttribute('aria-label', `Ver detalle de ${product.nombre}`);
    button.addEventListener('click', () => detail(product.id)); action.append(button); tr.append(action);
    return tr;
  }
  function notice(id, message) { $(id).textContent = message; $(id).hidden = !message; }
  async function loadList() {
    listRequest?.abort(); listRequest = new AbortController();
    const controller = listRequest;
    $('resultados').setAttribute('aria-busy', 'true'); $('catalogo-error').hidden = true;
    $('anterior').disabled = $('siguiente').disabled = true;
    try {
      const params = new URLSearchParams(['buscar', 'marca', 'categoria', 'estado'].map(id => [id, $(id).value]));
      params.set('pagina', page); params.set('tamano', 10);
      $('conteo').textContent = 'Cargando productos…';
      $('productos').replaceChildren(loadingRows());
      const data = await get(`/api/productos?${params}`, controller.signal);
      total = data.total;
      if (page > 1 && !data.items.length) { page = 1; return loadList(); }
      $('productos').replaceChildren(...data.items.map(row));
      if (!data.items.length) {
        const empty = document.createElement('tr'); const td = text('td', 'No hay productos que coincidan con los filtros.', 'catalogo__empty');
        td.colSpan = 7; empty.append(td); $('productos').append(empty);
      }
      $('conteo').textContent = total ? `Mostrando ${(page - 1) * 10 + 1}–${Math.min(page * 10, total)} de ${total} productos` : '0 productos';
      $('pagina').textContent = page;
      $('anterior').disabled = page === 1; $('siguiente').disabled = page * 10 >= total;
    } catch (error) {
      if (error.name === 'AbortError') return;
      $('productos').replaceChildren(); $('catalogo-error').hidden = false;
      $('catalogo-error-text').textContent = error.message; $('conteo').textContent = 'Catálogo no disponible';
    } finally { if (listRequest === controller) $('resultados').setAttribute('aria-busy', 'false'); }
  }
  async function loadKpis() {
    $('kpis').setAttribute('aria-busy', 'true'); notice('kpi-error', '');
    document.querySelectorAll('[data-kpi]').forEach(n => { n.textContent = '—'; });
    try {
      const data = await get('/api/productos/kpi');
      document.querySelectorAll('[data-kpi]').forEach(n => { n.textContent = data[n.dataset.kpi]; });
    } catch (error) { notice('kpi-error', `Indicadores no disponibles. ${error.message}`); }
    finally { $('kpis').setAttribute('aria-busy', 'false'); }
  }
  async function loadFilters() {
    notice('filtro-error', ''); $('marca').disabled = $('categoria').disabled = true;
    for (const id of ['marca', 'categoria']) $(id).setAttribute('aria-busy', 'true');
    try {
      const data = await get('/api/productos/filtros');
      for (const [id, items] of [['marca', data.marcas], ['categoria', data.categorias]]) {
        const selected = $(id).value;
        $(id).replaceChildren(new Option(id === 'marca' ? 'Todas las marcas' : 'Todas las categorías', ''), ...items.map(x => new Option(x.name, x.id)));
        $(id).value = selected;
        $(id).disabled = false;
      }
    } catch (error) { notice('filtro-error', `No se pudieron cargar las marcas y categorías. ${error.message}`); }
    finally { for (const id of ['marca', 'categoria']) $(id).setAttribute('aria-busy', 'false'); }
  }
  async function detail(id) {
    detailRequest?.abort(); detailRequest = new AbortController();
    const controller = detailRequest;
    $('detalle-titulo').textContent = 'Detalle del producto';
    $('detalle-contenido').setAttribute('aria-busy', 'true');
    try {
      $('detalle-contenido').replaceChildren(loadingDetail());
      $('detalle').showModal();
      const product = await get(`/api/productos/${id}`, controller.signal);
      $('detalle-titulo').textContent = product.nombre;
      const dl = document.createElement('dl');
      for (const [key, value] of [['SKU', product.sku], ['Marca', product.marca?.name ?? 'Sin marca'], ['Categoría', product.categoria?.name ?? 'Sin categoría'], ['Precio', money.format(product.precio)], ['Stock disponible', `${product.stock} unidades`], ['Stock mínimo', `${product.stockMinimo} unidades`], ['Activo', product.activo ? 'Sí' : 'No']]) {
        dl.append(text('dt', key), text('dd', value));
      }
      $('detalle-contenido').replaceChildren(image(product), badge(product), dl,
        text('p', 'Si el producto no tiene una imagen accesible, se muestra un ícono de referencia.', 'catalogo__footnote'));
    } catch (error) { if (error.name !== 'AbortError') $('detalle-contenido').replaceChildren(text('p', error.message)); }
    finally { if (detailRequest === controller) $('detalle-contenido').setAttribute('aria-busy', 'false'); }
  }
  $('cerrar-detalle').addEventListener('click', () => $('detalle').close());
  $('detalle').addEventListener('close', () => detailRequest?.abort());
  form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(searchTimer); page = 1; loadList(); });
  $('buscar').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { page = 1; loadList(); }, 300); });
  for (const id of ['marca', 'categoria', 'estado']) $(id).addEventListener('change', () => { clearTimeout(searchTimer); page = 1; loadList(); });
  form.addEventListener('reset', () => { clearTimeout(searchTimer); setTimeout(() => { page = 1; loadList(); }, 0); });
  $('anterior').addEventListener('click', () => { page--; loadList(); });
  $('siguiente').addEventListener('click', () => { page++; loadList(); });
  $('reintentar').addEventListener('click', loadList);
  $('actualizar').addEventListener('click', async () => {
    $('actualizar').disabled = true;
    await Promise.allSettled([loadList(), loadKpis(), loadFilters()]);
    $('actualizar').disabled = false;
  });
  document.addEventListener('nova:producto-creado', () => { page = 1; loadList(); loadKpis(); });
  loadList(); loadKpis(); loadFilters();
})();
