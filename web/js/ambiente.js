/* Vivero Las Acacias · fondo vivo: hojas, pétalos de orquídea y tulipanes que caen despacio */
(() => {
'use strict';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const panel = /^(inventario|pedidos|formulario)$/.test(document.body.dataset.pagina || '');
const cv = document.createElement('canvas');
cv.id = 'fondo-vivo'; cv.setAttribute('aria-hidden', 'true'); document.body.prepend(cv);
const ctx = cv.getContext('2d');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), rnd = (a, b) => a + Math.random() * (b - a);
const PAL = {
  hoja: [[78, 150, 98], [47, 125, 70], [122, 168, 84]],
  orquidea: [[233, 150, 190], [244, 192, 216], [214, 112, 162]],
  tulipan: [[226, 84, 100], [240, 132, 142], [246, 198, 70]]
};
let W = 0, H = 0, ps = [], viento = 0, on = true, last = 0, running = false;

const nueva = inicio => {
  const r = Math.random(), tipo = r < .42 ? 'hoja' : r < .75 ? 'orquidea' : 'tulipan', z = rnd(.35, 1);
  return { tipo, z, col: PAL[tipo][Math.floor(Math.random() * 3)], x: rnd(0, W), y: inicio ? rnd(-40, H) : rnd(-70, -20),
    s: (tipo === 'hoja' ? rnd(12, 20) : rnd(9, 15)) * (.6 + .6 * z), vy: rnd(18, 34) * (.5 + .7 * z),
    amp: rnd(14, 40), fr: rnd(.25, .6), ph: rnd(0, 6.28), rot: rnd(0, 6.28), vr: rnd(-.8, .8), flip: rnd(0, 6.28), vf: rnd(.8, 1.8) };
};
const fit = () => {
  const d = Math.min(devicePixelRatio || 1, 1.5);
  W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
  const n = panel ? 8 : W < 640 ? 10 : 18;
  while (ps.length < n) ps.push(nueva(true));
  ps.length = n;
};
const forma = tipo => {
  ctx.beginPath();
  if (tipo === 'hoja') { ctx.moveTo(0, -1); ctx.bezierCurveTo(.75, -.45, .65, .6, 0, 1); ctx.bezierCurveTo(-.65, .6, -.75, -.45, 0, -1); }
  else if (tipo === 'orquidea') { ctx.moveTo(0, 1); ctx.bezierCurveTo(1.1, .5, 1.3, -1.2, 0, -1); ctx.bezierCurveTo(-1.3, -1.2, -1.1, .5, 0, 1); }
  else { ctx.moveTo(0, -1); ctx.bezierCurveTo(.95, -.2, .85, .85, 0, 1); ctx.bezierCurveTo(-.85, .85, -.95, -.2, 0, -1); }
};
const dibujar = t => {
  ctx.clearRect(0, 0, W, H);
  for (const p of ps) {
    const x = p.x + Math.sin(t * p.fr + p.ph) * p.amp, c = Math.cos(p.flip);
    const fade = clamp(p.y / 90, 0, 1) * clamp((H - p.y) / 140, 0, 1);
    if (fade <= 0) continue;
    ctx.save(); ctx.translate(x, p.y); ctx.rotate(p.rot);
    ctx.scale(p.s * (p.tipo === 'hoja' ? .7 : .9) * Math.max(.18, Math.abs(c)), p.s);
    ctx.globalAlpha = (.2 + .3 * p.z) * fade;
    ctx.fillStyle = `rgb(${p.col.map(v => (v * (c > 0 ? 1 : .82)) | 0)})`;
    forma(p.tipo); ctx.fill();
    ctx.lineWidth = .06; ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.moveTo(0, -.7); ctx.lineTo(0, .8); ctx.stroke();
    ctx.restore();
  }
};
const frame = now => {
  if (!on) { running = false; return; }
  const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
  viento *= Math.exp(-2 * dt);
  ps.forEach((p, i) => {
    p.y += p.vy * dt; p.x += (10 + viento) * dt * (.5 + p.z); p.rot += p.vr * dt; p.flip += p.vf * dt;
    if (p.x > W + 60) p.x = -40; else if (p.x < -60) p.x = W + 40;
    if (p.y > H + 30) ps[i] = nueva(false);
  });
  dibujar(now / 1000);
  requestAnimationFrame(frame);
};
const arrancar = () => { if (!running && !reduce) { running = true; last = performance.now(); requestAnimationFrame(frame); } };
let sy = scrollY;
addEventListener('scroll', () => { viento = clamp(viento + (scrollY - sy) * .5, -140, 140); sy = scrollY; }, { passive: true });  // el scroll mueve el viento
addEventListener('resize', () => { fit(); if (reduce) dibujar(0); });
document.addEventListener('visibilitychange', () => { on = !document.hidden; if (on) arrancar(); });
fit();
if (reduce) dibujar(0); else arrancar();
})();
