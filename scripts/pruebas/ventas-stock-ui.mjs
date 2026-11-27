// DOM mínimo simulado: ejecuta ventas.js completo, sin navegador ni red real.
// Desde la raíz, con Node.js >= 20: node scripts/pruebas/ventas-stock-ui.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export async function run(root = fileURLToPath(new URL('../../', import.meta.url))) {
  const source = await readFile(resolve(root, 'wwwroot/js/ventas.js'), 'utf8');
  const passed = [];
  async function setup({ stock = 2, validationStock = stock, final = 'stock', toasts = true } = {}) {
    const nodes = new Map(), created = [], notices = [], requests = [], saved = new Map();
    class Element {
      constructor(tag = 'div') {
        this.tagName = tag; this.children = []; this.events = {}; this.dataset = {};
        this.value = ''; this.className = ''; this.textContent = ''; this.hidden = false;
        this.classList = { toggle() {} }; this.selectedOptions = [{ textContent: 'Consumidor final' }];
        created.push(this);
      }
      set id(value) { this._id = value; nodes.set(value, this); }
      get id() { return this._id; }
      append(...items) { this.children.push(...items); }
      replaceChildren(...items) { this.children = items; }
      setAttribute() {}
      removeAttribute() {}
      addEventListener(name, callback) { this.events[name] = callback; }
      focus() {}
      add(option) { this.children.push(option); }
      querySelector() { return { value: 'csrf-test' }; }
      querySelectorAll() { return []; }
      async fire(name) { await this.events[name]?.({ target: this }); await flush(); }
    }
    const get = id => {
      if (!nodes.has(id)) { const element = new Element(); element.id = id; }
      return nodes.get(id);
    };
    get('punto-venta').dataset.user = 'qa-user';
    const document = {
      getElementById: get, createElement: tag => new Element(tag),
      createDocumentFragment: () => new Element('fragment'), addEventListener() {},
      querySelectorAll: () => created.filter(x => x.className === 'pos-card__add')
    };
    const product = { id: 1, nombre: 'Producto QA', sku: 'QA', stock, precio: 10, estado: 'disponible' };
    const response = (status, body) => ({ status, ok: status < 400, json: async () => body });
    const fetch = async (url, options) => {
      if (!options?.method) {
        if (url.startsWith('/api/ventas/productos')) return response(200, { items: [product], hayMas: false });
        if (url.startsWith('/api/ventas/clientes')) return response(200, []);
        return response(200, { categorias: [] });
      }
      const body = JSON.parse(options.body); requests.push({ url, body });
      if (url.endsWith('/validar')) {
        const quantity = body.items[0].cantidad;
        const valid = quantity <= validationStock;
        return response(valid ? 200 : 409, { valida: valid, items: [{
          productoId: 1, nombre: product.nombre, sku: product.sku, precio: 10, stock: validationStock
        }], errores: valid ? [] : [validationStock === 0 ? 'Producto QA no tiene existencias. No se puede vender.'
          : 'Stock insuficiente para Producto QA: solicitaste 3 y hay 2 unidades disponibles.'] });
      }
      if (final === 'network') throw new Error('Conexión interrumpida');
      return response(409, { code: 'INSUFFICIENT_STOCK', title: 'Las existencias cambiaron. Revisa las cantidades.' });
    };
    const context = {
      document, window: toasts ? { NovaToasts: { show: value => notices.push(value) } } : {},
      fetch, Option: class extends Element { constructor(label, value) { super('option'); this.textContent = label; this.value = value; } },
      location: { origin: 'http://qa.invalid' }, Intl, URL, URLSearchParams, AbortController,
      crypto: { randomUUID }, setTimeout, clearTimeout,
      sessionStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) }
    };
    vm.runInNewContext(source, context, { filename: 'ventas.js' });
    await flush();
    const add = created.find(x => x.className === 'pos-card__add');
    return { get, add, notices, requests, saved };
  }
  async function flush() { await new Promise(done => setImmediate(done)); }
  async function addAndValidate(ui) { await ui.add.fire('click'); await ui.get('venta-validar').fire('click'); }

  const empty = await setup({ stock: 0 });
  assert.equal(empty.add.disabled, true); assert.equal(empty.add.textContent, 'Sin stock');
  passed.push('Stock cero: botón deshabilitado');

  const quantity = await setup();
  await quantity.add.fire('click');
  const input = quantity.get('venta-cantidad-1'); input.value = '3'; await input.fire('change');
  assert.match(quantity.notices.at(-1).message, /solicitaste 3 y hay 2/);
  assert.equal(quantity.get('pedido-unidades').textContent, '1 unidad');
  assert.equal(quantity.requests.length, 0);
  input.value = '1.5'; await input.fire('change');
  assert.match(quantity.notices.at(-1).message, /entero mayor que cero/);
  passed.push('Tres con stock dos y cantidad decimal: toast, carrito conservado y sin POST');

  const stale = await setup({ validationStock: 0 });
  await addAndValidate(stale);
  assert.match(stale.notices.at(-1).message, /no tiene existencias/);
  assert.equal(stale.get('venta-confirmar').disabled, true);
  assert.equal(stale.notices.at(-1).status, 'warning');
  passed.push('Validación 409 por stock agotado: toast y confirmación bloqueada');

  const race = await setup();
  await addAndValidate(race);
  await race.get('venta-confirmar').fire('click');
  assert.equal(race.notices.at(-1).title, 'Venta rechazada por falta de stock');
  assert.equal(race.saved.size, 0); assert.equal(race.get('venta-confirmar').disabled, true);
  passed.push('RPC 409 después de validar: toast y pedido exige nueva validación');

  const network = await setup({ final: 'network' });
  await addAndValidate(network); await network.get('venta-confirmar').fire('click');
  assert.equal(network.saved.size, 1);
  await network.get('venta-confirmar').fire('click');
  const writes = network.requests.filter(x => x.url === '/api/ventas');
  assert.equal(writes.length, 2); assert.deepEqual(writes[0].body, writes[1].body);
  assert.equal(network.requests.filter(x => x.url.endsWith('/validar')).length, 1);
  passed.push('Resultado incierto: conserva UUID/cuerpo y reintenta sin prevalidar');

  const fallback = await setup({ validationStock: 0, toasts: false });
  await addAndValidate(fallback);
  assert.match(fallback.get('venta-mensaje').textContent, /no tiene existencias/);
  passed.push('Sin servicio de toasts: permanece mensaje junto al carrito');
  return passed;
}
if (typeof process !== 'undefined' && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const result of await run()) console.log('OK: ' + result);
}

