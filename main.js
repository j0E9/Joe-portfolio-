(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = matchMedia('(min-width: 901px)');

  /* ---- text prep ---- */
  $$('.split').forEach(el => {
    let i = 0;
    const wrap = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const f = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(t => {
          if (!t.trim()) return f.append(t ? ' ' : '');
          const w = document.createElement('span'); w.className = 'w';
          w.innerHTML = `<i style="--i:${i++}">${t}</i>`; f.append(w);
        });
        n.replaceWith(f);
      } else wrap(n);
    });
    wrap(el);
  });
  const say = $('#say');
  const words = [];
  [...say.childNodes].forEach(n => {
    const hot = n.nodeType === 1;
    const f = document.createDocumentFragment();
    n.textContent.split(/(\s+)/).forEach(t => {
      if (!t.trim()) return f.append(' ');
      const s = document.createElement('span'); s.textContent = t; if (hot) s.className = 'hot';
      words.push(s); f.append(s);
    });
    n.replaceWith(f);
  });
  $$('.run').forEach(r => {
    const html = r.dataset.items.split('|').map(t => `<span>${t}</span>`).join('');
    r.innerHTML = html + html;
  });

  /* ---- reveal on enter ---- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.2 });
  $$('[data-reveal], .split, .acq').forEach(el => io.observe(el));
  const cardIO = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')),
    { threshold: 0.5 });
  $$('.card').forEach(c => cardIO.observe(c));

  /* ---- radar toy ---- */
  const SOILS = { sand: { er: 4, s: 0.0005 }, wet: { er: 20, s: 0.02 }, clay: { er: 30, s: 0.1 } };
  const W = 440, H = 250, ZMAX = 4.4, XSPAN = 3, X0 = 0.5, NOISE = 0.03;
  const cv = $('#scan'), ctx = cv.getContext('2d');
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const octx = off.getContext('2d');
  const lock = $('#lock');
  let soil = 'wet', depth = 1.2, scan = 0, snr = 0;
  const ricker = u => (1 - 2 * Math.PI * Math.PI * u * u) * Math.exp(-Math.PI * Math.PI * u * u);

  function build() {
    const { er, s } = SOILS[soil];
    const alpha = 1637 * s / Math.sqrt(er);            // dB/m, low-loss approximation
    const v = 0.3 / Math.sqrt(er);                     // m/ns
    const att = z => Math.pow(10, -alpha * 2 * z / 20);
    const amp = 0.9 * att(depth);
    snr = 20 * Math.log10(amp / NOISE);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const img = octx.createImageData(W, H), d = img.data, wl = 0.07;
    for (let x = 0; x < W; x++) {
      const xm = (x / W - 0.5) * 2 * XSPAN, dx = xm - X0;
      const zt = Math.sqrt(depth * depth + dx * dx);
      const l1 = 1.0 + 0.09 * Math.sin(xm * 1.3), l2 = 2.7 + 0.14 * Math.sin(xm * 0.7 + 1);
      let n = 0;
      for (let y = 0; y < H; y++) {
        const z = y / H * ZMAX;
        n = 0.55 * n + (rnd() + rnd() + rnd() - 1.5) * NOISE * 1.5;
        let a = n + ricker((z - 0.13) / 0.06)
          + 0.28 * att(l1) * ricker((z - l1) / wl) + 0.22 * att(l2) * ricker((z - l2) / wl)
          + amp * Math.pow(depth / zt, 1.5) * ricker((z - zt) / wl);
        const t = clamp(Math.abs(a) * 2.4), c = a > 0 ? [198, 255, 61] : [255, 96, 40], i = (y * W + x) * 4;
        d[i] = 11 + (c[0] - 11) * t; d[i + 1] = 14 + (c[1] - 14) * t; d[i + 2] = 9 + (c[2] - 9) * t; d[i + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    $('#r-v').textContent = v.toFixed(3) + ' m/ns';
    $('#r-t').textContent = (2 * depth / v).toFixed(0) + ' ns';
    $('#r-a').textContent = alpha.toFixed(1) + ' dB/m';
    $('#r-s').textContent = (snr > 0 ? '+' : '') + snr.toFixed(0) + ' dB';
    $('#dep-v').textContent = depth.toFixed(1) + ' m';
    lock.style.left = (0.5 + X0 / (2 * XSPAN)) * 100 + '%';
    lock.style.top = depth / ZMAX * 100 + '%';
    lock.classList.toggle('lost', snr < 6);
    $('span', lock).textContent = snr >= 6 ? `Echo — ${depth.toFixed(1)} m` : snr >= 0 ? 'Marginal echo' : 'No return — lost in noise';
    draw();
  }
  function draw() {
    ctx.fillStyle = '#0B0E09'; ctx.fillRect(0, 0, W, H);
    const sw = Math.round(W * scan);
    if (sw > 0) ctx.drawImage(off, 0, 0, sw, H, 0, 0, sw, H);
    if (scan > 0 && scan < 1) { ctx.fillStyle = '#C6FF3D'; ctx.fillRect(sw, 0, 2, H); }
    lock.classList.toggle('on', scan >= 0.99);
    $('.live').textContent = scan >= 0.99 ? 'Scan complete' : 'Scanning';
  }
  $$('#soils button').forEach(b => b.onclick = () => {
    soil = b.dataset.s; $$('#soils button').forEach(x => x.classList.toggle('on', x === b)); build();
  });
  $('#dep').oninput = e => { depth = +e.target.value; build(); };
  // small screens (or reduced motion): sweep by time when it enters view
  let swept = false;
  new IntersectionObserver(es => {
    if (!es[0].isIntersecting || swept || (wide.matches && !reduce)) return;
    swept = true;
    const t0 = performance.now();
    const tick = t => { scan = reduce ? 1 : clamp((t - t0) / 2400); draw(); if (scan < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, { threshold: 0.4 }).observe(cv);

  /* ---- host migration toy ---- */
  const net = $('#net'), log = $('#netlog');
  let peers, host;
  function netInit() {
    peers = [0, 1, 2, 3, 4].map(i => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
      return { id: i + 1, x: 160 + 108 * Math.cos(a), y: 112 + 82 * Math.sin(a), ping: 18 + Math.round(Math.random() * 90), alive: true };
    });
    host = peers[0]; netDraw();
    log.textContent = '5 players connected. Click the orange host to pull its plug.';
  }
  function netDraw() {
    const live = peers.filter(p => p.alive);
    net.innerHTML = live.filter(p => p !== host).map(p => `<line class="link" x1="${host.x}" y1="${host.y}" x2="${p.x}" y2="${p.y}"/>`).join('') +
      peers.map(p => `<g class="peer${p === host ? ' host' : ''}${p.alive ? '' : ' gone'}" data-id="${p.id}">
        <circle cx="${p.x}" cy="${p.y}" r="${p === host ? 21 : 16}"/>
        <text class="lbl" x="${p.x}" y="${p.y + 3}">${p === host ? 'HOST' : 'P' + p.id}</text>
        <text x="${p.x}" y="${p.y + (p === host ? 36 : 31)}">${p.alive ? p.ping + ' ms' : 'offline'}</text></g>`).join('');
  }
  function dropHost() {
    const live = peers.filter(p => p.alive);
    if (live.length <= 2) return netInit();
    const old = host; old.alive = false;
    const next = live.filter(p => p !== old).sort((a, b) => a.ping - b.ping)[0];
    host = { x: -99, y: -99 }; netDraw();
    log.textContent = `P${old.id} lost. Waiting 5 s grace… electing the lowest-ping backup.`;
    setTimeout(() => {
      host = next; netDraw();
      log.textContent = `P${next.id} (${next.ping} ms) restored the saved match state and is now host. Scores kept. ` +
        (peers.filter(p => p.alive).length <= 2 ? 'Click again to reset.' : 'Drop it again.');
    }, reduce ? 0 : 1100);
  }
  net.addEventListener('click', e => { const g = e.target.closest('.peer.host'); if (g) dropHost(); });
  $('#drop').onclick = dropHost;
  netInit();

  /* ---- scroll engine ---- */
  const secs = $$('main > section'), stage = $('#stage'), mark = $('#mark'), depthEl = $('#depth');
  const statement = $('#statement'), radar = $('#radar'), work = $('#work'), track = $('#track');
  const steps = $$('.step'), dots = $$('.stepdots i'), cards = $$('.card'), belts = $('#belts');
  const prog = el => { const r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight)); };
  let lastY = scrollY, ticking = false;

  function layout() {
    work.style.height = wide.matches ? track.scrollWidth - innerWidth + innerHeight + 'px' : '';
    update();
  }
  function update() {
    ticking = false;
    const y = scrollY, vh = innerHeight, max = document.documentElement.scrollHeight - vh;
    const p = clamp(y / max);
    depthEl.textContent = (p * 12).toFixed(1).padStart(4, '0') + ' m';
    mark.style.top = p * 100 + '%';
    const cur = secs.find(s => { const r = s.getBoundingClientRect(); return r.top <= vh * 0.5 && r.bottom > vh * 0.5; });
    if (cur) { document.body.dataset.theme = cur.dataset.theme; mark.dataset.s = cur.dataset.stratum; }
    document.body.classList.toggle('down', y > lastY && y > 300);
    if (reduce) return;

    stage.style.setProperty('--hp', clamp(y / vh).toFixed(3));
    const sp = prog(statement), lit = sp * words.length * 1.25;
    words.forEach((w, i) => w.classList.toggle('on', i < lit));

    if (wide.matches) {
      const rp = prog(radar);
      scan = clamp(rp / 0.62); draw();
      const k = rp < 0.36 ? 0 : rp < 0.7 ? 1 : 2;
      steps.forEach((s, i) => s.classList.toggle('on', i === k));
      dots.forEach((d, i) => d.classList.toggle('on', i <= k));

      const wp = prog(work);
      track.style.transform = `translate3d(${-wp * (track.scrollWidth - innerWidth)}px,0,0)`;
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect(), off = (r.left + r.width / 2 - innerWidth / 2) / innerWidth;
        c.style.setProperty('--y', (off * (i % 2 ? -46 : 46)).toFixed(1) + 'px');
        c.style.setProperty('--r', (off * (i % 2 ? 2.4 : -2.4)).toFixed(2) + 'deg');
      });
    }
    belts.style.setProperty('--skew', clamp((y - lastY) * -0.25, -9, 9).toFixed(2) + 'deg');
    lastY = y;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', layout);
  setInterval(() => belts.style.setProperty('--skew', '0deg'), 400);
  build();
  layout();
  document.fonts && document.fonts.ready.then(layout);
  addEventListener('load', layout);
})();
