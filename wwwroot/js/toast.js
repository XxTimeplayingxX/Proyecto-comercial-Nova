(() => {
  const stack = document.querySelector("[data-toast-stack]");
  if (!stack) return;

  const templates = new Map(
    Array.from(document.querySelectorAll("[data-toast-template]"), template =>
      [template.dataset.toastTemplate, template])
  );

  function startToast(toast) {
    const close = toast.querySelector("[data-toast-close]");
    const progress = toast.querySelector("[data-toast-progress]");
    const animation = progress.animate(
      [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }],
      { duration: Number(toast.dataset.toastDuration) * 1000, fill: "forwards" }
    );

    function updateTimer() {
      if (toast.matches(":hover, :focus-within")) animation.pause();
      else animation.play();
    }

    close.hidden = false;
    close.addEventListener("click", () => {
      animation.cancel();
      toast.remove();
    });
    toast.addEventListener("pointerenter", updateTimer);
    toast.addEventListener("pointerleave", updateTimer);
    toast.addEventListener("focusin", updateTimer);
    toast.addEventListener("focusout", () => queueMicrotask(updateTimer));
    animation.finished.then(() => toast.remove(), () => {});
    updateTimer();
  }

  for (const toast of stack.querySelectorAll("[data-toast]")) startToast(toast);

  window.NovaToasts = {
    show({ status = "information", title, message, durationSeconds }) {
      const template = templates.get(status);
      if (!template) return;

      const toast = template.content.firstElementChild.cloneNode(true);
      toast.querySelector("strong").textContent = title;
      toast.querySelector("p").textContent = message;
      if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        toast.dataset.toastDuration = String(durationSeconds);
      }

      stack.append(toast);
      stack.scrollTop = stack.scrollHeight;
      startToast(toast);
    }
  };
})();
