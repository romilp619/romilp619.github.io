(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('year').textContent = new Date().getFullYear();

  const glow = document.querySelector('.cursor-glow');
  if (!reduced && window.matchMedia('(pointer:fine)').matches) {
    window.addEventListener('pointermove', (event) => {
      glow.style.left = `${event.clientX}px`;
      glow.style.top = `${event.clientY}px`;
    }, { passive: true });
  } else {
    glow.style.display = 'none';
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((node) => revealObserver.observe(node));

  const counters = document.querySelectorAll('[data-count]');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.count);
      const duration = reduced ? 0 : 1400;
      const start = performance.now();
      const formatter = new Intl.NumberFormat('en-US');
      const tick = (now) => {
        const progress = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        el.textContent = formatter.format(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      counterObserver.unobserve(el);
    });
  }, { threshold: .5 });
  counters.forEach((counter) => counterObserver.observe(counter));

  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.primary-nav');
  menuButton.addEventListener('click', () => {
    const open = navigation.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    navigation.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  }));

  const sections = [...document.querySelectorAll('main section[id]')];
  const navLinks = [...document.querySelectorAll('.primary-nav a[href^="#"]')];
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-35% 0px -58% 0px' });
  sections.forEach((section) => sectionObserver.observe(section));

  const palette = document.querySelector('.command-palette');
  const paletteClose = palette.querySelector('button');
  const openPalette = () => { if (!palette.open) palette.showModal(); };
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      openPalette();
    }
    if (event.key === 'Escape' && palette.open) palette.close();
  });
  paletteClose.addEventListener('click', () => palette.close());
  palette.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => palette.close()));

  const typeTarget = document.querySelector('.type-target');
  const typeObserver = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    const text = typeTarget.dataset.text;
    if (reduced) { typeTarget.textContent = text; return; }
    let index = 0;
    const timer = window.setInterval(() => {
      typeTarget.textContent = text.slice(0, ++index);
      if (index >= text.length) window.clearInterval(timer);
    }, 58);
    typeObserver.disconnect();
  }, { threshold: .7 });
  typeObserver.observe(typeTarget);

  const canvas = document.getElementById('signal-canvas');
  const context = canvas.getContext('2d');
  let points = [];
  let width = 0;
  let height = 0;
  let animationFrame;
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    points = Array.from({ length: Math.min(55, Math.floor(width / 24)) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - .5) * .12,
      vy: (Math.random() - .5) * .12
    }));
  };
  const draw = () => {
    context.clearRect(0, 0, width, height);
    context.lineWidth = .5;
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      point.x += point.vx;
      point.y += point.vy;
      if (point.x < 0 || point.x > width) point.vx *= -1;
      if (point.y < 0 || point.y > height) point.vy *= -1;
      context.fillStyle = i % 7 === 0 ? 'rgba(199,255,65,.35)' : 'rgba(78,125,255,.22)';
      context.fillRect(point.x, point.y, 1.2, 1.2);
      for (let j = i + 1; j < points.length; j += 1) {
        const other = points[j];
        const dx = point.x - other.x;
        const dy = point.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 130) {
          context.strokeStyle = `rgba(120,155,137,${(1 - distance / 130) * .08})`;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        }
      }
    }
    animationFrame = requestAnimationFrame(draw);
  };
  resize();
  if (!reduced) draw();
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(animationFrame);
    else if (!reduced) draw();
  });
})();
