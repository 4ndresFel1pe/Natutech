/* Vivero Las Acacias · fondo vivo v2
   Pétalos de orquídea y tulipán, tréboles, hojas verdes, hojas de otoño y polen luminoso.
   Todo se mueve: viento que respira, ráfagas, giro 3D, scroll con paralaje y puntero que las aparta.
   Reemplaza al ambiente.js anterior (mismo nombre, misma carga). */
(() => {
'use strict';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const panel = /^(inventario|pedidos|formulario)$/.test(document.body.dataset.pagina || '');
const cv = document.createElement('canvas');
cv.id = 'fondo-vivo'; cv.setAttribute('aria-hidden', 'true'); document.body.prepend(cv);
const ctx = cv.getContext('2d');
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

/* ---------- Sprites: se dibujan una vez y luego solo se estampan ---------- */
const S = 96, C = S / 2;
const sprite = fn => { const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.translate(C, C); fn(g); return c; };
const degradado = (g, y0, y1, a, b) => { const d = g.createLinearGradient(0, y0, 0, y1); d.addColorStop(0, a); d.addColorStop(1, b); return d; };

const petalo = (a, b) => sprite(g => {                       // pétalo de orquídea
  g.fillStyle = degradado(g, 34, -34, a, b);
  g.beginPath(); g.moveTo(0, 34); g.bezierCurveTo(-28, 14, -24, -28, 0, -36); g.bezierCurveTo(24, -28, 28, 14, 0, 34); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 30); g.lineTo(0, -22); g.stroke();
});
const tulipan = (a, b) => sprite(g => {                      // pétalo de tulipán
  g.fillStyle = degradado(g, 36, -36, a, b);
  g.beginPath(); g.moveTo(0, -38); g.bezierCurveTo(30, -8, 26, 30, 0, 38); g.bezierCurveTo(-26, 30, -30, -8, 0, -38); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 30); g.lineTo(0, -26); g.stroke();
});
const hojaVerde = (a, b) => sprite(g => {
  g.fillStyle = degradado(g, 38, -38, a, b);
  g.beginPath(); g.moveTo(0, -38); g.bezierCurveTo(28, -16, 24, 24, 0, 38); g.bezierCurveTo(-24, 24, -28, -16, 0, -38); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 34); g.lineTo(0, -28); g.stroke();
});
const corazon = g => {
  g.beginPath(); g.moveTo(0, 0);
  g.bezierCurveTo(-18, -8, -20, -30, -8, -32); g.bezierCurveTo(-3, -33, 0, -29, 0, -26);
  g.bezierCurveTo(0, -29, 3, -33, 8, -32); g.bezierCurveTo(20, -30, 18, -8, 0, 0); g.closePath();
};
const trebol = (a, b, n) => sprite(g => {                    // trébol de 3 o 4 hojas
  g.strokeStyle = a; g.lineWidth = 3.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6, 22, 2, 40); g.stroke();
  for (let i = 0; i < n; i++) {
    g.save(); g.rotate(i * TAU / n + (n === 3 ? 0 : Math.PI / 4));
    g.fillStyle = degradado(g, 0, -32, a, b); corazon(g); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -2); g.lineTo(0, -22); g.stroke();
    g.restore();
  }
});
const otono = (a, b) => {                                    // hoja de otoño tipo arce
  const m = [[0, -40], [8, -26], [17, -33], [14, -14], [32, -21], [24, -3], [36, 3], [15, 9], [18, 21], [4, 15], [1, 27]];
  return sprite(g => {
    const d = g.createLinearGradient(-30, -30, 30, 30); d.addColorStop(0, a); d.addColorStop(1, b);
    g.fillStyle = d; g.strokeStyle = a; g.lineWidth = 3; g.lineJoin = 'round';
    g.beginPath(); m.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    for (let i = m.length - 1; i >= 0; i--) g.lineTo(-m[i][0], m[i][1]);
    g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(60,20,0,.35)'; g.lineWidth = 1.5; g.lineCap = 'round'; g.beginPath();
    g.moveTo(0, 36); g.lineTo(0, -34); g.moveTo(0, 8); g.lineTo(24, -4); g.moveTo(0, 8); g.lineTo(-24, -4);
    g.moveTo(0, -6); g.lineTo(14, -16); g.moveTo(0, -6); g.lineTo(-14, -16); g.stroke();
    g.strokeStyle = b; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 26); g.lineTo(0, 42); g.stroke();
  });
};
const brillo = sprite(g => {
  const d = g.createRadialGradient(0, 0, 0, 0, 0, C);
  d.addColorStop(0, 'rgba(255,240,150,1)'); d.addColorStop(.25, 'rgba(255,226,122,.7)'); d.addColorStop(1, 'rgba(255,226,122,0)');
  g.fillStyle = d; g.beginPath(); g.arc(0, 0, C, 0, TAU); g.fill();
});

