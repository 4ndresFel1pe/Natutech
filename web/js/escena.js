/* Vivero Las Acacias · carga, resortes y flor 3D (Canvas 2D, sin librerías) */
(() => {
'use strict';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const raf = requestAnimationFrame;

/* ---------- Pantalla de carga: sale cuando la página y los datos están listos ---------- */
const carga = document.getElementById('carga');
if (carga) {
  let primera = true;
  try { primera = !sessionStorage.getItem('vla'); sessionStorage.setItem('vla', '1'); } catch (e) {}
  const t0 = performance.now(), minimo = primera && !reduce ? 2600 : 0;
  let hecho = false;
  const salir = () => {
    if (hecho) return; hecho = true;
    carga.classList.add('sale');
    setTimeout(() => carga.remove(), 800);
    document.dispatchEvent(new Event('carga:fin'));
  };
  const revisar = () => {
    const t = performance.now() - t0;
    if ((document.readyState === 'complete' && !document.querySelector('[aria-busy="true"]') && t >= minimo) || t >= 7000) salir();
    else setTimeout(revisar, 120);
  };
  revisar();
}

/* ---------- Muelle estilo Apple: respuesta (s) y amortiguación (1 = sin rebote) ---------- */
const muelle = (o, k, meta, resp, amort, dt) => {
  const w = 6.2832 / resp;
  o[k + 'v'] += (w * w * (meta - o[k]) - 2 * amort * w * o[k + 'v']) * dt;
  o[k] += o[k + 'v'] * dt;
};

/* ---------- Encabezado y portada según el scroll ---------- */
const hero = document.querySelector('.hero'), escena = document.querySelector('.hero__escena'), texto = document.querySelector('.hero__texto');
let pend = 0;
addEventListener('scroll', () => {
  if (pend) return;
  pend = raf(() => {
    pend = 0;
    document.documentElement.classList.toggle('bajo', scrollY > 8);
    if (hero && !reduce) {
      const p = clamp(scrollY / hero.offsetHeight, 0, 1);
      escena.style.transform = `translate3d(0,${(p * 56).toFixed(1)}px,0) scale(${(1 - p * .12).toFixed(3)})`;
      escena.style.opacity = (1 - p * .7).toFixed(2);
      texto.style.transform = `translate3d(0,${(p * -18).toFixed(1)}px,0)`;
    }
  });
}, { passive: true });

/* ---------- Tarjetas: inclinación con resorte, brillo y entrada escalonada ---------- */
if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const est = new WeakMap();
  const paso = (el, s, now) => {
    const dt = Math.min((now - s.last) / 1000, 1 / 30); s.last = now;
    muelle(s, 'rx', s.t.rx, .3, 1, dt); muelle(s, 'ry', s.t.ry, .3, 1, dt); muelle(s, 'sc', s.t.sc, .3, 1, dt);
    el.style.transform = `perspective(800px) rotateX(${s.rx.toFixed(2)}deg) rotateY(${s.ry.toFixed(2)}deg) scale(${s.sc.toFixed(4)})`;
    const quieto = Math.abs(s.rx - s.t.rx) + Math.abs(s.ry - s.t.ry) + Math.abs(s.sc - s.t.sc) < .004 && Math.abs(s.rxv) + Math.abs(s.ryv) + Math.abs(s.scv) < .05;
    if (quieto) { s.raf = 0; if (s.t.sc === 1) el.style.transform = ''; } else s.raf = raf(t => paso(el, s, t));
  };
  const mover = (el, rx, ry, sc) => {
    let s = est.get(el);
    if (!s) { s = { rx: 0, rxv: 0, ry: 0, ryv: 0, sc: 1, scv: 0, t: {}, raf: 0, last: 0 }; est.set(el, s); }
    s.t = { rx, ry, sc };
    if (!s.raf) { s.last = performance.now(); s.raf = raf(t => paso(el, s, t)); }
  };
  let act = null;
  const soltar = () => { if (act) { mover(act, 0, 0, 1); act.style.setProperty('--g', 0); act = null; } };
  document.addEventListener('pointermove', e => {
    const t = e.target.closest && e.target.closest('.tarjeta');
    if (act && act !== t) soltar();
    if (!t) return;
    const r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    mover(t, (.5 - y) * 12, (x - .5) * 12, 1.025);
    t.style.setProperty('--gx', (x * 100).toFixed(0) + '%'); t.style.setProperty('--gy', (y * 100).toFixed(0) + '%'); t.style.setProperty('--g', 1);
    act = t;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', soltar);
}
if (!reduce && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const li = e.target; io.unobserve(li);
    li.style.transitionDelay = Math.min(li._i, 8) * 45 + 'ms'; li.classList.add('ya');
    setTimeout(() => { li.style.transitionDelay = ''; }, 1000);
  }), { rootMargin: '0px 0px -6% 0px' });
  let pv = 0;
  const vigilar = () => { pv = 0; document.querySelectorAll('.rejilla>li:not(.vista)').forEach((li, i) => { li.classList.add('vista', 'pre'); li._i = i; io.observe(li); }); };
  new MutationObserver(() => { if (!pv) pv = raf(vigilar); }).observe(document.body, { childList: true, subtree: true });
  vigilar();
}

