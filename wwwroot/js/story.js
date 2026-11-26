(() => {
  'use strict';
  const timeline = document.getElementById('story-timeline');
  if (!timeline) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const small = window.matchMedia('(max-width: 700px)');
  const photos = [...document.querySelectorAll('[data-story-parallax]')];
  const chapters = [...timeline.querySelectorAll('.story__milestone')];
  const links = [...document.querySelectorAll('.story__eras a')];
  let frame = 0;
  const clamp = value => Math.max(-1, Math.min(1, value));
  function update() {
    frame = 0;
    const viewport = window.innerHeight;
    const bounds = timeline.getBoundingClientRect();
    const positions = chapters.map(chapter => ({ chapter, bounds: chapter.getBoundingClientRect() }));
    const photoPositions = photos.map(photo => ({ photo, bounds: photo.getBoundingClientRect() }));
    const progress = Math.max(0, Math.min(1, (viewport * .5 - bounds.top) / Math.max(1, bounds.height)));
    timeline.style.setProperty('--story-progress', progress.toFixed(4));
    const current = positions.reduce((nearest, item) => Math.abs(item.bounds.top - viewport * .35) < Math.abs(nearest.bounds.top - viewport * .35) ? item : nearest, positions[0]);
    links.forEach(link => {
      if (link.hash === `#${current.chapter.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    photoPositions.forEach(({ photo, bounds }) => {
      const offset = reduced.matches || small.matches ? 0 : clamp((viewport / 2 - (bounds.top + bounds.height / 2)) / (viewport / 2 + bounds.height / 2)) * 24;
      photo.style.setProperty('--story-shift', `${offset.toFixed(2)}px`);
    });
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  if ('IntersectionObserver' in window && !reduced.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.remove('story-reveal-pending'); observer.unobserve(entry.target); } });
    }, { threshold: .08, rootMargin: '0px 0px 40px 0px' });
    chapters.forEach(chapter => { chapter.classList.add('story-reveal-pending'); observer.observe(chapter); });
    reduced.addEventListener('change', () => { if (reduced.matches) { observer.disconnect(); chapters.forEach(chapter => chapter.classList.remove('story-reveal-pending')); } });
  }
  links.forEach(link => link.addEventListener('click', event => {
    const chapter = document.getElementById(link.hash.slice(1));
    if (!chapter) return;
    event.preventDefault(); chapter.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
    history.replaceState(null, '', link.hash);
  }));
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  reduced.addEventListener('change', schedule); small.addEventListener('change', schedule);
  photos.forEach(photo => photo.querySelector('img')?.addEventListener('load', schedule));
  schedule();
})();
