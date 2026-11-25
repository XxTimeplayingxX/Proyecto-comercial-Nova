(() => {
  'use strict';
  const menu = document.getElementById('workspace-menu');
  const opener = document.getElementById('workspace-menu-abrir');
  if (!menu || !opener) return;
  opener.addEventListener('click', () => {
    if (!menu.open) { menu.showModal(); opener.setAttribute('aria-expanded', 'true'); }
  });
  document.getElementById('workspace-menu-cerrar').addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => opener.setAttribute('aria-expanded', 'false'));
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) menu.close();
    if (event.target === menu) {
      const box = menu.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) menu.close();
    }
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', event => {
    if (event.matches && menu.open) menu.close();
  });
})();