const SP = {
  petalo: [petalo('#e996be', '#ffe3ee'), petalo('#f4c0d8', '#fff2f7'), petalo('#d670a2', '#f6c8de'),
           tulipan('#e25464', '#ffc2c8'), tulipan('#f0848e', '#ffe0e3'), tulipan('#f6c646', '#fff1b0')],
  hoja: [hojaVerde('#4e9662', '#9bd3ab'), hojaVerde('#2f7d46', '#7fc293'), hojaVerde('#7aa854', '#c4e09b')],
  trebol: [trebol('#2f7d46', '#6cc486', 3), trebol('#3f9a5d', '#8fdc9f', 3), trebol('#1e5631', '#4fae6c', 3), trebol('#2f7d46', '#7ed699', 4)],
  otono: [otono('#e8731a', '#a8400a'), otono('#d2391e', '#8a1d10'), otono('#f0a81c', '#b56a08'), otono('#b5651d', '#6e3a0f'), otono('#c9561a', '#7d2a0b')]
};

/* ---------- Estado ---------- */
let W = 0, H = 0, D = 1, ps = [], ms = [], viento = 0, on = true, last = 0, running = false, tAcc = 0;
let rafaFin = 0, rafaFuerza = 0, proxRafa = 1500, sdy = 0, pasoMouse = 0;
const mouse = { x: -999, y: -999, vx: 0, vy: 0, on: false };
const FA = panel ? .65 : 1;                                   // en paneles, un poco más suave para no estorbar formularios
const MAXP = panel ? 30 : 60;

const nueva = inicio => {
  const r = Math.random(), tipo = r < .46 ? 'petalo' : r < .54 ? 'hoja' : r < .88 ? 'trebol' : 'otono', z = rnd(.4, 1.3);
  const base = tipo === 'otono' ? rnd(28, 46) : tipo === 'trebol' ? rnd(24, 38) : tipo === 'hoja' ? rnd(22, 34) : rnd(20, 32);
  return { tipo, img: pick(SP[tipo]), z, size: base * z * (panel ? .85 : 1),
    x: rnd(-30, W + 30), y: inicio ? rnd(-40, H) : rnd(-100, -30),
    vy: rnd(26, 60) * z * (tipo === 'otono' ? 1.15 : 1), amp: rnd(30, 80) * z, fr: rnd(.7, 1.8), ph: rnd(0, TAU),
    rot: rnd(0, TAU), vr: rnd(-1.8, 1.8), flip: rnd(0, TAU), vf: rnd(1.4, 3.6), ox: 0, oy: 0,
    a: clamp(.4 + z * .32, 0, .85) * FA };
};
const nuevaMota = inicio => ({ x: rnd(0, W), y: inicio ? rnd(0, H) : H + 20, vy: -rnd(14, 38), r: rnd(8, 20), ph: rnd(0, TAU), fr: rnd(.5, 1.4), amp: rnd(20, 60), tw: rnd(1, 2.8), a: rnd(.5, 1) * FA });
const chispa = (x, y, vx, vy) => {                            // pétalos que nacen donde pasa el puntero
  const p = nueva(false); p.x = x; p.y = y; p.z = rnd(.5, 1); p.size = rnd(18, 32); p.a = .9 * FA;
  p.ox = vx * .5 + rnd(-30, 30); p.oy = vy * .5 + rnd(-30, 30); p.vida = rnd(2.5, 4); p.vida0 = p.vida; return p;
};

const fit = () => {
  D = Math.min(devicePixelRatio || 1, 1.5);
  W = innerWidth; H = innerHeight; cv.width = W * D; cv.height = H * D;
  const n = Math.round(clamp(W * H / 9000, 22, 64) * (W < 700 ? .7 : 1) * (panel ? .5 : 1) * .55);
  const m = Math.round(clamp(W * H / 25000, 8, 22) * (panel ? .5 : 1) * .5);
  while (ps.length < n) ps.push(nueva(true));
  ps = ps.filter((p, i) => p.vida !== undefined || i < n);
  while (ms.length < m) ms.push(nuevaMota(true)); ms.length = m;
};

