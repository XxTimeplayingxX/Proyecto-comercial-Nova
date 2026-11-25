(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const modal = $('nuevo-producto'), form = $('producto-form');
  const submit = modal.querySelector('[data-modal-submit]');
  let catalogsReady = false, saving = false, editingId = null, loadRequest;
  let selectedFile = null, localPreview = null;
  function clearFile() {
    selectedFile = null;
    if (localPreview) URL.revokeObjectURL(localPreview);
    localPreview = null; $('producto-archivo').value = '';
    $('producto-archivo-estado').hidden = true;
  }
  function error(message) {
    const box = $('producto-form-error');
    box.textContent = message; box.hidden = !message;
    if (message && modal.open) box.focus();
  }
  function validImage(value) {
    if (!value) return true;
    if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true;
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }
  function preview() {
    const value = $('producto-imagen').value.trim(), img = $('producto-imagen-preview');
    $('producto-imagen-error').hidden = true; $('producto-quitar-imagen').hidden = !value && !selectedFile;
    img.hidden = true; img.removeAttribute('src'); $('producto-imagen-icono').hidden = false;
    if (localPreview || value && validImage(value)) {
      img.src = localPreview || value; img.hidden = false; $('producto-imagen-icono').hidden = true;
    }
  }
  async function read(url, signal) {
    const response = await fetch(url, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('La sesión venció. Inicia sesión nuevamente.');
    if (!response.ok) throw new Error(data.title || 'No se pudieron cargar los datos. Cierra y vuelve a abrir el formulario para reintentar.');
    return data;
  }
  async function open(id = null) {
    if (saving) return;
    loadRequest?.abort(); loadRequest = new AbortController();
    const request = loadRequest;
    editingId = id; clearFile(); form.reset(); error('');
    $('producto-imagen').setCustomValidity('');
    $('producto-sku').readOnly = id !== null; $('generar-sku').hidden = id !== null;
    $('producto-sku-ayuda').textContent = id === null ? 'Identificador único del producto en el catálogo.' : 'El código SKU se conserva para identificar este producto.';
    $('nuevo-producto-titulo').textContent = id === null ? 'Nuevo producto' : 'Editar producto';
    modal.querySelector('.nova-modal__eyebrow').textContent = id === null ? 'Catálogo / Agregar producto' : 'Catálogo / Editar producto';
    $('nuevo-producto-descripcion').textContent = id === null ? 'Registra un producto en el catálogo comercial de Nova.' : 'Actualiza la información comercial del producto y su imagen.';
    $('producto-stock-label').textContent = id === null ? 'Stock inicial' : 'Stock actual';
    $('producto-inventario-nota').textContent = id === null ? 'El producto se crea sin existencias. Los movimientos de stock se registran por separado.' : 'Las existencias son de solo lectura. Las entradas y salidas se registran mediante ajustes de inventario.';
    $('descripcion-conteo').textContent = '0 / 250 caracteres'; preview();
    catalogsReady = false; submit.disabled = true;
    submit.textContent = id === null ? 'Guardar producto' : 'Guardar cambios';
    $('producto-campos').disabled = true; $('producto-carga').hidden = false;
    form.setAttribute('aria-busy', 'true');
    if (!modal.open) modal.showModal();
    for (const id of ['producto-marca', 'producto-categoria']) {
      $(id).disabled = true; $(id).setAttribute('aria-busy', 'true');
    }
    try {
      const [data, product] = await Promise.all([
        read('/api/productos/filtros?activos=true', request.signal),
        id === null ? Promise.resolve(null) : read(`/api/productos/${id}`, request.signal)
      ]);
      if (loadRequest !== request || request.signal.aborted) return;
      for (const [field, items, label, currentId, currentName] of [
        ['producto-marca', data.marcas, 'Selecciona una marca…', product?.marcaId, product?.marca?.name],
        ['producto-categoria', data.categorias, 'Selecciona una categoría…', product?.categoriaId, product?.categoria?.name]
      ]) {
        $(field).replaceChildren(new Option(label, ''), ...items.map(item => new Option(item.name, item.id)));
        if (currentId && !items.some(item => String(item.id) === String(currentId))) $(field).add(new Option(`${currentName || 'Opción actual'} (actual)`, currentId));
        $(field).value = currentId ? String(currentId) : ''; $(field).disabled = false;
      }
      if (!$('producto-marca').options[1] || !$('producto-categoria').options[1]) throw new Error('Debe existir al menos una marca y una categoría para guardar el producto.');
      if (product) {
        $('nuevo-producto-titulo').textContent = `Editar producto: ${product.nombre}`;
        for (const [name, value] of Object.entries({ nombre: product.nombre, sku: product.sku, precio: product.precio,
          stockMinimo: product.stockMinimo, descripcion: product.descripcion || '', imagen: product.imagen || '' })) form.elements[name].value = value;
        form.elements.activo.value = String(product.activo); $('producto-stock').value = product.stock;
        $('descripcion-conteo').textContent = `${$('producto-descripcion').value.length} / 250 caracteres`; preview();
      }
      catalogsReady = true;
    } catch (e) { if (e.name !== 'AbortError' && loadRequest === request) error(e.message); }
    finally {
      if (loadRequest === request) {
        for (const field of ['producto-marca', 'producto-categoria']) $(field).setAttribute('aria-busy', 'false');
        $('producto-carga').hidden = true; form.setAttribute('aria-busy', 'false');
        $('producto-campos').disabled = !catalogsReady; submit.disabled = !catalogsReady || saving;
        if (catalogsReady && modal.open) $('producto-nombre').focus();
      }
    }
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-modal-open="nuevo-producto"]')) open();
  });
  document.addEventListener('nova:editar-producto', event => open(event.detail.id));
  modal.addEventListener('close', () => { if (!saving) { loadRequest?.abort(); clearFile(); } });
  $('producto-imagen-preview').addEventListener('error', () => {
    if (!$('producto-imagen').value.trim() && !selectedFile) return;
    $('producto-imagen-preview').hidden = true; $('producto-imagen-icono').hidden = false;
    $('producto-imagen-error').hidden = false;
  });
  $('producto-imagen').addEventListener('input', () => { clearFile(); $('producto-imagen').setCustomValidity(''); });
  $('producto-imagen').addEventListener('change', preview);
  $('producto-quitar-imagen').addEventListener('click', () => {
    clearFile(); $('producto-imagen').value = ''; $('producto-imagen').setCustomValidity(''); preview();
  });
  $('producto-archivo').addEventListener('change', () => {
    const file = $('producto-archivo').files[0];
    if (!file) { clearFile(); preview(); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
      clearFile(); preview(); error('Selecciona una imagen JPEG, PNG o WebP de hasta 5 MB.'); return;
    }
    clearFile(); selectedFile = file; localPreview = URL.createObjectURL(file);
    $('producto-imagen').value = ''; $('producto-imagen').setCustomValidity('');
    $('producto-archivo-estado').textContent = `${file.name} · ${(file.size / 1024).toFixed(0)} KB · Pendiente de subir`;
    $('producto-archivo-estado').hidden = false; error(''); preview();
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
    submit.textContent = value ? 'Guardando…' : editingId === null ? 'Guardar producto' : 'Guardar cambios';
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !catalogsReady) return;
    for (const name of ['nombre', 'sku', 'imagen']) form.elements[name].value = form.elements[name].value.trim();
    $('producto-imagen').setCustomValidity(validImage($('producto-imagen').value) ? '' : 'Usa una URL HTTPS válida.');
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const payload = {
      nombre: values.get('nombre'), sku: values.get('sku'), categoriaId: Number(values.get('categoriaId')),
      marcaId: Number(values.get('marcaId')), precio: Number(values.get('precio')),
      stockMinimo: Number(values.get('stockMinimo')), activo: values.get('activo') === 'true',
      descripcion: values.get('descripcion')?.trim() || null, imagen: values.get('imagen') || null
    };
    const id = editingId;
    error(''); busy(true);
    try {
      if (selectedFile) {
        submit.textContent = 'Subiendo imagen…';
        const uploadBody = new FormData(); uploadBody.append('archivo', selectedFile);
        const upload = await fetch('/api/productos/imagen', { method: 'POST',
          headers: { Accept: 'application/json', RequestVerificationToken: values.get('__RequestVerificationToken') }, body: uploadBody });
        const uploaded = await upload.json().catch(() => ({}));
        if (!upload.ok) throw new Error(upload.status === 401 ? 'La sesión venció. Inicia sesión nuevamente.' : uploaded.title || 'No se pudo subir la imagen. El producto no se guardó.');
        if (!uploaded.url || !validImage(uploaded.url)) throw new Error('Storage no confirmó una URL de imagen válida.');
        payload.imagen = uploaded.url;
        $('producto-imagen').value = uploaded.url; clearFile(); preview();
        submit.textContent = 'Guardando producto…';
      }
      const response = await fetch(id === null ? '/api/productos' : `/api/productos/${id}`, {
        method: id === null ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json',
          RequestVerificationToken: values.get('__RequestVerificationToken') }, body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) throw new Error('La sesión venció. Inicia sesión nuevamente.');
        if (response.status >= 500) throw new Error('No se pudo confirmar el registro. Revisa el catálogo por SKU antes de volver a guardar.');
        throw new Error(data.errors ? 'Revisa los campos obligatorios, sus longitudes y los valores numéricos.' : data.title || 'No se pudo guardar el producto. Revisa los datos e inténtalo de nuevo.');
      }
      clearFile(); form.reset(); $('descripcion-conteo').textContent = '0 / 250 caracteres';
      modal.close();
      window.NovaToasts?.show({ status: 'success', title: id === null ? 'Producto guardado' : 'Producto actualizado', message: id === null ? 'El producto se agregó al catálogo correctamente.' : 'Los cambios se guardaron correctamente.' });
      document.dispatchEvent(new CustomEvent(id === null ? 'nova:producto-creado' : 'nova:producto-editado', { detail: { id: data.id } }));
    } catch (e) {
      error(e instanceof TypeError ? 'Se perdió la conexión. Revisa el catálogo por SKU antes de volver a guardar.' : e.message);
    } finally { busy(false); }
  });
})();
