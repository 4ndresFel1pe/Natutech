/* Vivero Las Acacias · flor 3D interactiva (Canvas 2D, sin librerías) e inclinación de tarjetas */
(() => {
'use strict';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  let act = null;
  const quitar = el => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); };
  document.addEventListener('pointermove', e => {
    const t = e.target.closest && e.target.closest('.tarjeta');
    if (act && act !== t) { quitar(act); act = null; }
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--ry', (((e.clientX - r.left) / r.width - .5) * 8).toFixed(2) + 'deg');
    t.style.setProperty('--rx', ((.5 - (e.clientY - r.top) / r.height) * 8).toFixed(2) + 'deg');
    act = t;
  }, { passive: true });
}

const cv = document.getElementById('flor3d');
if (!cv) return;
const ctx = cv.getContext('2d'), btn = document.getElementById('florecer');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const V = { ry: .6, rx: -.7 }, F = 4;
let W = 0, H = 0, S = 0, open = reduce ? 1 : 0, ov = 0, openT = 1, vy = 0, drag = null, on = true, running = false, last = 0;

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
const LUZ = [-.4, .6, -.7];
const rgb = (c, k, a = 1) => `rgba(${c.map(v => Math.round(clamp(v * k, 0, 255))).join()},${a})`;

const anillos = [
  { n: 9, len: 1, w: .3, c: [245, 197, 24], t: 1.3, o: 0, cup: .55 },
  { n: 9, len: .86, w: .28, c: [250, 214, 64], t: .95, o: .35, cup: .6 },
  { n: 6, len: .62, w: .24, c: [255, 228, 120], t: .55, o: .2, cup: .7 }
];
const polvo = Array.from({ length: 22 }, (_, i) => [Math.sin(i * 12.9) * 1.6, i / 22 * 3 - 1.2, Math.cos(i * 7.7) * 1.6, i]);

function petalo(items, { len, w, cup, tilt, phi, oy, c }) {
  const N = 7, loc = [];
  for (let i = 0; i <= N; i++) { const u = i / N, hw = w * Math.sin(Math.PI * Math.pow(u, .7)); loc.push([-hw, u * len, cup * hw * hw]); }
  for (let i = N; i >= 0; i--) { const u = i / N, hw = w * Math.sin(Math.PI * Math.pow(u, .7)); loc.push([hw, u * len, cup * hw * hw]); }
  const p3 = loc.map(p => place(p, tilt, phi, oy)), n = place([0, 0, 1], tilt, phi, 0);
  const luz = .55 + .45 * Math.abs(n[0] * LUZ[0] + n[1] * LUZ[1] + n[2] * LUZ[2]);
  const q = p3.map(proj), a = q[0], b = q[N];
  items.push({ z: p3.reduce((s, p) => s + p[2], 0) / p3.length, d() {
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, rgb(c, luz * .62)); g.addColorStop(1, rgb(c, luz * 1.08));
    ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = rgb(c, .5, .35); ctx.lineWidth = .8; ctx.stroke();
  } });
}
function punto(items, p, r, c, a) {
  const q = proj(p);
  items.push({ z: p[2], d() { ctx.beginPath(); ctx.arc(q[0], q[1], r * q[2], 0, 7); ctx.fillStyle = rgb(c, 1, a); ctx.fill(); } });
}

function dibujar(t) {
  ctx.clearRect(0, 0, W, H);
  const items = [], resp = reduce ? 0 : Math.sin(t * 1.6) * .03;
  anillos.forEach((r, ri) => {
    const e = clamp((open - r.o * .5) / (1 - r.o * .5), 0, 1.15), tilt = .12 + (r.t - .12) * e + resp;
    for (let i = 0; i < r.n; i++)
      petalo(items, { len: r.len, w: r.w, cup: r.cup, tilt, phi: i / r.n * Math.PI * 2 + ri * .5, oy: 0, c: r.c });
  });
  [[.4, 1], [3.6, .85]].forEach(([phi, s]) =>
    petalo(items, { len: 1.05 * s, w: .2, cup: .3, tilt: 1.15 + resp, phi, oy: -.95, c: [47, 125, 70] }));
  for (let k = 0; k < 16; k++) {
    const a = k * 2.4, r = .06 + (k % 4) * .035;
    punto(items, rot(Math.cos(a) * r * open, .1 + .05 * open, Math.sin(a) * r * open), .03, [163, 23, 14], 1);
  }
  polvo.forEach(([x, y, z, i]) => {
    const yy = ((y + t * .08) % 3 + 3) % 3 - 1.2;
    punto(items, rot(x + Math.sin(t + i) * .1, yy, z), .018, [255, 236, 150], .75);
  });
  const a = proj(rot(0, 0, 0)), b = proj(rot(0, -1.7, 0));
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  g.addColorStop(0, '#2f7d46'); g.addColorStop(1, 'rgba(47,125,70,0)');
  ctx.strokeStyle = g; ctx.lineWidth = S * .09; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(a[0] + S * .1, (a[1] + b[1]) / 2, b[0], b[1]); ctx.stroke();
  items.sort((p, q) => q.z - p.z).forEach(i => i.d());
}

function frame(now) {
  if (!on) { running = false; return; }
  const dt = Math.min((now - last) / 1000, .05); last = now;
  ov += ((openT - open) * 60 - ov * 9) * dt; open += ov * dt;       // resorte: florece con un pequeño rebote
  if (!drag) { V.ry += (vy + .25) * dt; vy *= Math.pow(.04, dt); }  // inercia + giro lento
  dibujar(now / 1000);
  requestAnimationFrame(frame);
}
const arrancar = () => { if (!running && !reduce) { running = true; last = performance.now(); requestAnimationFrame(frame); } };
const florecer = v => {
  openT = v ? 1 : 0;
  if (btn) btn.textContent = v ? 'Cerrar la flor' : 'Hacer florecer la flor';
  if (reduce) { open = openT; dibujar(0); }
};

cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, m: 0 }; });
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY; drag.m += Math.abs(dx) + Math.abs(dy);
  V.ry += dx * .008; V.rx = clamp(V.rx + dy * .006, -1.3, -.1); vy = dx * .4;
  if (reduce) dibujar(0);
});
const soltar = () => { if (drag && drag.m < 5) florecer(openT < .5); drag = null; };
cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', () => { drag = null; });
if (btn) btn.addEventListener('click', () => florecer(openT < .5));
new ResizeObserver(() => { fit(); if (reduce) dibujar(0); }).observe(cv);
new IntersectionObserver(([en]) => { on = en.isIntersecting && !document.hidden; if (on) arrancar(); }).observe(cv);
document.addEventListener('visibilitychange', () => { on = !document.hidden; if (on) arrancar(); });
fit();
if (reduce) dibujar(0); else { openT = 0; setTimeout(() => florecer(true), 450); arrancar(); }
})();