/* ---------- Dibujo ---------- */
const dibujar = t => {
  ctx.setTransform(D, 0, 0, D, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (const m of ms) {
    const tw = .5 + .5 * Math.sin(t * m.tw + m.ph), s = m.r * (.8 + .4 * tw);
    ctx.globalAlpha = m.a * (.3 + .7 * tw) * .7;
    ctx.drawImage(brillo, m.x - s, m.y - s, s * 2, s * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const p of ps) {
    const fade = clamp(p.y / 90, 0, 1) * clamp((H - p.y) / 140, 0, 1) * (p.vida !== undefined ? clamp(p.vida / .8, 0, 1) : 1);
    if (fade <= 0) continue;
    const sx = p.size, sy = p.size * (.28 + .72 * Math.abs(Math.cos(p.flip)));
    ctx.globalAlpha = p.a * fade;
    ctx.setTransform(D, 0, 0, D, p.x * D, p.y * D); ctx.rotate(p.rot);
    ctx.drawImage(p.img, -sx / 2, -sy / 2, sx, sy);
  }
  ctx.setTransform(D, 0, 0, D, 0, 0); ctx.globalAlpha = 1;
};

/* ---------- Movimiento ---------- */
const frame = now => {
  if (!on) { running = false; return; }
  const dms = Math.min(now - last, 50), dt = dms / 1000; last = now; tAcc += dms;
  const t = tAcc / 1000;
  viento *= Math.exp(-1.6 * dt);                              // el scroll aporta viento extra y se apaga solo
  if (tAcc > proxRafa) { rafaFuerza = rnd(120, 260) * (Math.random() < .5 ? -1 : 1); rafaFin = tAcc + rnd(2000, 3600); proxRafa = tAcc + rnd(3500, 7000); }
  const rafa = tAcc < rafaFin ? rafaFuerza * Math.sin(Math.PI * clamp(1 - (rafaFin - tAcc) / 3600, 0, 1)) : 0;
  const w = 16 + Math.sin(t * .3) * 44 + Math.sin(t * 1.1 + 1.3) * 22 + rafa + viento;
  const dy = sdy; sdy = 0;

  ms.forEach((m, i) => {
    m.y += m.vy * dt - dy * .12; m.x += (Math.sin(t * m.fr + m.ph) * m.amp + w * .5) * dt;
    if (m.y < -30 || m.x < -40 || m.x > W + 40 || m.y > H + 40) ms[i] = nuevaMota(false);
  });

  const R = 170;
  ps = ps.filter(p => { if (p.vida === undefined) return true; p.vida -= dt; return p.vida > 0; });
  ps.forEach((p, i) => {
    if (mouse.on) {
      const dx = p.x - mouse.x, dyy = p.y - mouse.y, d2 = dx * dx + dyy * dyy;
      if (d2 < R * R && d2 > 1) {
        const d = Math.sqrt(d2), f = 1 - d / R;
        p.ox += dx / d * f * 380 * dt + mouse.vx * f * .08; p.oy += dyy / d * f * 380 * dt + mouse.vy * f * .08;
        p.vr += f * (dx > 0 ? 1 : -1) * .7;
      }
    }
    p.ox *= .95; p.oy *= .95;
    p.vr += (Math.sign(p.vr || 1) * 1.1 - p.vr) * .012;
    const aleteo = 1 + .45 * Math.sin(t * p.fr * 1.7 + p.ph);  // caen a rachas: aceleran y frenan
    p.y += (p.vy * aleteo - dy * .3 * p.z) * dt + p.oy * dt * 6;
    p.x += (w * p.z + Math.cos(t * p.fr + p.ph) * p.amp + Math.sin(t * .6 + p.y * .012) * 26 * p.z) * dt + p.ox * dt * 6;
    p.rot += p.vr * dt; p.flip += p.vf * dt;
    if (p.x > W + 70) p.x = -60; else if (p.x < -70) p.x = W + 60;
    if (p.vida === undefined && (p.y > H + 40 || p.y < -200)) ps[i] = nueva(false);
  });
  mouse.vx *= .8; mouse.vy *= .8;
  dibujar(t);
  requestAnimationFrame(frame);
};
const arrancar = () => { if (!running && !reduce) { running = true; last = performance.now(); requestAnimationFrame(frame); } };

/* ---------- Eventos ---------- */
let sy = scrollY;
addEventListener('scroll', () => { const d = scrollY - sy; sy = scrollY; sdy += d; viento = clamp(viento + d * .7, -200, 200); }, { passive: true });
if (!reduce) {
  const mover = e => {
    if (mouse.on) {
      mouse.vx = e.clientX - mouse.x; mouse.vy = e.clientY - mouse.y;
      pasoMouse += Math.hypot(mouse.vx, mouse.vy);
      if (pasoMouse > 70 && ps.length < MAXP) { pasoMouse = 0; ps.push(chispa(e.clientX, e.clientY, mouse.vx, mouse.vy)); }
    }
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true;
  };
  const fuera = () => { mouse.on = false; mouse.x = mouse.y = -999; };
  addEventListener('pointermove', mover, { passive: true });
  addEventListener('pointerdown', mover, { passive: true });
  addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') fuera(); }, { passive: true });
  addEventListener('pointercancel', fuera, { passive: true });
  document.documentElement.addEventListener('pointerleave', fuera);
}
addEventListener('resize', () => { fit(); if (reduce) dibujar(0); });
document.addEventListener('visibilitychange', () => { on = !document.hidden; if (on) { arrancar(); } });
fit();
if (reduce) dibujar(0);
else if (window.__ldDone || !document.getElementById('loader')) arrancar();
else document.addEventListener('loader-done', arrancar, { once: true });   // no compite con la pantalla de carga
})();
