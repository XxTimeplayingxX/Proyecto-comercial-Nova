const loginForm = document.querySelector(".login-form");
const passwordToggle = loginForm.querySelector("[data-password-toggle]");
const passwordInput = document.getElementById(passwordToggle.getAttribute("aria-controls"));
const submitButton = loginForm.querySelector("[type='submit']");
const submitLabel = submitButton.querySelector("[data-submit-label]");

passwordToggle.hidden = false;
passwordToggle.addEventListener("click", () => {
  const showPassword = passwordInput.type === "password";
  passwordInput.type = showPassword ? "text" : "password";
  passwordToggle.setAttribute("aria-pressed", String(showPassword));
  passwordToggle.setAttribute("aria-label", showPassword ? "Ocultar contraseña" : "Mostrar contraseña");
});

loginForm.addEventListener("submit", () => {
  passwordInput.type = "password";
  passwordToggle.setAttribute("aria-pressed", "false");
  passwordToggle.setAttribute("aria-label", "Mostrar contraseña");
  submitButton.disabled = true;
  submitLabel.textContent = "Iniciando sesión…";
});

window.addEventListener("pageshow", () => {
  submitButton.disabled = false;
  submitLabel.textContent = "Iniciar sesión";
});
