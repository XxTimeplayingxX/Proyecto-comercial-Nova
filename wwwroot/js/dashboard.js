(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  if (!$('dashboard')) return;
  const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
  const count = new Intl.NumberFormat('es-EC');
  const date = new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'medium', timeStyle: 'short' });
  const day = new Intl.DateTimeFormat('es-EC', { timeZone: 'UTC', weekday: 'short' });
  const status = value => value === 'completed' ? 'Registrada' : value === 'cancelled' ? 'Anulada' : 'Estado no disponible';
  let period = 'semana', page = 1, totalRows = 0, request, detailRequest;
  const kpis = ['dashboard-total','dashboard-count','dashboard-products','dashboard-low'];
  function node(tag, value, className) {
    const el = document.createElement(tag); el.textContent = value;
    if (className) el.className = className;
    return el;
  }
  async function read(url, signal) {
    const response = await fetch(url, { cache: 'no-store', signal, headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(response.status === 401 ? 'La sesión venció. Inicia sesión nuevamente.'
      : response.status === 403 ? 'Este panel requiere un administrador activo.' : data?.title || 'No se pudo consultar el panel. Intenta nuevamente.');
    return data;
  }
  function emptySales(message) {
    const row = document.createElement('tr'), cell = node('td', message, 'dashboard__placeholder');
    cell.colSpan = 6; row.append(cell); $('dashboard-sales').replaceChildren(row);
  }
  function chart(days) {
    const host = $('dashboard-bars'); host.replaceChildren();
    const maximum = Math.max(1, ...days.map(x => x.amount));
    host.setAttribute('aria-label', days.map(x => `${x.date}: ${money.format(x.amount)}`).join('; '));
    for (const item of days) {
      const bar = node('div', '', 'dashboard__bar'), fill = node('div', '', 'dashboard__bar-fill');
      fill.style.height = `${item.amount / maximum * 100}%`;
      fill.append(node('span', money.format(item.amount), 'dashboard__bar-value'));
      bar.append(fill, node('span', day.format(new Date(`${item.date}T12:00:00Z`)), 'dashboard__bar-day'));
      bar.title = `${item.date}: ${money.format(item.amount)}`; host.append(bar);
    }
  }
  function ranking(items) {
    const host = $('dashboard-top-list'); host.replaceChildren();
    if (!items.length) { host.append(node('p', 'Todavía no hay productos vendidos en este periodo.', 'dashboard__placeholder')); return; }
    const maximum = Math.max(1, ...items.map(x => x.units));
    for (const item of items) {
      const card = node('article', '', 'dashboard__rank'), top = node('div', '', 'dashboard__rank-top');
      const title = node('h3', item.name); title.title = item.name;
      top.append(title, node('small', `${count.format(item.units)} ${item.units === 1 ? 'unidad' : 'unidades'}`));
      const track = node('div', '', 'dashboard__track'), fill = document.createElement('span');
      fill.style.width = `${item.units / maximum * 100}%`; track.append(fill);
      card.append(top, node('p', `${money.format(item.price)} actual · ${item.category || 'Sin categoría'}`), track); host.append(card);
    }
  }
  function sales(items) {
    if (!items.length) { emptySales('No hay ventas en esta página del periodo seleccionado.'); return; }
    $('dashboard-sales').replaceChildren();
    for (const item of items) {
      const row = document.createElement('tr');
      const badge = node('span', status(item.status), `dashboard__status${item.status === 'cancelled' ? ' dashboard__status--cancelled' : ''}`);
      const stateCell = document.createElement('td'); stateCell.append(badge);
      const action = document.createElement('td'), button = node('button', '◎ Ver detalle', 'dashboard__link');
      button.type = 'button'; button.setAttribute('aria-label', `Ver detalle de la venta ${item.id}`);
      button.addEventListener('click', () => detail(item.id)); action.append(button);
      row.append(node('td', `#V-${item.id}`, 'dashboard__code'), node('td', date.format(new Date(item.date))),
        node('td', item.seller), node('td', money.format(item.total), 'dashboard__number'), stateCell, action);
      $('dashboard-sales').append(row);
    }
  }
  function clearData(loading) {
    for (const id of kpis) { $(id).textContent = '—'; $(id).classList.toggle('dashboard__loading', loading); }
    $('dashboard-bars').replaceChildren(node('p', loading ? 'Consultando ventas…' : 'Datos no disponibles', 'dashboard__placeholder'));
    $('dashboard-bars').setAttribute('aria-label', loading ? 'Consultando ventas diarias' : 'Ventas diarias no disponibles');
    $('dashboard-top-list').replaceChildren(node('p', loading ? 'Consultando productos…' : 'Datos no disponibles', 'dashboard__placeholder'));
    emptySales(loading ? 'Consultando ventas…' : 'Datos no disponibles');
    $('dashboard-updated').textContent = loading ? 'Consulta en curso' : 'Sin datos confirmados';
    $('dashboard-pagination-status').textContent = loading ? 'Consultando registros…' : 'No se pudo consultar el periodo';
    $('dashboard-stock-note').textContent = 'Requieren reabastecimiento';
  }
  async function load() {
    request?.abort(); const active = request = new AbortController();
    $('dashboard-error').hidden = true; $('dashboard-content').setAttribute('aria-busy', 'true'); clearData(true);
    $('dashboard-prev').disabled = $('dashboard-next').disabled = true;
    try {
      const data = await read(`/api/dashboard?${new URLSearchParams({ periodo: period, pagina: page })}`, active.signal);
      if (active !== request || active.signal.aborted) return;
      if (!data?.summary || !Array.isArray(data.daily) || data.daily.length !== 7 || !Array.isArray(data.topProducts) || !Array.isArray(data.recentSales))
        throw new Error('El servidor devolvió un panel incompleto. Vuelve a consultar.');
      for (const key of ['salesTotal','salesCount','productsCount','lowStockCount','outOfStockCount'])
        if (!Number.isFinite(data.summary[key]) || data.summary[key] < 0) throw new Error('Los indicadores recibidos no son válidos.');
      $('dashboard-total').textContent = money.format(data.summary.salesTotal);
      $('dashboard-count').textContent = count.format(data.summary.salesCount);
      $('dashboard-products').textContent = count.format(data.summary.productsCount);
      $('dashboard-low').textContent = count.format(data.summary.lowStockCount);
      $('dashboard-stock-note').textContent = `${count.format(data.summary.outOfStockCount)} agotados adicionales`;
      chart(data.daily); ranking(data.topProducts); sales(data.recentSales); totalRows = data.totalRows;
      $('dashboard-updated').textContent = `Consultado: ${date.format(new Date(data.generatedAt))}`;
      $('dashboard-pagination-status').textContent = totalRows ? `Mostrando ${Math.min((page - 1) * 5 + 1, totalRows)}–${Math.min(page * 5, totalRows)} de ${count.format(totalRows)} ventas` : 'Sin ventas en este periodo';
      $('dashboard-page').textContent = String(page);
      $('dashboard-prev').disabled = page <= 1; $('dashboard-next').disabled = page * 5 >= totalRows;
    } catch (error) {
      if (error.name !== 'AbortError' && active === request) {
        clearData(false); $('dashboard-error-text').textContent = error.message; $('dashboard-error').hidden = false;
        $('dashboard-prev').disabled = $('dashboard-next').disabled = true;
      }
    } finally {
      if (active === request) { $('dashboard-content').setAttribute('aria-busy', 'false'); for (const id of kpis) $(id).classList.remove('dashboard__loading'); }
    }
  }
  async function detail(id) {
    detailRequest?.abort(); const active = detailRequest = new AbortController();
    const modal = $('dashboard-sale'), host = $('dashboard-sale-content');
    host.replaceChildren(node('p', 'Consultando venta…')); host.setAttribute('aria-busy', 'true');
    if (!modal.open) modal.showModal();
    try {
      const data = await read(`/api/dashboard/ventas/${encodeURIComponent(id)}`, active.signal);
      if (active !== detailRequest || active.signal.aborted || !modal.open) return;
      if (!data || !Array.isArray(data.items)) throw new Error('El detalle no está disponible.');
      host.replaceChildren(); const list = document.createElement('dl');
      for (const [label,value] of [['Venta',`#V-${data.id}`],['Fecha',date.format(new Date(data.date))],['Vendedor',data.seller],['Cliente',data.customer],['Estado',status(data.status)]])
        list.append(node('dt',label),node('dd',value));
      const table = document.createElement('table'), head = document.createElement('thead'), heading = document.createElement('tr');
      for (const title of ['Producto','Cantidad','Precio de venta','Subtotal']) { const th = node('th',title); th.scope = 'col'; heading.append(th); }
      head.append(heading); const body = document.createElement('tbody');
      for (const item of data.items) { const row = document.createElement('tr'); row.append(node('td',item.name),node('td',count.format(item.quantity)),node('td',money.format(item.price)),node('td',money.format(item.subtotal))); body.append(row); }
      table.append(head,body); host.append(list,table,node('p',`Total: ${money.format(data.total)}`,'dashboard__sale-total'));
    } catch (error) {
      if (error.name !== 'AbortError' && active === detailRequest && modal.open) {
        const retry = node('button','Reintentar consulta'); retry.type = 'button'; retry.addEventListener('click',() => detail(id));
        host.replaceChildren(node('p',error.message),retry);
      }
    } finally { if (active === detailRequest) host.setAttribute('aria-busy','false'); }
  }
  $('dashboard-sale').addEventListener('close',() => detailRequest?.abort());
  $('dashboard-periodos').addEventListener('click', event => {
    const button = event.target.closest('[data-period]'); if (!button || button.dataset.period === period) return;
    period = button.dataset.period; page = 1;
    $('dashboard-periodos').querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed',String(el === button))); load();
  });
  $('dashboard-prev').addEventListener('click',() => { if (page > 1) { page--; load(); } });
  $('dashboard-next').addEventListener('click',() => { if (page * 5 < totalRows) { page++; load(); } });
  $('dashboard-reintentar').addEventListener('click',load); $('dashboard-actualizar').addEventListener('click',load);
  load();
})();