/* ---------- Flor 3D ---------- */
const cv = document.getElementById('flor3d');
if (!cv) return;
const ctx = cv.getContext('2d'), btn = document.getElementById('florecer');
const F = 4, LO = -1.25, HI = -.2, LUZ = [-.4, .6, -.7];
const P = { open: reduce ? 1 : 0, openv: 0, ry: .6, ryv: 0, rx: -.7, rxv: 0, lx: 0, lxv: 0, ly: 0, lyv: 0 };
const T = { open: reduce ? 1 : 0, ry: .6, rx: -.7, lx: 0, ly: 0 };
const V = { ry: 0, rx: 0 };
let W = 0, H = 0, S = 0, drag = null, on = true, running = false, last = 0, caida = [];

const fit = () => {
  const d = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
  W = r.width; H = r.height; S = Math.min(W, H) * .27;
  cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
};
const rot = (x, y, z) => {
  let c = Math.cos(V.ry), s = Math.sin(V.ry);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(V.rx); s = Math.sin(V.rx);
  return [x, y * c - z * s, y * s + z * c];
};
const proj = p => { const k = S * F / (F + p[2]); return [W / 2 + p[0] * k, H * .4 - p[1] * k, k]; };
const place = (p, tilt, phi, oy) => {
  let [x, y, z] = p, c = Math.cos(-tilt), s = Math.sin(-tilt);
  [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(phi); s = Math.sin(phi);
  [x, z] = [x * c + z * s, -x * s + z * c];
  return rot(x, y + oy, z);
};
const rgb = (c, k, a = 1) => `rgba(${c.map(v => Math.round(clamp(v * k, 0, 255))).join()},${a})`;
const banda = raw => {                       // rubber-banding: resistencia progresiva en los bordes
  const rb = o => o * .5 * .55 / (.5 + .55 * Math.abs(o));
  return raw > HI ? HI + rb(raw - HI) : raw < LO ? LO - rb(LO - raw) : raw;
};

const anillos = [
  { n: 10, len: 1.02, w: .3, c: [240, 186, 20], t: 1.38, o: 0, cup: .55, rizo: .35 },
  { n: 9, len: .9, w: .29, c: [247, 208, 52], t: 1.02, o: .3, cup: .6, rizo: .25 },
  { n: 7, len: .7, w: .25, c: [253, 224, 100], t: .68, o: .2, cup: .7, rizo: .15 },
  { n: 5, len: .42, w: .18, c: [255, 238, 150], t: .32, o: .1, cup: .8, rizo: 0 }
];
const polvo = Array.from({ length: 24 }, (_, i) => [Math.sin(i * 12.9) * 1.7, i / 24 * 3 - 1.2, Math.cos(i * 7.7) * 1.7, i]);

function petalo(items, { len, w, cup, tilt, phi, oy, c, rizo = 0 }) {
  const N = 8, loc = [], ancho = u => w * Math.sin(Math.PI * Math.pow(u, .7));
  for (let i = 0; i <= N; i++) { const u = i / N; loc.push([-ancho(u), u * len, cup * ancho(u) ** 2 - rizo * u ** 3]); }
  for (let i = N; i >= 0; i--) { const u = i / N; loc.push([ancho(u), u * len, cup * ancho(u) ** 2 - rizo * u ** 3]); }
  const p3 = loc.map(p => place(p, tilt, phi, oy)), n = place([0, 0, 1], tilt, phi, 0);
  const luz = .55 + .45 * Math.abs(n[0] * LUZ[0] + n[1] * LUZ[1] + n[2] * LUZ[2]);
  const q = p3.map(proj), a = q[0], b = q[N], vena = proj(place([0, len * .78, 0], tilt, phi, oy));
  items.push({ z: p3.reduce((s, p) => s + p[2], 0) / p3.length, d() {
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, rgb(c, luz * .6)); g.addColorStop(.7, rgb(c, luz)); g.addColorStop(1, rgb(c, luz * 1.12));
    ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${(.16 * luz).toFixed(2)})`; ctx.lineWidth = 1; ctx.stroke();   // brillo en el borde
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(vena[0], vena[1]); ctx.strokeStyle = rgb(c, .5, .3); ctx.stroke();  // vena
  } });
}
const punto = (items, p, r, c, al) => { const q = proj(p); items.push({ z: p[2], d() { ctx.beginPath(); ctx.arc(q[0], q[1], r * q[2], 0, 7); ctx.fillStyle = rgb(c, 1, al); ctx.fill(); } }); };

function explotar() {                          // pétalos que se desprenden al florecer
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * 6.28, v = .8 + Math.random() * .9;
    caida.push({ p: [Math.cos(a) * .2, .3, Math.sin(a) * .2], v: [Math.cos(a) * v, .5 + Math.random(), Math.sin(a) * v], r: Math.random() * 6, vr: (Math.random() - .5) * 6, vida: 2.6 });
  }
}

function dibujar(t, dt = 0) {
  V.ry = P.ry + P.lx * .22; V.rx = P.rx + P.ly * .12;
  ctx.clearRect(0, 0, W, H);
  const c0 = proj(rot(0, 0, 0)), halo = ctx.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], S * 1.9);
  halo.addColorStop(0, `rgba(255,214,70,${(.32 * clamp(P.open, 0, 1)).toFixed(2)})`); halo.addColorStop(1, 'rgba(255,214,70,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
  const items = [], resp = reduce ? 0 : Math.sin(t * 1.6) * .03;
  anillos.forEach((r, ri) => {
    const e = clamp((P.open - r.o * .5) / (1 - r.o * .5), 0, 1.2), tilt = .1 + (r.t - .1) * e + resp;
    for (let i = 0; i < r.n; i++) petalo(items, { ...r, tilt, phi: i / r.n * 6.283 + ri * .45, oy: 0 });
  });
  [[.4, 1], [3.6, .85]].forEach(([phi, s]) => petalo(items, { len: 1.05 * s, w: .2, cup: .3, tilt: 1.15 + resp, phi, oy: -.95, c: [47, 125, 70], rizo: .2 }));
  for (let k = 0; k < 16; k++) { const a = k * 2.4, r = .06 + (k % 4) * .035; punto(items, rot(Math.cos(a) * r * P.open, .1 + .05 * P.open, Math.sin(a) * r * P.open), .03, [163, 23, 14], 1); }
  polvo.forEach(([x, y, z, i]) => punto(items, rot(x + Math.sin(t + i) * .1, ((y + t * .08) % 3 + 3) % 3 - 1.2, z), .018, [255, 236, 150], .75));
  caida = caida.filter(f => {
    f.vida -= dt; f.v[1] -= 1.5 * dt; f.p = f.p.map((c, i) => c + f.v[i] * dt); f.v = f.v.map(v => v * (1 - .7 * dt)); f.r += f.vr * dt;
    if (f.vida > 0) { const q = proj(rot(...f.p)); items.push({ z: 0, d() { ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(f.r); ctx.beginPath(); ctx.ellipse(0, 0, q[2] * .05, q[2] * .11, 0, 0, 7); ctx.fillStyle = `rgba(245,197,24,${clamp(f.vida, 0, 1).toFixed(2)})`; ctx.fill(); ctx.restore(); } }); }
    return f.vida > 0;
  });
  const a = proj(rot(0, 0, 0)), b = proj(rot(0, -1.7, 0)), g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  g.addColorStop(0, '#2f7d46'); g.addColorStop(1, 'rgba(47,125,70,0)');
  ctx.strokeStyle = g; ctx.lineWidth = S * .09; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(a[0] + S * .1, (a[1] + b[1]) / 2, b[0], b[1]); ctx.stroke();
  items.sort((p, q) => q.z - p.z).forEach(i => i.d());
}

function frame(now) {
  if (!on) { running = false; return; }
  const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
  if (!drag) { T.ry += .18 * dt; muelle(P, 'ry', T.ry, .5, .8, dt); muelle(P, 'rx', T.rx, .45, .85, dt); }
  muelle(P, 'open', T.open, .7, .55, dt); muelle(P, 'lx', T.lx, .5, 1, dt); muelle(P, 'ly', T.ly, .5, 1, dt);
  dibujar(now / 1000, dt);
  raf(frame);
}
const arrancar = () => { if (!running && !reduce) { running = true; last = performance.now(); raf(frame); } };
const florecer = v => {
  T.open = v ? 1 : 0;
  if (btn) btn.textContent = v ? 'Cerrar la flor' : 'Hacer florecer la flor';
  if (reduce) { P.open = T.open; dibujar(0); return; }
  if (v) { explotar(); if (navigator.vibrate) navigator.vibrate(8); }
};

cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, m: 0, h: [], raw: P.rx }; P.ryv = 0; P.rxv = 0; });
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY; drag.m += Math.abs(dx) + Math.abs(dy);
  if (drag.m < 6) return;                                   // histéresis antes de comprometer el gesto
  P.ry += dx * .008; T.ry = P.ry; drag.raw += dy * .006; P.rx = banda(drag.raw);
  const n = performance.now(); drag.h.push([n, P.ry]); while (drag.h.length > 1 && n - drag.h[0][0] > 90) drag.h.shift();
  if (reduce) dibujar(0);
});
const soltar = () => {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.m < 6) { florecer(T.open < .5); return; }
  let v = 0;
  if (d.h.length > 1) { const a = d.h[0], b = d.h[d.h.length - 1]; v = (b[1] - a[1]) / Math.max((b[0] - a[0]) / 1000, .016); }
  v = clamp(v, -14, 14);
  if (!reduce) { P.ryv = v; T.ry = P.ry + v * .45; T.rx = clamp(d.raw, LO, HI); }   // velocidad heredada + proyección de inercia
};
cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);
if (btn) btn.addEventListener('click', () => florecer(T.open < .5));
if (!reduce && matchMedia('(pointer: fine)').matches) addEventListener('pointermove', e => {
  if (drag) return;
  const r = cv.getBoundingClientRect();
  T.lx = clamp((e.clientX - (r.left + r.width / 2)) / innerWidth * 2, -1, 1); T.ly = clamp((e.clientY - (r.top + r.height / 2)) / innerHeight * 2, -1, 1);
}, { passive: true });
new ResizeObserver(() => { fit(); if (reduce) dibujar(0); }).observe(cv);
new IntersectionObserver(([en]) => { on = en.isIntersecting && !document.hidden; if (on) arrancar(); }).observe(cv);
document.addEventListener('visibilitychange', () => { on = !document.hidden; if (on) arrancar(); });
fit();
if (reduce) dibujar(0);
else {
  arrancar();
  const abrir = () => setTimeout(() => florecer(true), 250);
  if (document.getElementById('carga')) document.addEventListener('carga:fin', abrir, { once: true }); else abrir();
}
})();
