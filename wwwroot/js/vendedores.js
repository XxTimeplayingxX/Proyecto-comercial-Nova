(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const add = $('vendedor-nuevo');
  const search = $('vendedores-buscar');
  const table = $('vendedores-tabla');
  const retry = $('vendedores-reintentar');
  const message = $('vendedores-mensaje');
  const modal = $('vendedor-modal');
  const form = $('vendedor-form');
  const fields = $('vendedor-campos');
  const submit = modal.querySelector('[data-modal-submit]');
  const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
  const integers = new Intl.NumberFormat('es-EC');
  const columns = ['Vendedor', 'Correo electrónico', 'Rol', 'Ventas realizadas', 'Total vendido', 'Estado', 'Acciones'];
  const icons = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></svg>',
    active: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m6 6 12 12"/></svg>',
    inactive: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m8 12 3 3 5-6"/></svg>'
  };
  let profiles = [];
  let selected;
  let saving = false;
  let pendingLink = new URLSearchParams(location.search).get('vincular') === 'true';

  function text(tag, value, cls) {
    const node = document.createElement(tag);
    node.textContent = value;
    if (cls) node.className = cls;
    return node;
  }

  const fullName = profile => `${profile.nombre} ${profile.apellido}`.trim();
  const simplify = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es').trim();
  const actionText = () => selected ? 'Guardar cambios' : 'Vincular vendedor';

  function renderRow(profile) {
    const row = document.createElement('tr');
    const admin = profile.role === 'admin';
    const name = fullName(profile);
    const identity = text('div', '', 'vendedores__identity');
    const initials = [profile.nombre, profile.apellido].map(part => Array.from(part.trim())[0] ?? '').join('').toLocaleUpperCase('es');
    const avatar = text('span', initials, admin ? 'vendedores__avatar vendedores__avatar--admin' : 'vendedores__avatar');
    avatar.setAttribute('aria-hidden', 'true');
    identity.append(avatar, text('span', name));
    row.insertCell().append(identity);
    row.append(text('td', profile.email || 'Sin correo'), document.createElement('td'),
      text('td', integers.format(profile.ventas), 'numero'), text('td', currency.format(profile.total), 'numero'));
    row.cells[2].append(text('span', admin ? 'Administrador' : 'Vendedor',
      admin ? 'vendedores__role vendedores__role--admin' : 'vendedores__role'));
    row.insertCell().append(text('span', profile.activo ? 'Activo' : 'Inactivo', profile.activo ? 'estado estado--activo' : 'estado'));
    const actions = row.insertCell();
    if (!profile.propio) {
      const buttons = text('div', '', 'vendedores__actions');
      const edit = text('a', '', 'producto__accion');
      edit.href = `/Vendedores/Editar/${profile.id}`;
      edit.title = 'Editar vendedor';
      edit.setAttribute('aria-label', `Editar vendedor: ${name}`);
      edit.innerHTML = icons.edit;
      buttons.append(edit);
      if (profile.role === 'seller') {
        const label = profile.activo ? 'Desactivar vendedor' : 'Activar vendedor';
        const button = text('button', '', 'producto__accion');
        button.type = 'button';
        button.title = label;
        button.setAttribute('aria-label', `${label}: ${name}`);
        button.innerHTML = icons[profile.activo ? 'active' : 'inactive'];
        button.addEventListener('click', () => openForm(profile, true));
        buttons.append(button);
      }
      actions.append(buttons);
    } else {
      actions.textContent = '—';
    }
    columns.forEach((label, index) => { row.cells[index].dataset.label = label; });
    return row;
  }

  function renderList() {
    const query = simplify(search.value);
    const matches = profiles.filter(profile =>
      simplify(fullName(profile)).includes(query) || simplify(profile.email ?? '').includes(query));
    $('vendedores-filas').replaceChildren(...matches.map(renderRow));
    table.hidden = matches.length === 0;
    message.hidden = matches.length > 0;
    message.textContent = query ? 'No hay perfiles que coincidan con la búsqueda.' : 'Todavía no hay perfiles comerciales.';
  }

  async function responseData(response) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('La sesión venció. Inicia sesión nuevamente.');
    if (response.status === 403) throw new Error('Se requiere un administrador activo.');
    if (!response.ok) throw new Error(data.errors ? 'Revisa los datos del formulario.' : data.title || 'No se pudo completar la solicitud.');
    return data;
  }

  async function load() {
    add.disabled = true;
    search.disabled = true;
    retry.hidden = true;
    $('vendedores-kpis').setAttribute('aria-busy', 'true');
    $('vendedores-listado').setAttribute('aria-busy', 'true');
    try {
      const data = await responseData(await fetch('/api/vendedores', { headers: { Accept: 'application/json' }, cache: 'no-store' }));
      profiles = data.items;
      document.querySelectorAll('[data-vendedor-kpi]').forEach(node => {
        node.textContent = integers.format(data[node.dataset.vendedorKpi]);
      });
      renderList();
      add.disabled = false;
      search.disabled = false;
      if (pendingLink) {
        pendingLink = false;
        openForm(null);
      }
    } catch (error) {
      profiles = [];
      $('vendedores-filas').replaceChildren();
      document.querySelectorAll('[data-vendedor-kpi]').forEach(node => { node.textContent = '—'; });
      table.hidden = true;
      message.hidden = false;
      message.textContent = `No se pudo cargar el directorio. ${error.message}`;
      retry.hidden = false;
    } finally {
      $('vendedores-kpis').setAttribute('aria-busy', 'false');
      $('vendedores-listado').setAttribute('aria-busy', 'false');
    }
  }

  function showError(value) {
    const node = $('vendedor-error');
    node.hidden = !value;
    node.textContent = value;
  }

  function openForm(profile, changeStatus = false) {
    if (saving || modal.open) return;
    selected = profile;
    form.reset();
    showError('');
    $('vendedor-cuenta').hidden = !!profile;
    $('vendedor-usuario').disabled = !!profile;
    $('vendedor-estado').hidden = !profile;
    $('vendedor-modal-titulo').textContent = profile ? 'Editar vendedor' : 'Agregar vendedor';
    $('vendedor-modal-descripcion').textContent = profile
      ? profile.email || fullName(profile) : 'Vincula una cuenta de Supabase Auth con su perfil comercial.';
    if (profile) {
      $('vendedor-nombre').value = profile.nombre;
      $('vendedor-apellido').value = profile.apellido;
      $('vendedor-activo').checked = changeStatus ? !profile.activo : profile.activo;
    }
    submit.textContent = actionText();
    modal.showModal();
    $(changeStatus ? 'vendedor-activo' : profile ? 'vendedor-nombre' : 'vendedor-usuario').focus();
  }

  function busy(value) {
    saving = value;
    modal.dataset.busy = String(value);
    fields.disabled = value;
    submit.disabled = value;
    modal.querySelectorAll('[data-modal-close]').forEach(button => { button.disabled = value; });
    submit.textContent = value ? 'Guardando…' : actionText();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !modal.open) return;
    for (const field of ['vendedor-nombre', 'vendedor-apellido']) $(field).value = $(field).value.trim();
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const payload = { nombre: values.get('nombre'), apellido: values.get('apellido') };
    if (selected) payload.activo = $('vendedor-activo').checked;
    else payload.usuarioId = values.get('usuario');
    showError('');
    busy(true);
    try {
      const response = await fetch(selected ? `/api/vendedores/${selected.id}` : '/api/vendedores', {
        method: selected ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json',
          RequestVerificationToken: values.get('__RequestVerificationToken') },
        body: JSON.stringify(payload)
      });
      if (response.status >= 500) throw new Error('No se confirmó el cambio. Cierra el formulario y verifica el directorio.');
      const data = await responseData(response);
      if (data.id !== (selected?.id || payload.usuarioId.toLowerCase())) {
        throw new Error('No se confirmó el cambio. Cierra el formulario y verifica el directorio.');
      }
      modal.close();
      window.NovaToasts?.show({ status: 'success', title: selected ? 'Perfil actualizado' : 'Vendedor vinculado',
        message: selected ? 'Se guardaron los cambios del vendedor.' : 'Ya puede iniciar sesión con su cuenta de Supabase Auth.' });
      load();
    } catch (error) {
      showError(error instanceof TypeError ? 'Se perdió la conexión. Verifica el directorio antes de repetir el cambio.' : error.message);
    } finally {
      busy(false);
    }
  });
  search.addEventListener('input', renderList);
  retry.addEventListener('click', load);
  add.addEventListener('click', () => openForm(null));
  modal.addEventListener('close', () => { if (!$('vendedor-error').hidden) load(); });
  load();
})();
