(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const modal = $('nuevo-producto'), form = $('producto-form');
  const submit = modal.querySelector('[data-modal-submit]');
  let catalogsReady = false, saving = false;
  function error(message) {
    const box = $('producto-form-error');
    box.textContent = message; box.hidden = !message;
    if (message) box.focus();
  }
  async function catalogs() {
    catalogsReady = false; submit.disabled = true; error('');
    for (const id of ['producto-marca', 'producto-categoria']) {
      $(id).disabled = true; $(id).setAttribute('aria-busy', 'true');
    }
    try {
      const response = await fetch('/api/productos/filtros?activos=true', { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (response.status === 401) throw new Error('La sesión venció. Inicia sesión nuevamente.');
      if (!response.ok) throw new Error('No se pudieron cargar las marcas y categorías. Cierra y vuelve a abrir el formulario para reintentar.');
      const data = await response.json();
      for (const [id, items, label] of [['producto-marca', data.marcas, 'Selecciona una marca…'], ['producto-categoria', data.categorias, 'Selecciona una categoría…']]) {
        const selected = $(id).value;
        $(id).replaceChildren(new Option(label, ''), ...items.map(item => new Option(item.name, item.id)));
        $(id).value = selected; $(id).disabled = false;
      }
      if (!data.marcas.length || !data.categorias.length) throw new Error('Para crear un producto debe existir al menos una marca y una categoría activas.');
      catalogsReady = true;
    } catch (e) { error(e.message); }
    finally {
      for (const id of ['producto-marca', 'producto-categoria']) $(id).setAttribute('aria-busy', 'false');
      submit.disabled = !catalogsReady || saving;
    }
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-modal-open="nuevo-producto"]')) catalogs();
  });
  $('producto-descripcion').addEventListener('input', () => {
    $('descripcion-conteo').textContent = `${$('producto-descripcion').value.length} / 250 caracteres`;
  });
  $('generar-sku').addEventListener('click', () => {
    $('producto-sku').value = `NOVA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    $('producto-sku').focus();
  });
  function busy(value) {
    saving = value; modal.dataset.busy = String(value);
    form.setAttribute('aria-busy', String(value));
    $('producto-campos').disabled = value;
    modal.querySelectorAll('[data-modal-close]').forEach(button => { button.disabled = value; });
    submit.disabled = value || !catalogsReady;
    submit.textContent = value ? 'Guardando…' : 'Guardar producto';
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !catalogsReady) return;
    for (const name of ['nombre', 'sku', 'imagen']) form.elements[name].value = form.elements[name].value.trim();
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const payload = {
      nombre: values.get('nombre'), sku: values.get('sku'), categoriaId: Number(values.get('categoriaId')),
      marcaId: Number(values.get('marcaId')), precio: Number(values.get('precio')),
      stockMinimo: Number(values.get('stockMinimo')), activo: values.get('activo') === 'true',
      descripcion: values.get('descripcion')?.trim() || null, imagen: values.get('imagen') || null
    };
    error(''); busy(true);
    try {
      const response = await fetch('/api/productos', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json',
          RequestVerificationToken: values.get('__RequestVerificationToken') }, body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) throw new Error('La sesión venció. Inicia sesión nuevamente.');
        if (response.status >= 500) throw new Error('No se pudo confirmar el registro. Revisa el catálogo por SKU antes de volver a guardar.');
        throw new Error(data.errors ? 'Revisa los campos obligatorios, sus longitudes y los valores numéricos.' : data.title || 'No se pudo guardar el producto. Revisa los datos e inténtalo de nuevo.');
      }
      form.reset(); $('descripcion-conteo').textContent = '0 / 250 caracteres';
      modal.close();
      window.NovaToasts?.show({ status: 'success', title: 'Producto guardado', message: 'El producto se agregó al catálogo correctamente.' });
      document.dispatchEvent(new CustomEvent('nova:producto-creado', { detail: { id: data.id } }));
    } catch (e) {
      error(e instanceof TypeError ? 'Se perdió la conexión. Revisa el catálogo por SKU antes de volver a guardar.' : e.message);
    } finally { busy(false); }
  });
})();
