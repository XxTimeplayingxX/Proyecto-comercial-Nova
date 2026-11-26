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
  const desktop = window.matchMedia('(min-width: 901px)');
  const root = document.body, sidebar = document.getElementById('workspace-sidebar');
  const toggle = document.getElementById('workspace-sidebar-toggle'), resize = document.getElementById('workspace-resize');
  let width = 216, collapsed = false, dragging = false, frame;
  try {
    const saved = JSON.parse(localStorage.getItem('nova:sidebar') || 'null');
    if (Number.isFinite(saved?.width)) width = Math.max(200, Math.min(340, saved.width));
    collapsed = saved?.collapsed === true;
  } catch { /* Defaults work when browser storage is unavailable. */ }
  function persist() { try { localStorage.setItem('nova:sidebar', JSON.stringify({ width, collapsed })); } catch { } }
  function applySidebar() {
    root.style.setProperty('--sidebar-width', `${width}px`);
    root.classList.toggle('workspace--collapsed', collapsed);
    sidebar.inert = collapsed;
    sidebar.setAttribute('aria-hidden', String(collapsed));
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral');
    toggle.title = collapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral';
    resize.setAttribute('aria-valuenow', String(Math.round(width)));
    resize.tabIndex = collapsed ? -1 : 0;
  }
  if (sidebar && toggle && resize) {
    applySidebar();
    toggle.addEventListener('click', () => { collapsed = !collapsed; applySidebar(); persist(); });
    resize.addEventListener('pointerdown', event => {
      if (!desktop.matches || collapsed || event.button !== 0) return;
      event.preventDefault(); dragging = true;
      root.classList.add('workspace--resizing'); resize.setPointerCapture(event.pointerId);
    });
    resize.addEventListener('pointermove', event => {
      if (!dragging) return;
      const next = Math.max(200, Math.min(340, event.clientX));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { width = next; applySidebar(); });
    });
    function finishResize() { if (dragging) { dragging = false; cancelAnimationFrame(frame); root.classList.remove('workspace--resizing'); persist(); } }
    resize.addEventListener('pointerup', finishResize);
    resize.addEventListener('pointercancel', finishResize);
    resize.addEventListener('lostpointercapture', finishResize);
    resize.addEventListener('dblclick', () => { width = 216; applySidebar(); persist(); });
    resize.addEventListener('keydown', event => {
      const next = { ArrowLeft: width - 16, ArrowRight: width + 16, Home: 200, End: 340 }[event.key];
      if (next === undefined) return;
      event.preventDefault(); width = Math.max(200, Math.min(340, next)); applySidebar(); persist();
    });
    desktop.addEventListener('change', finishResize);
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function animateIcon(link) {
    const icon = link?.querySelector('.nav-icon');
    if (!icon || reducedMotion.matches) return;
    icon.classList.remove('nav-icon--clicked');
    requestAnimationFrame(() => icon.classList.add('nav-icon--clicked'));
    icon.addEventListener('animationend', () => icon.classList.remove('nav-icon--clicked'), { once: true });
  }
  document.querySelectorAll('.workspace__nav a').forEach(link => link.addEventListener('click', event => {
    animateIcon(link);
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      try { sessionStorage.setItem('nova:nav-motion', new URL(link.href).pathname); } catch { }
    }
  }));
  try {
    if (sessionStorage.getItem('nova:nav-motion') === location.pathname) {
      animateIcon(document.querySelector('.workspace__sidebar a[aria-current="page"]'));
      animateIcon(document.querySelector('.workspace__drawer a[aria-current="page"]'));
      sessionStorage.removeItem('nova:nav-motion');
    }
  } catch { }
})();
