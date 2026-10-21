/* Vivero Las Acacias · fondo vivo v2
   Pétalos + tréboles + hojas de otoño + polen luminoso.
   Reacciona al viento, a las ráfagas, al scroll y al puntero/dedo.
   Reemplaza el script anterior que dibujaba en #fondo-vivo. */
(() => {
  'use strict';

  /* ---------- Ajustes rápidos ---------- */
  const FRENTE = false;       // true = también flotan POR ENCIMA del contenido (muy suave)
  const DENSIDAD = 1;         // 0.5 = menos, 1.5 = más
  const VELOCIDAD = 1;        // 0.5 = más lento, 1.5 = más rápido
  const MAX_DPR = 2;

  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  /* ---------- Canvas ---------- */
  let canvas = document.getElementById('fondo-vivo');
  if (!canvas || canvas.tagName !== 'CANVAS') {
    if (canvas) canvas.remove();
    canvas = document.createElement('canvas');
    canvas.id = 'fondo-vivo';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
  }
  if (FRENTE) canvas.style.zIndex = '5';
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;

  /* ---------- Sprites (se dibujan una sola vez) ---------- */
  const S = 96, C = S / 2;
  function sprite(draw) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.translate(C, C);
    draw(g);
    return c;
  }

  function petalo(base, claro) {
    return sprite((g) => {
      const gr = g.createLinearGradient(0, 34, 0, -34);
      gr.addColorStop(0, base);
      gr.addColorStop(1, claro);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, 34);
      g.bezierCurveTo(-28, 14, -24, -28, 0, -36);
      g.bezierCurveTo(24, -28, 28, 14, 0, 34);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)';
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, 30); g.lineTo(0, -22); g.stroke();
    });
  }

  function corazon(g) {
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-18, -8, -20, -30, -8, -32);
    g.bezierCurveTo(-3, -33, 0, -29, 0, -26);
    g.bezierCurveTo(0, -29, 3, -33, 8, -32);
    g.bezierCurveTo(20, -30, 18, -8, 0, 0);
    g.closePath();
  }

  function trebol(verde, verdeClaro, hojas) {
    return sprite((g) => {
      // tallito
      g.strokeStyle = verde; g.lineWidth = 3.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6, 22, 2, 40); g.stroke();
      const paso = TAU / hojas;
      for (let i = 0; i < hojas; i++) {
        g.save();
        g.rotate(i * paso + (hojas === 3 ? 0 : Math.PI / 4));
        const gr = g.createLinearGradient(0, 0, 0, -32);
        gr.addColorStop(0, verde);
        gr.addColorStop(1, verdeClaro);
        g.fillStyle = gr;
        corazon(g); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.28)';
        g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(0, -2); g.lineTo(0, -22); g.stroke();
        g.restore();
      }
    });
  }

  function hojaOtono(base, oscuro) {
    // mitad derecha del contorno, de arriba hacia abajo
    const m = [[0,-40],[8,-26],[17,-33],[14,-14],[32,-21],[24,-3],[36,3],[15,9],[18,21],[4,15],[1,27]];
    return sprite((g) => {
      const gr = g.createLinearGradient(-30, -30, 30, 30);
      gr.addColorStop(0, base);
      gr.addColorStop(1, oscuro);
      g.fillStyle = gr; g.strokeStyle = base; g.lineWidth = 3; g.lineJoin = 'round';
      g.beginPath();
      m.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      for (let i = m.length - 1; i >= 0; i--) g.lineTo(-m[i][0], m[i][1]);
      g.closePath(); g.fill(); g.stroke();
      // nervaduras
      g.strokeStyle = 'rgba(60,20,0,.35)'; g.lineWidth = 1.5; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, 36); g.lineTo(0, -34);
      g.moveTo(0, 8); g.lineTo(24, -4); g.moveTo(0, 8); g.lineTo(-24, -4);
      g.moveTo(0, -6); g.lineTo(14, -16); g.moveTo(0, -6); g.lineTo(-14, -16);
      g.stroke();
      // rabito
      g.strokeStyle = oscuro; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 26); g.lineTo(0, 42); g.stroke();
    });
  }

  function polen() {
    return sprite((g) => {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, C);
      gr.addColorStop(0, 'rgba(255,240,150,1)');
      gr.addColorStop(.25, 'rgba(255,226,122,.7)');
      gr.addColorStop(1, 'rgba(255,226,122,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, C, 0, TAU); g.fill();
    });
  }

  const petalos = [
    petalo('#f4a9c6', '#ffe3ee'), petalo('#ee7fa8', '#ffd0e0'),
    petalo('#ffffff', '#ffe9f1'), petalo('#f5c518', '#fff0a8'), petalo('#d97bd0', '#f6d0f2')
  ];
  const treboles = [
    trebol('#2f7d46', '#6cc486', 3), trebol('#3f9a5d', '#8fdc9f', 3),
    trebol('#1e5631', '#4fae6c', 3), trebol('#2f7d46', '#7ed699', 4)
  ];
  const hojas = [
    hojaOtono('#e8731a', '#a8400a'), hojaOtono('#d2391e', '#8a1d10'),
    hojaOtono('#f0a81c', '#b56a08'), hojaOtono('#b5651d', '#6e3a0f'),
    hojaOtono('#c9561a', '#7d2a0b')
  ];
  const brillo = polen();

  /* ---------- Partículas ---------- */
  const parts = [];
  const motas = [];

  function nueva(inicial) {
    const r = Math.random();
    const tipo = r < 0.38 ? 0 : r < 0.62 ? 1 : 2;           // pétalo / trébol / hoja
    const z = rnd(0.35, 1.25);                              // profundidad
    const base = tipo === 2 ? rnd(30, 52) : tipo === 1 ? rnd(24, 42) : rnd(18, 34);
    const p = {
      img: tipo === 0 ? pick(petalos) : tipo === 1 ? pick(treboles) : pick(hojas),
      tipo, z,
      size: base * z,
      x: rnd(-40, W + 40),
      y: inicial ? rnd(-60, H + 60) : rnd(-120, -40),
      vy: rnd(22, 58) * z * (tipo === 2 ? 1.15 : 1),
      sway: rnd(18, 55) * z,                                 // amplitud lateral
      fs: rnd(0.5, 1.4),                                     // frecuencia lateral
      ph: rnd(0, TAU),
      rot: rnd(0, TAU),
      vr: rnd(-1.1, 1.1) * (tipo === 2 ? 1.2 : 1),
      flip: rnd(0, TAU),
      vf: rnd(0.8, 2.6),                                     // giro en 3D
      ox: 0, oy: 0,                                          // empuje del puntero
      a: Math.min(1, 0.45 + z * 0.45)
    };
    return p;
  }

  function nuevaMota(inicial) {
    return {
      x: rnd(0, W), y: inicial ? rnd(0, H) : H + 20,
      vy: -rnd(8, 26), r: rnd(6, 16),
      ph: rnd(0, TAU), fs: rnd(0.4, 1.1), amp: rnd(10, 36),
      tw: rnd(0.8, 2.2), a: rnd(0.35, 0.9)
    };
  }

  function poblar() {
    const area = W * H;
    const movil = W < 700;
    const n = Math.round(Math.min(110, Math.max(26, area / 15000)) * (movil ? 0.7 : 1) * DENSIDAD);
    const m = Math.round(Math.min(40, Math.max(10, area / 40000)) * DENSIDAD);
    while (parts.length < n) parts.push(nueva(true));
    parts.length = n;
    while (motas.length < m) motas.push(nuevaMota(true));
    motas.length = m;
  }

  function ajustar() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    poblar();
  }
  addEventListener('resize', ajustar, { passive: true });
  ajustar();

  /* ---------- Viento, ráfagas, scroll y puntero ---------- */
  let ráfaFin = 0, ráfaFuerza = 0, próxRáfaT = 3000;
  const puntero = { x: -999, y: -999, vx: 0, vy: 0, activo: false };
  let ultimoScroll = scrollY, scrollDy = 0;

  function mover(e) {
    const x = e.clientX, y = e.clientY;
    if (puntero.activo) { puntero.vx = x - puntero.x; puntero.vy = y - puntero.y; }
    puntero.x = x; puntero.y = y; puntero.activo = true;
  }
  addEventListener('pointermove', mover, { passive: true });
  addEventListener('pointerdown', mover, { passive: true });
  addEventListener('pointerleave', () => { puntero.activo = false; puntero.x = puntero.y = -999; }, { passive: true });
  addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { puntero.activo = false; puntero.x = puntero.y = -999; } }, { passive: true });
  addEventListener('scroll', () => {
    scrollDy += scrollY - ultimoScroll;
    ultimoScroll = scrollY;
  }, { passive: true });

  /* ---------- Bucle ---------- */
  const vel = (reducido ? 0.25 : 1) * VELOCIDAD;
  let t0 = performance.now(), tAcum = 0;

  function frame(now) {
    const dtMs = Math.min(50, now - t0);
    t0 = now;
    const dt = (dtMs / 1000) * vel;
    tAcum += dtMs;
    const t = tAcum / 1000;

    // viento base que respira + ráfagas ocasionales
    if (tAcum > próxRáfaT) {
      ráfaFuerza = rnd(80, 190) * (Math.random() < 0.5 ? -1 : 1);
      ráfaFin = tAcum + rnd(1800, 3200);
      próxRáfaT = tAcum + rnd(6000, 12000);
    }
    const ráfa = tAcum < ráfaFin ? ráfaFuerza * Math.sin(Math.PI * (1 - (ráfaFin - tAcum) / 3200)) : 0;
    const viento = Math.sin(t * 0.25) * 26 + Math.sin(t * 0.9 + 1.3) * 12 + ráfa;

    // scroll: las partículas lo sienten con paralaje
    const sdy = scrollDy; scrollDy *= 0.0; // se consume en este cuadro

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // polen luminoso (suma luz)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < motas.length; i++) {
      const m = motas[i];
      m.y += m.vy * dt - sdy * 0.12;
      m.x += (Math.sin(t * m.fs + m.ph) * m.amp + viento * 0.4) * dt;
      if (m.y < -30 || m.x < -40 || m.x > W + 40 || m.y > H + 40) { motas[i] = nuevaMota(false); continue; }
      const tw = 0.5 + 0.5 * Math.sin(t * m.tw + m.ph);
      ctx.globalAlpha = m.a * (0.25 + 0.75 * tw) * 0.55;
      const s = m.r * (0.8 + 0.4 * tw);
      ctx.drawImage(brillo, m.x - s, m.y - s, s * 2, s * 2);
    }
    ctx.globalCompositeOperation = 'source-over';

    // pétalos, tréboles, hojas
    const R = 150;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];

      // empuje del puntero (se aparta y vuelve)
      if (puntero.activo) {
        const dx = p.x - puntero.x, dy = p.y - puntero.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R && d2 > 1) {
          const d = Math.sqrt(d2), f = (1 - d / R);
          p.ox += (dx / d) * f * 320 * dt + puntero.vx * f * 0.06;
          p.oy += (dy / d) * f * 320 * dt + puntero.vy * f * 0.06;
          p.vr += f * (dx > 0 ? 1 : -1) * 0.5;
        }
      }
      p.ox *= 0.94; p.oy *= 0.94;
      p.vr += (Math.sign(p.vr || 1) * 0.8 - p.vr) * 0.01;   // vuelve a su giro natural

      p.y += (p.vy - sdy * 0.25 * p.z) * (sdy ? 1 : 1) * dt + p.oy * dt * 6;
      p.x += (viento * p.z + Math.cos(t * p.fs + p.ph) * p.sway) * dt + p.ox * dt * 6;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;

      // reaparecer al salir
      if (p.y > H + 80 || p.y < -200 || p.x < -90 || p.x > W + 90) {
        if (p.y > H + 80 || p.y < -200) {
          parts[i] = nueva(false);
        } else {
          p.x = p.x < 0 ? W + 70 : -70;
        }
        continue;
      }

      const esc = Math.cos(p.flip);                      // giro 3D: aplana la pieza
      const sx = p.size, sy = p.size * (0.28 + 0.72 * Math.abs(esc));
      ctx.globalAlpha = p.a;
      ctx.setTransform(dpr, 0, 0, dpr, p.x * dpr, p.y * dpr);
      ctx.rotate(p.rot);
      ctx.drawImage(p.img, -sx / 2, -sy / 2, sx, sy);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;

    puntero.vx *= 0.8; puntero.vy *= 0.8;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame((n) => { t0 = n; requestAnimationFrame(frame); });
})();
