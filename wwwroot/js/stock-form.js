(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const modal = $('agregar-stock');
  const form = $('stock-form');
  const fields = $('stock-campos');
  const quantity = $('stock-cantidad');
  const submit = modal.querySelector('[data-modal-submit]');
  const closers = modal.querySelectorAll('[data-modal-close]');
  const numbers = new Intl.NumberFormat('es-EC');
  const maxStock = 2147483647;
  let product;
  let saving = false;
  let uncertain = false;

  const units = count => `${numbers.format(count)} ${count === 1 ? 'unidad' : 'unidades'}`;

  function showError(message) {
    const error = $('stock-error');
    error.textContent = message;
    error.hidden = !message;
    if (message) error.scrollIntoView({ block: 'nearest' });
  }

  function renderQuantity() {
    const count = quantity.valueAsNumber;
    const valid = quantity.validity.valid;
    $('stock-ingreso').textContent = valid ? `+${units(count)}` : '—';
    $('stock-estimado').textContent = valid ? units(product.stock + count) : '—';
  }

  function updateControls() {
    modal.dataset.busy = String(saving);
    fields.setAttribute('aria-busy', String(saving));
    fields.disabled = saving || uncertain || product.stock >= maxStock;
    submit.disabled = fields.disabled;
    closers.forEach(button => { button.disabled = saving; });
    submit.textContent = saving ? 'Registrando…' : 'Confirmar ingreso';
  }

  function unconfirmed() {
    uncertain = true;
    showError('No se pudo confirmar el ingreso. Verifica el movimiento en el historial de inventario antes de volver a registrarlo.');
    document.dispatchEvent(new Event('nova:stock-actualizado'));
  }

  document.addEventListener('nova:agregar-stock', event => {
    if (modal.open || saving) return;
    const { product: selected, thumbnail, status, price } = event.detail;
    product = selected;
    uncertain = false;
    form.reset();
    $('stock-imagen').replaceChildren(thumbnail);
    $('stock-estado').replaceChildren(status);
    $('stock-producto').textContent = product.nombre;
    $('stock-sku').textContent = `SKU: ${product.sku}`;
    $('stock-categoria').textContent = `Categoría: ${product.categoria?.name ?? 'Sin categoría'}`;
    $('stock-marca').textContent = `Marca: ${product.marca?.name ?? 'Sin marca'}`;
    $('stock-precio').textContent = `Precio: ${price}`;
    $('stock-actual').textContent = units(product.stock);
    quantity.max = String(maxStock - product.stock);
    showError('');
    renderQuantity();
    updateControls();
    modal.showModal();
    if (fields.disabled) {
      showError('El producto ya alcanzó el stock máximo admitido.');
    } else {
      quantity.focus();
      quantity.select();
    }
  });

  quantity.addEventListener('input', renderQuantity);
  fields.addEventListener('click', event => {
    const step = event.target.closest('[data-stock-step]');
    if (!step) return;
    const current = Number.isInteger(quantity.valueAsNumber) ? quantity.valueAsNumber : 0;
    quantity.value = Math.max(1, Math.min(Number(quantity.max), current + Number(step.dataset.stockStep)));
    renderQuantity();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!modal.open || fields.disabled || !form.reportValidity()) return;
    const values = new FormData(form);
    const payload = {
      cantidad: quantity.valueAsNumber,
      motivo: values.get('motivo'),
      puntoIngreso: values.get('puntoIngreso').trim() || null,
      observaciones: values.get('observaciones').trim() || null
    };
    showError('');
    saving = true;
    updateControls();
    try {
      const response = await fetch(`/api/productos/${product.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json',
          RequestVerificationToken: values.get('__RequestVerificationToken') },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        showError('La sesión venció. Inicia sesión nuevamente.');
      } else if (response.status >= 500) {
        unconfirmed();
      } else if (!response.ok) {
        showError(data.errors ? 'Revisa la cantidad y los campos del ingreso.'
          : data.title || 'No se pudo registrar el ingreso. Actualiza el catálogo y vuelve a abrir el formulario.');
      } else if (data.id !== product.id || !Number.isInteger(data.stock) || data.stock < payload.cantidad) {
        unconfirmed();
      } else {
        modal.close();
        window.NovaToasts?.show({ status: 'success', title: 'Ingreso registrado',
          message: `${product.nombre} quedó con ${units(data.stock)} en inventario.` });
        document.dispatchEvent(new Event('nova:stock-actualizado'));
      }
    } catch {
      unconfirmed();
    } finally {
      saving = false;
      updateControls();
    }
  });
})();
