(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('ficha-vendedor');
  const fields = $('ficha-campos');
  const submit = $('ficha-guardar');
  const message = $('ficha-mensaje');
  const id = form.dataset.id;
  const auth = form.dataset.auth === 'true';
  const url = id ? `/api/vendedores/${encodeURIComponent(id)}` : '/api/vendedores/alta';
  const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
  const quantity = new Intl.NumberFormat('es-EC');
  let ready = !id && auth;
  let sending = false;

  function feedback(node, value, error = false) {
    node.textContent = value;
    node.hidden = !value;
    node.toggleAttribute('data-error', error);
    if (error) node.scrollIntoView({ block: 'nearest' });
  }

  async function send(path, method = 'GET', body, token) {
    const response = await fetch(path, {
      method, cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json', RequestVerificationToken: token }
        : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('La sesión venció. Inicia sesión nuevamente.');
    if (response.status === 403) throw new Error(data.title || 'Se requiere un administrador activo.');
    if (response.status === 404) throw new Error('El perfil ya no está disponible.');
    if (!response.ok) throw new Error(data.errors ? 'Revisa los campos y la confirmación de contraseña.' : data.title || 'No se pudo completar la operación.');
    return data;
  }

  function updateState() {
    $('ficha-estado').textContent = form.elements.activo.checked ? 'Activo' : 'Inactivo';
  }

  function readPassword(source) {
    const clave = source.elements.clave.value;
    const confirmacion = source.elements.confirmacion.value;
    if (clave !== confirmacion) throw new Error('Las contraseñas deben coincidir.');
    if (!/[0-9]/.test(clave) || new TextEncoder().encode(clave).length > 72)
      throw new Error('Usa al menos un número y un máximo de 72 bytes.');
    return { clave, confirmacion };
  }

  async function load() {
    feedback(message, 'Cargando perfil…');
    try {
      const profile = await send(url);
      if (profile.id !== id.toLowerCase()) throw new Error('No se pudo identificar el perfil.');
      $('ficha-titulo').textContent = `Editar vendedor: ${profile.nombre} ${profile.apellido}`;
      for (const name of ['nombre', 'apellido', 'email']) form.elements[name].value = profile[name] ?? '';
      form.elements.rol.value = profile.role;
      form.elements.activo.checked = profile.activo;
      updateState();
      $('ficha-desempeno').textContent = `${quantity.format(profile.ventas)} ventas completadas · ${money.format(profile.total)} vendido`;
      $('ficha-ventas').hidden = profile.ventas === 0;
      ready = !profile.propio;
      if (profile.propio) feedback(message, 'Otro administrador debe gestionar esta cuenta.');
      else feedback(message, '');
      fields.disabled = !ready;
      submit.disabled = !ready;
    } catch (error) {
      feedback(message, error.message, true);
    }
  }

  form.elements.activo.addEventListener('change', updateState);
  form.addEventListener('click', event => {
    const button = event.target.closest('[data-ver-clave]');
    if (!button) return;
    const input = $(button.dataset.verClave);
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? 'Ocultar' : 'Ver';
    button.setAttribute('aria-pressed', String(visible));
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || sending) return;
    for (const name of ['nombre', 'apellido', 'email']) form.elements[name].value = form.elements[name].value.trim();
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const payload = { nombre: values.get('nombre'), apellido: values.get('apellido'), email: values.get('email'),
      rol: values.get('rol'), activo: form.elements.activo.checked };
    if (!id) {
      try { Object.assign(payload, readPassword(form), { operacionId: $('ficha-operacion').value }); }
      catch (error) { feedback(message, error.message, true); return; }
    }
    const label = submit.textContent;
    sending = true;
    fields.disabled = submit.disabled = true;
    submit.textContent = 'Guardando…';
    feedback(message, '');
    try {
      const data = await send(id ? `${url}/cuenta` : url, id ? 'PATCH' : 'POST', payload, values.get('__RequestVerificationToken'));
      if (data?.id !== (id || payload.operacionId).toLowerCase()) throw new Error('No se confirmó el cambio.');
      location.assign('/Vendedores');
    } catch (error) {
      const retry = id ? '' : ' Si se interrumpió el alta, vuelve a enviar los mismos datos desde esta ficha.';
      feedback(message, error.message + retry, true);
    } finally {
      fields.disabled = submit.disabled = false;
      sending = false;
      submit.textContent = label;
    }
  });

  const reset = $('ficha-clave-form');
  if (reset) {
    const dialog = $('ficha-clave-modal');
    const resetFields = $('ficha-clave-campos');
    const resetSubmit = dialog.querySelector('[data-modal-submit]');
    const errorNode = $('ficha-clave-error');
    dialog.addEventListener('close', () => { reset.reset(); feedback(errorNode, ''); });
    reset.addEventListener('submit', async event => {
      event.preventDefault();
      if (!ready || resetFields.disabled || !reset.reportValidity()) return;
      let payload;
      try { payload = readPassword(reset); }
      catch (error) { feedback(errorNode, error.message, true); return; }
      const token = new FormData(reset).get('__RequestVerificationToken');
      resetFields.disabled = resetSubmit.disabled = true;
      dialog.dataset.busy = 'true';
      feedback(errorNode, '');
      try {
        await send(`${url}/clave`, 'POST', payload, token);
        dialog.close();
        feedback(message, 'Contraseña actualizada.');
      } catch (error) {
        feedback(errorNode, error.message, true);
      } finally {
        resetFields.disabled = resetSubmit.disabled = false;
        dialog.dataset.busy = 'false';
      }
    });
  }
  if (id) load();
  const receipts = $('ficha-ventas');
  if (receipts) {
    const list = $('ficha-comprobantes');
    const info = $('ficha-comprobantes-mensaje');
    const more = $('ficha-comprobantes-mas');
    const dates = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
    let cursor;
    let loaded = false;
    async function loadReceipts() {
      if (more.disabled) return;
      more.disabled = true;
      info.textContent = 'Consultando comprobantes…';
      try {
        const query = cursor ? `?antesDe=${encodeURIComponent(cursor)}` : '';
        const data = await send(`${url}/comprobantes${query}`);
        loaded = true;
        for (const sale of data.items) {
          const row = document.createElement('li');
          row.textContent = `#${sale.id} · ${dates.format(new Date(sale.fecha))} · ${money.format(sale.total)}`;
          list.append(row);
        }
        cursor = data.siguiente;
        more.hidden = !cursor;
        more.textContent = 'Ver comprobantes anteriores';
        info.textContent = list.children.length ? '' : 'No hay comprobantes completados.';
      } catch (error) {
        info.textContent = error.message;
        more.hidden = false;
        more.textContent = 'Reintentar';
      } finally {
        more.disabled = false;
      }
    }
    receipts.addEventListener('toggle', () => { if (receipts.open && !loaded) loadReceipts(); });
    more.addEventListener('click', loadReceipts);
  }
})();
