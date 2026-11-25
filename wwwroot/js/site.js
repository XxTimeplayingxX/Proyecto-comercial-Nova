const heading = document.querySelector(".welcome h1");

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  heading.animate(
    [{ opacity: 0.65, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }],
    { duration: 320, easing: "ease-out" }
  );
}
