(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = document.body, logoutForm = $('workspace-session-logout'), idle = $('workspace-idle');
  if (!logoutForm || !idle || !root.dataset.sessionUser) return;
  const account = $('workspace-account'), profile = $('workspace-profile'), continueButton = $('workspace-idle-continue');
  const token = logoutForm.querySelector('[name="__RequestVerificationToken"]').value;
  const warningMs = Number(root.dataset.idleWarning) * 1000, timeoutMs = Number(root.dataset.idleTimeout) * 1000;
  let offset = Number(root.dataset.sessionNow) * 1000 - Date.now();
  const now = () => Date.now() + offset;
  let expires = Number(root.dataset.sessionExpires) * 1000, lastActivity = Number(root.dataset.sessionLastActivity) * 1000;
  let ended = false, activityFlight = null, lastPost = 0, trailing, lastBroadcast = 0;
  let channel;
  try { channel = new BroadcastChannel(`nova:session:${root.dataset.sessionUser}`); } catch { }
  function broadcast(type) { channel?.postMessage({ type, at: lastActivity }); }
  function logout(notify = true) {
    if (ended) return;
    ended = true; continueButton.disabled = true;
    if (notify) broadcast('logout');
    // Keep pending sale recovery in sessionStorage; this only terminates the web session.
    logoutForm.requestSubmit();
  }
  function closeProfile(focus = false) {
    if (!profile) return;
    profile.hidden = true; account?.setAttribute('aria-expanded', 'false');
    if (focus) account?.focus();
  }
  function updateExpiry() {
    const seconds = Math.max(0, Math.ceil((expires - now()) / 1000));
    $('workspace-profile-expiry')?.replaceChildren(document.createTextNode(`${Math.floor(seconds / 60)} min ${seconds % 60} s`));
  }
  async function loadProfile() {
    $('workspace-profile-status').textContent = 'Consultando información…'; $('workspace-profile-retry').hidden = true;
    try {
      const response = await fetch('/api/sesion', { cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) { logout(); return; }
      if (!response.ok) throw new Error(data.title || 'No se pudo consultar tu perfil.');
      offset = data.ahora * 1000 - Date.now(); expires = data.venceEn * 1000;
      lastActivity = Math.max(lastActivity, data.ultimaActividad * 1000);
      $('workspace-profile-name').textContent = data.nombre || 'Sin registrar';
      $('workspace-profile-lastname').textContent = data.apellido || 'Sin registrar';
      $('workspace-profile-role').textContent = data.rol === 'admin' ? 'Administrador' : 'Vendedor';
      $('workspace-profile-token').textContent = data.tokenDuracionSegundos
        ? `${data.tokenDuracionSegundos / 60} minutos al iniciar sesión`
        : 'Disponible al volver a iniciar sesión';
      $('workspace-profile-status').textContent = 'Datos de tu perfil comercial activo.'; updateExpiry();
    } catch (error) { $('workspace-profile-status').textContent = error.message; $('workspace-profile-retry').hidden = false; }
  }
  account?.addEventListener('click', () => {
    if (!profile.hidden) { closeProfile(); return; }
    profile.hidden = false; account.setAttribute('aria-expanded', 'true'); $('workspace-profile-title').focus(); loadProfile();
  });
  $('workspace-profile-retry')?.addEventListener('click', loadProfile);
  document.addEventListener('click', event => { if (!event.target.closest('.workspace__account-wrap')) closeProfile(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && profile && !profile.hidden) { event.preventDefault(); closeProfile(true); } });

  function touch() {
    if (ended) return Promise.resolve(false);
    if (activityFlight) return activityFlight;
    if (now() >= expires || now() - lastActivity >= timeoutMs) { logout(); return Promise.resolve(false); }
    lastPost = now();
    activityFlight = (async () => {
      try {
        const response = await fetch('/api/sesion/actividad', { method: 'POST', cache: 'no-store', headers: { RequestVerificationToken: token, Accept: 'application/json' } });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) { logout(); return false; }
        if (!response.ok) throw new Error('No se pudo comprobar la sesión. Inténtalo antes de que termine el plazo.');
        offset = data.ahora * 1000 - Date.now(); expires = data.venceEn * 1000;
        lastActivity = Math.max(lastActivity, data.ultimaActividad * 1000);
        broadcast('activity'); return true;
      } catch (error) {
        if (idle.open) { $('workspace-idle-error').textContent = error.message; $('workspace-idle-error').hidden = false; }
        return false;
      } finally { activityFlight = null; }
    })();
    return activityFlight;
  }
  function noteActivity(event) {
    if (!event.isTrusted || ended || idle.open) return;
    if (now() >= expires || now() - lastActivity >= timeoutMs) { logout(); return; }
    lastActivity = now();
    if (now() - lastPost >= 15000) touch();
    clearTimeout(trailing); trailing = setTimeout(touch, 1000);
    if (now() - lastBroadcast >= 1000) { broadcast('activity'); lastBroadcast = now(); }
  }
  for (const event of ['pointerdown', 'pointermove', 'keydown', 'scroll', 'wheel']) document.addEventListener(event, noteActivity, { passive: true, capture: true });
  idle.addEventListener('cancel', event => event.preventDefault());
  continueButton.addEventListener('click', async () => {
    continueButton.disabled = true; $('workspace-idle-error').hidden = true;
    if (await touch()) {
      lastActivity = now(); broadcast('activity'); idle.close();
    }
    continueButton.disabled = false;
  });
  if (channel) channel.onmessage = event => {
    if (event.data?.type === 'logout') { logout(false); return; }
    if (event.data?.type === 'activity' && Number.isFinite(event.data.at) && event.data.at <= now() + 5000) {
      lastActivity = Math.max(lastActivity, event.data.at);
      if (idle.open) idle.close();
    }
  };
  function tick() {
    if (ended || !Number.isFinite(expires) || expires <= 0) return;
    const remaining = Math.min(expires - now(), timeoutMs - (now() - lastActivity));
    if (remaining <= 0) { logout(); return; }
    if (now() - lastActivity >= warningMs && !idle.open) {
      closeProfile(); $('workspace-idle-error').hidden = true; idle.showModal();
    }
    if (idle.open) $('workspace-idle-countdown').textContent = `La sesión se cerrará en ${Math.ceil(remaining / 1000)} segundos.`;
    if (profile && !profile.hidden) updateExpiry();
  }
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('focus', tick);
  setInterval(tick, 1000); tick();
})();
