(() => {
  'use strict';
  // Native dialog supplies focus trapping, Escape, and focus restoration.
  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-modal-open]');
    if (opener) {
      const modal = document.getElementById(opener.dataset.modalOpen);
      if (modal && !modal.open) modal.showModal();
    }
    const closer = event.target.closest('[data-modal-close]');
    if (closer) {
      const modal = closer.closest('[data-modal]');
      if (modal?.dataset.busy !== 'true') modal?.close();
    }
  });
  document.querySelectorAll('[data-modal]').forEach(modal => {
    modal.addEventListener('cancel', event => {
      if (modal.dataset.busy === 'true') event.preventDefault();
    });
  });
})();
