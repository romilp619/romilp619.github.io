(() => {
  const canvas = document.getElementById('evidence-core-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phi = (1 + Math.sqrt(5)) / 2;
  const raw = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
  ];
  const length = Math.sqrt(1 + phi * phi);
  const shell = raw.map(([x, y, z]) => [x / length, y / length, z / length]);
  const inner = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(v => v.map(n => n * .48));
  const shellEdges = [];
  for (let i = 0; i < shell.length; i += 1) {
    for (let j = i + 1; j < shell.length; j += 1) {
      const d = Math.hypot(shell[i][0] - shell[j][0], shell[i][1] - shell[j][1], shell[i][2] - shell[j][2]);
      if (d < 1.08) shellEdges.push([i, j]);
    }
  }
  const innerEdges = [];
  for (let i = 0; i < inner.length; i += 1) {
    for (let j = i + 1; j < inner.length; j += 1) {
      if (inner[i][0] * inner[j][0] + inner[i][1] * inner[j][1] + inner[i][2] * inner[j][2] === 0) innerEdges.push([i, j]);
    }
  }
  const shards = Array.from({ length: 18 }, (_, index) => ({
    angle: index * Math.PI * 2 / 18,
    radius: .8 + (index % 3) * .12,
    tilt: (index % 5 - 2) * .18,
    speed: .14 + (index % 4) * .025,
    size: index % 4 === 0 ? 3.2 : 1.7,
    acid: index % 3 === 0
  }));
  let width = 0;
  let height = 0;
  let ratio = 1;
  let angleX = -.32;
  let angleY = .45;
  let targetX = angleX;
  let targetY = angleY;
  let scrollInfluence = 0;
  let frame = 0;
  let active = true;

  const rotate = ([x, y, z], ax, ay, az) => {
    let y1 = y * Math.cos(ax) - z * Math.sin(ax);
    let z1 = y * Math.sin(ax) + z * Math.cos(ax);
    let x1 = x * Math.cos(ay) + z1 * Math.sin(ay);
    let z2 = -x * Math.sin(ay) + z1 * Math.cos(ay);
    const x2 = x1 * Math.cos(az) - y1 * Math.sin(az);
    const y2 = x1 * Math.sin(az) + y1 * Math.cos(az);
    return [x2, y2, z2];
  };
  const project = ([x, y, z], scale = 1) => {
    const perspective = 3.6 / (4.1 - z);
    const radius = Math.min(width, height) * .31 * scale;
    return { x: width / 2 + x * radius * perspective, y: height / 2 + y * radius * perspective, z, p: perspective };
  };
  const resize = () => {
    const rect = host.getBoundingClientRect();
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  const line = (a, b, color, alpha, weight = 1) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color.replace('ALPHA', Math.max(.035, alpha).toFixed(3));
    ctx.lineWidth = weight;
    ctx.stroke();
  };
  const node = (point, color, size) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, size * point.p, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 4;
    ctx.fill();
    ctx.shadowBlur = 0;
  };
  const draw = (time = 0) => {
    ctx.clearRect(0, 0, width, height);
    angleX += (targetX - angleX) * .035;
    angleY += (targetY + scrollInfluence - angleY) * .035;
    const spin = reduced ? .35 : time * .00016;
    const breathing = reduced ? 1 : 1 + Math.sin(time * .0014) * .035;
    const shell3d = shell.map(v => rotate(v, angleX + spin * .38, angleY + spin, spin * .22));
    const inner3d = inner.map(v => rotate(v, -angleX + spin * .65, angleY - spin * 1.35, -spin * .45));
    const shell2d = shell3d.map(v => project(v, breathing));
    const inner2d = inner3d.map(v => project(v, breathing));

    const halo = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.min(width, height) * .33);
    halo.addColorStop(0, 'rgba(199,255,65,.075)');
    halo.addColorStop(.42, 'rgba(78,125,255,.035)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);

    shellEdges.sort((e1, e2) => (shell3d[e1[0]][2] + shell3d[e1[1]][2]) - (shell3d[e2[0]][2] + shell3d[e2[1]][2]));
    shellEdges.forEach(([i, j], edgeIndex) => {
      const depth = (shell3d[i][2] + shell3d[j][2] + 2) / 4;
      const color = edgeIndex % 5 === 0 ? 'rgba(199,255,65,ALPHA)' : 'rgba(91,132,255,ALPHA)';
      line(shell2d[i], shell2d[j], color, .12 + depth * .54, .65 + depth * 1.15);
    });
    innerEdges.forEach(([i, j]) => {
      const depth = (inner3d[i][2] + inner3d[j][2] + 1) / 2;
      line(inner2d[i], inner2d[j], 'rgba(199,255,65,ALPHA)', .22 + depth * .55, 1.1);
    });
    inner2d.forEach((point, index) => node(point, index % 2 ? '#4e7dff' : '#c7ff41', 3.1));
    shell2d.forEach((point, index) => node(point, index % 4 ? 'rgba(220,235,226,.68)' : '#c7ff41', index % 4 ? 1.5 : 2.6));

    shards.forEach((shard, index) => {
      const a = shard.angle + spin * shard.speed * 8;
      const base = [Math.cos(a) * shard.radius, Math.sin(a) * shard.radius * .58, shard.tilt + Math.sin(a * 1.7) * .3];
      const moved = rotate(base, angleX * .35, angleY * .25, spin * .2);
      const point = project(moved, 1.32);
      node(point, shard.acid ? '#c7ff41' : '#4e7dff', shard.size);
      if (index % 3 === 0) {
        const anchor = shell2d[index % shell2d.length];
        line(point, anchor, shard.acid ? 'rgba(199,255,65,ALPHA)' : 'rgba(78,125,255,ALPHA)', .12, .55);
      }
    });

    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) * (.077 + Math.sin(time * .002) * .004), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(199,255,65,.42)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#c7ff41';
    ctx.shadowColor = '#c7ff41';
    ctx.shadowBlur = 22;
    ctx.fill();
    ctx.shadowBlur = 0;
    if (!reduced && active) frame = requestAnimationFrame(draw);
  };
  const pointer = (event) => {
    const rect = host.getBoundingClientRect();
    targetY = ((event.clientX - rect.left) / rect.width - .5) * 1.15;
    targetX = ((event.clientY - rect.top) / rect.height - .5) * -.9;
  };
  host.addEventListener('pointermove', pointer, { passive: true });
  host.addEventListener('pointerleave', () => { targetX = -.32; targetY = .45; });
  window.addEventListener('scroll', () => { scrollInfluence = Math.min(window.scrollY / window.innerHeight, 1.4) * .42; }, { passive: true });
  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(([entry]) => {
    const wasActive = active;
    active = entry.isIntersecting;
    if (active && !wasActive && !reduced) frame = requestAnimationFrame(draw);
    if (!active) cancelAnimationFrame(frame);
  }, { threshold: .02 }).observe(host);
  resize();
  draw(0);
})();
