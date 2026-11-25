/* Cinematic scroll layer: smooth scroll, scroll-scrubbed video, focus text,
   recon log, RP zoom and the build orbit. With reduced motion, or if the
   libraries fail to load, none of this runs and the page stays static. */
(() => {
  const { gsap, ScrollTrigger, SplitText, Lenis } = window;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger, SplitText);

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // ---- Smooth scroll on one clock with ScrollTrigger ----
    let lenis = null;
    if (Lenis) {
      lenis = new Lenis({ lerp: 0.09, anchors: true });
      lenis.on('scroll', ScrollTrigger.update);
      const raf = (time) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }

    // ---- Statement: words come into focus as you scroll ----
    const statement = document.querySelector('[data-focus]');
    if (statement && SplitText) {
      const split = SplitText.create(statement, { type: 'words', wordsClass: 'word' });
      gsap.fromTo(split.words,
        { opacity: 0.12, filter: 'blur(10px)', yPercent: 18 },
        {
          opacity: 1, filter: 'blur(0px)', yPercent: 0, ease: 'none', stagger: 0.12,
          scrollTrigger: { trigger: '.statement', start: 'top top', end: '+=110%', scrub: 0.6, pin: true },
        });
    }

    // ---- Proof rings arrive one by one ----
    gsap.from('.proof-strip .proof-item', {
      scale: 0.7, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12,
      scrollTrigger: { trigger: '.proof-strip', start: 'top 78%' },
    });

    // ---- Scroll-scrubbed video: eases toward the scroll position ----
    // `curve` remaps scroll progress to video time as [progress, timeFraction] points,
    // so a fast moment in the footage can get more scroll distance.
    const remap = (p, curve) => {
      if (!curve) return p;
      for (let i = 1; i < curve.length; i++) {
        const [p0, t0] = curve[i - 1];
        const [p1, t1] = curve[i];
        if (p <= p1) return t0 + ((p - p0) / (p1 - p0)) * (t1 - t0);
      }
      return curve[curve.length - 1][1];
    };

    // opts lets a section scrub without pinning: { pin: false, start, end }.
    const scrub = (video, stage, length, onProgress, curve, opts = {}) => {
      const state = { t: 0 };
      let ready = false;
      // One seek at a time. Setting currentTime while a seek is still running cancels it, so
      // seeking on every scroll frame kept the video permanently "seeking" and the picture froze
      // until scrolling stopped. Now a new seek starts only when the last one lands, always to
      // the latest scroll position.
      let pending = false;
      const sync = () => {
        if (!ready || !video.duration) return;
        if (video.seeking) { pending = true; return; }
        const target = remap(state.t, curve) * (video.duration - 0.05);
        if (Math.abs(video.currentTime - target) > 0.01) video.currentTime = target;
      };
      video.addEventListener('seeked', () => { if (pending) { pending = false; sync(); } });
      video.addEventListener('loadedmetadata', () => { ready = true; sync(); });
      if (video.readyState >= 1) ready = true;
      // iOS will not seek a video that has never played; unlock on first touch.
      const unlock = () => {
        video.play().then(() => video.pause()).catch(() => {});
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('touchstart', unlock, { passive: true });

      // Snap straight to the right state when the page loads or resizes at any position,
      // so a section never shows its ending before you scroll into it.
      const snap = (p) => { state.t = p; sync(); if (onProgress) onProgress(p); };
      snap(0);
      ScrollTrigger.create({
        trigger: stage,
        start: opts.start ?? 'top top',
        end: opts.end ?? `+=${length}%`,
        pin: opts.pin ?? true,
        // A trigger below later-created pins must be measured after them.
        refreshPriority: opts.refreshPriority ?? 0,
        scrub: true,
        onRefresh: (self) => snap(self.progress),
        // Text cues follow the same eased value as the video, so a line lands on its frame
        // instead of a beat ahead of it.
        onUpdate: (self) => {
          gsap.to(state, { t: self.progress, duration: 0.35, ease: 'power2.out', overwrite: true, onUpdate: () => { sync(); if (onProgress) onProgress(state.t); } });
        },
      });
    };

    const journey = document.querySelector('.journey-stage');
    if (journey) {
      const steps = [...journey.querySelectorAll('.journey-steps li')];
      const bar = journey.querySelector('.journey-progress i');
      let current = -1;
      // Measured on the server-corridor clip (14.93 s, scrubbable to 14.88 s). Each step owns a
      // fifth of the scroll and lands on its beat: dark corridor (Scope), the floor grid draws
      // 2.5-4.0 s (Recon), rack lights wave on 5.0-10.5 s (Test), the end glow flares
      // 11.0-12.75 s (Validate), everything lit and steady (Report).
      const D = 14.88;
      const curve = [[0, 0], [0.2, 2.45], [0.4, 4.8], [0.6, 10.8], [0.8, 12.8], [1, D]].map(([p, s]) => [p, s / D]);
      scrub(journey.querySelector('.scrub-video'), journey, 260, (p) => {
        const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
        if (idx !== current) {
          steps.forEach((li, i) => li.classList.toggle('is-active', i === idx));
          current = idx;
        }
        bar.style.width = `${p * 100}%`;
      }, curve);
      steps[0]?.classList.add('is-active');
    }

    // ---- Contact: the closing scan. No pin; the laser sweeps the monolith as the section
    // scrolls in, and the map completes as the headline settles near the top. ----
    const contactVideo = document.querySelector('.contact-video');
    if (contactVideo) scrub(contactVideo, document.querySelector('#contact'), 0, null, null, { pin: false, start: 'top 85%', end: 'top 10%', refreshPriority: -1 });

    const breach = document.querySelector('.breach-stage');
    if (breach) {
      const lines = breach.querySelectorAll('.breach-line');
      // Measured on the obsidian-sphere clip (10 s, scrubbable to 9.95 s): cracks fire 1.08 s,
      // burst to 3.4 s, shards drift to 5.4 s, reassemble 5.5-7.2 s, green seams 7.25-7.6 s,
      // then the healed sphere turns. Curve points are [scroll progress, seconds].
      const D = 9.95;
      const curve = [[0, 0], [0.12, 1.0], [0.35, 3.4], [0.5, 5.4], [0.66, 7.2], [0.74, 7.7], [1, D]].map(([p, s]) => [p, s / D]);
      const clamp01 = (x) => Math.max(0, Math.min(1, x));
      scrub(breach.querySelector('.scrub-video'), breach, 200, (p) => {
        // "I break things on purpose," lands with the cracks.
        const brk = clamp01((p - 0.12) / 0.1);
        gsap.set(lines[0], { opacity: brk, y: (1 - brk) * 24 });
        // "then write the fix." arrives with the green seams (7.25 s, fully in by 7.6 s).
        const fix = clamp01((p - 0.665) / 0.06);
        gsap.set(lines[1], { opacity: fix, y: (1 - fix) * 24 });
      }, curve);
    }

    // ---- Recon log: rows roll past a fixed scan line ----
    const logWindow = document.querySelector('.log-window');
    if (logWindow) {
      const rows = logWindow.querySelector('.log-rows');
      const items = [...rows.children];
      const step = items[0]?.offsetHeight || 46;
      const travel = step * (items.length - 1);
      let hot = -1;
      gsap.to(rows, {
        y: -travel,
        ease: 'none',
        scrollTrigger: {
          trigger: '.log-frame', start: 'top top', end: '+=160%', pin: true, scrub: 0.5,
          onUpdate: (self) => {
            const idx = Math.round(self.progress * (items.length - 1));
            if (idx !== hot) {
              items.forEach((li, i) => li.classList.toggle('is-hot', i === idx));
              hot = idx;
            }
          },
        },
      });
      items[0]?.classList.add('is-hot');
    }

    // ---- RP zoom: fly through the counter of the P into Projects ----
    // The hole is measured live from the glyphs this browser actually draws (Segoe UI on
    // Windows, Inter elsewhere), then the SVG viewBox zooms in anchored on it.
    const rpSvg = document.querySelector('.rp-svg');
    if (rpSvg) {
      const glyphs = rpSvg.querySelector('.rp-glyphs');
      const VB_W = 1000, VB_H = 562, SIZE = 300;
      const zoom = { t: 0 };
      let anchor = { cx: VB_W * 0.62, cy: VB_H * 0.42, zEnd: 30 };

      const measure = () => {
        const cs = getComputedStyle(glyphs);
        const c = document.createElement('canvas');
        const g = c.getContext('2d');
        const font = `${cs.fontWeight} ${SIZE}px ${cs.fontFamily}`;
        const spacing = 'letterSpacing' in g;
        if (!spacing) glyphs.style.letterSpacing = '0'; // keep SVG and canvas identical
        const setFont = () => { g.font = font; if (spacing) g.letterSpacing = `${-0.06 * SIZE}px`; };
        setFont();
        const m = g.measureText('RP');
        const L = m.actualBoundingBoxLeft, R = m.actualBoundingBoxRight;
        const A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
        const pad = 6, w = Math.ceil(L + R) + pad * 2, h = Math.ceil(A + D) + pad * 2;
        c.width = w; c.height = h; setFont();
        g.fillText('RP', L + pad, A + pad);
        const px = g.getImageData(0, 0, w, h).data;
        const ink = (i) => px[i * 4 + 3] > 110;
        // Flood the outside from a corner; enclosed empty pixels left over are counters.
        const seen = new Uint8Array(w * h);
        const stack = [0]; seen[0] = 1;
        while (stack.length) {
          const i = stack.pop(); const x = i % w, y = (i / w) | 0;
          const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
          for (const j of nb) if (j >= 0 && !seen[j] && !ink(j)) { seen[j] = 1; stack.push(j); }
        }
        let n = 0, sx = 0, sy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
        for (let i = 0; i < w * h; i++) {
          if (seen[i] || ink(i)) continue;
          const x = i % w, y = (i / w) | 0;
          if (x < w * 0.5) continue; // the R's counter is on the left; we want the P's
          n++; sx += x; sy += y; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        // Place the text centred in the viewBox, then map the hole into SVG units.
        const penX = (VB_W - (L + R)) / 2 + L, penY = (VB_H - (A + D)) / 2 + A;
        glyphs.removeAttribute('text-anchor'); glyphs.removeAttribute('dominant-baseline');
        glyphs.setAttribute('x', penX.toFixed(2)); glyphs.setAttribute('y', penY.toFixed(2));
        if (!n) return; // no counter found: keep the fallback anchor
        const cx = penX + (sx / n - (L + pad)), cy = penY + (sy / n - (A + pad));
        const holeW = x1 - x0 + 1, holeH = y1 - y0 + 1;
        // How much of the viewBox is visible at zoom 1 with "meet", for this screen shape.
        const r = rpSvg.clientWidth / Math.max(1, rpSvg.clientHeight);
        const visW = r >= VB_W / VB_H ? VB_H * r : VB_W, visH = r >= VB_W / VB_H ? VB_H : VB_W / r;
        // End zoom: the visible area shrinks to well inside the hole, so the screen goes dark.
        anchor = { cx, cy, zEnd: Math.max(visW / (0.55 * holeW), visH / (0.55 * holeH)) };
      };

      const apply = () => {
        const z = Math.exp(Math.log(anchor.zEnd) * zoom.t);
        const { cx, cy } = anchor;
        rpSvg.setAttribute('viewBox', `${(cx - cx / z).toFixed(3)} ${(cy - cy / z).toFixed(3)} ${(VB_W / z).toFixed(3)} ${(VB_H / z).toFixed(3)}`);
      };

      measure(); apply();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); apply(); });

      gsap.timeline({
        scrollTrigger: {
          trigger: '.rp-stage', start: 'top top', end: '+=100%', pin: true, scrub: 0.4,
          onRefresh: () => { measure(); apply(); },
        },
      })
        .to('.rp-caption', { opacity: 0, duration: 0.15 }, 0)
        .to(zoom, { t: 1, ease: 'power1.in', duration: 1, onUpdate: apply }, 0)
        .to('.rp-stage', { backgroundColor: '#000', duration: 0.3 }, 0.7)
        .to(rpSvg, { opacity: 0, duration: 0.12 }, 0.88);
    }

    return () => { if (lenis) lenis.destroy(); };
  });

  // ---- Orbit: desktop only; phones get a plain grid ----
  mm.add('(prefers-reduced-motion: no-preference) and (min-width: 781px)', () => {
    const ring = document.querySelector('.builds-ring');
    if (!ring) return;
    gsap.fromTo(ring, { '--spin': '-40deg' }, {
      '--spin': '140deg',
      ease: 'none',
      scrollTrigger: { trigger: '.builds-orbit', start: 'top bottom', end: 'bottom top', scrub: 0.8 },
    });
  });

  // ---- Reduced motion: hold looping videos on their poster frame ----
  mm.add('(prefers-reduced-motion: reduce)', () => {
    document.querySelectorAll('.hero-video').forEach((v) => { v.pause(); v.removeAttribute('autoplay'); });
    document.querySelectorAll('[data-poster-end]').forEach((v) => { v.poster = v.dataset.posterEnd; });
  });

  // Start downloading below-the-fold video about a screen and a half before it's
  // needed, so a visitor who never scrolls that far never pays for it.
  const lazy = document.querySelectorAll('.scrub-video, .contact-video');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const v = e.target;
        v.preload = 'auto';
        v.load();
        io.unobserve(v);
      });
    }, { rootMargin: '150% 0px' });
    lazy.forEach((v) => io.observe(v));
  }

  // Pins change layout height; recalculate once media has sized itself.
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
