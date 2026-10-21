/* Vivero Las Acacias · mecánicas de AYRO CLEAN: carga por clic, hoja de WhatsApp, pestañas móviles y videos */
(() => {
'use strict';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pag = document.body.dataset.pagina || '', html = document.documentElement;
const publico = /^(catalogo|detalle)$/.test(pag), panel = /^(inventario|pedidos|formulario)$/.test(pag);
const buzz = n => { if (navigator.vibrate) try { navigator.vibrate(n); } catch (e) {} };
const pickSrc = (s, v) => { const p = s.split('|'); if (p.length < 2) return s; return v.canPlayType('video/mp4; codecs="avc1.640028"') ? p[0] : v.canPlayType('video/webm; codecs="vp9"') ? p[1] : p[0]; };
const IC = { wa: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1.4-4.2A8 8 0 1 1 8.4 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-.9.7a4 4 0 0 1-1.6-1.6l.7-.9-1-2z"/></svg>' };

/* ---------- Pantalla de carga al hacer clic en un enlace de otra página ---------- */
const MSG = [[/detalle/, 'Trayendo tu planta'], [/inventario/, 'Abriendo el inventario'], [/pedidos/, 'Cargando los pedidos'], [/producto-form/, 'Preparando el formulario'], [/ingresar/, 'Abriendo el panel'], [/./, 'Abriendo el vivero']];
let yendo = false;
document.addEventListener('click', e => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || yendo) return;
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-sin-carga') || a.closest('dialog')) return;
  let u; try { u = new URL(a.href, location.href); } catch (x) { return; }
  if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
  const tpl = window.__ldTpl; if (!tpl) return;
  e.preventDefault(); yendo = true; buzz(6);
  const ld = tpl.cloneNode(true), msg = ld.querySelector('.ld-msg'), bar = ld.querySelector('.ld-bar span');
  msg.textContent = MSG.find(m => m[0].test(u.pathname))[1];
  ld.style.transition = 'none'; ld.style.transform = 'translateY(-105%)';
  document.body.appendChild(ld); html.classList.add('loading');
  void ld.offsetHeight;
  ld.style.transition = 'transform .6s cubic-bezier(.77,0,.175,1)'; ld.style.transform = 'none';
  requestAnimationFrame(() => { bar.style.transform = 'scaleX(.9)'; });
  try { sessionStorage.setItem('vla-nav', '1'); } catch (x) {}
  setTimeout(() => { location.href = u.href; }, RM ? 80 : 650);
}, true);
addEventListener('pageshow', e => { if (e.persisted) { yendo = false; document.querySelectorAll('#loader').forEach(l => l.remove()); html.classList.remove('loading'); } });

/* ---------- Ondas de toque y pétalos al presionar ---------- */
if (!RM) addEventListener('pointerdown', e => {
  const t = e.target.closest && e.target.closest('.boton, .fab, .tab, .navegacion a, .wa-chip');
  if (!t) return;
  const r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement('span');
  s.className = 'rip'; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  t.appendChild(s); s.addEventListener('animationend', () => s.remove());
  if (t.matches('.boton, .fab')) for (let i = 0; i < 8; i++) {
    const a = Math.PI * 2 * i / 8 + Math.random() * .6, dist = 40 + Math.random() * 50, p = document.createElement('span');
    p.className = 'pop';
    p.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;--s:${(7 + Math.random() * 6).toFixed(0)}px;--dx:${(Math.cos(a) * dist).toFixed(0)}px;--dy:${(Math.sin(a) * dist).toFixed(0)}px;--r:${(Math.random() * 200 - 100).toFixed(0)}deg;--c:${['#f4a9c6', '#e2525f', '#f5c518', '#8fd19e'][i % 4]}`;
    document.body.appendChild(p); p.addEventListener('animationend', () => p.remove());
  }
}, { passive: true });

/* ---------- Pestañas inferiores (móvil) ---------- */
const own = pag === 'catalogo', H = h => own ? h : 'index.html' + h;
const P = {
  inicio: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z',
  catalogo: 'M5 19c0-9 5-14 14-14 0 9-5 14-14 14zM5 19l8-8',
  temporada: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  nosotros: 'M9 5.2a3 3 0 1 1 0 5.6 3 3 0 0 1 0-5.6zM3.5 19a5.5 5.5 0 0 1 11 0M16 14.2a4.6 4.6 0 0 1 4.5 4.3M17 6.6a2.6 2.6 0 1 1 0 5.2',
  escribir: 'M4 5h16v11H9l-5 4z',
  inventario: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',
  pedidos: 'M9 6h11M9 12h11M9 18h11M4.5 6l1 1 2-2M4.5 12l1 1 2-2M4.5 18l1 1 2-2',
  nuevo: 'M12 5v14M5 12h14'
};
const TABS = publico ? [['inicio', 'Inicio', H('#inicio')], ['catalogo', 'Catálogo', H('#catalogo')], ['temporada', 'Temporada', H('#temporada')], ['nosotros', 'Nosotros', H('#nosotros')], ['escribir', 'Escribir', '#', 1]]
  : panel ? [['inventario', 'Inventario', 'inventario.html'], ['pedidos', 'Pedidos', 'pedidos.html'], ['nuevo', 'Nuevo', 'producto-form.html'], ['catalogo', 'Catálogo', 'index.html#catalogo']] : [];
let tabbar = null;
if (TABS.length) {
  tabbar = document.createElement('nav'); tabbar.className = 'tabbar'; tabbar.id = 'tabbar'; tabbar.setAttribute('aria-label', 'Secciones');
  tabbar.style.setProperty('--n', TABS.length);
  tabbar.innerHTML = '<span class="tab-ind" aria-hidden="true"></span>' + TABS.map(t => `<a class="tab" href="${t[2]}" data-s="${t[0]}"${t[3] ? ' data-wa' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[t[0]]}"/></svg><span>${t[1]}</span></a>`).join('');
  document.body.appendChild(tabbar); html.classList.add('tab-on');
  tabbar.addEventListener('click', e => { if (e.target.closest('.tab')) buzz(6); });
}
const tabs = tabbar ? [...tabbar.querySelectorAll('.tab')] : [], pills = [...document.querySelectorAll('.navegacion a[data-s]')];
const activar = id => {
  const key = id === 'contacto' ? 'nosotros' : id;
  pills.forEach(a => { a.dataset.s === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); });
  tabs.forEach((t, i) => { const on = t.dataset.s === key; if (on) { t.setAttribute('aria-current', 'true'); tabbar.style.setProperty('--i', i); } else t.removeAttribute('aria-current'); });
};
if (pag === 'detalle') activar('catalogo');
if (panel) activar(pag === 'formulario' ? 'nuevo' : pag);
if (own && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) activar(e.target.id); }), { rootMargin: '-40% 0px -55% 0px' });
  ['inicio', 'temporada', 'catalogo', 'nosotros', 'contacto'].forEach(id => { const s = document.getElementById(id); if (s) io.observe(s); });
}

/* ---------- Videos de "Nosotros": se reproducen al verse, con respaldo en imagen animada ---------- */
document.querySelectorAll('.val-art').forEach(art => {
  const v = art.querySelector('.val-vid'), im = art.querySelector('.val-img');
  let failed = false, loaded = false, seen = false, chk = 0;
  const usarImg = () => { if (RM || failed) return; failed = true; clearTimeout(chk); v.pause(); v.hidden = true; im.hidden = false; im.addEventListener('error', () => { im.src = v.poster; }, { once: true }); im.src = v.dataset.anim; };
  const play = () => {
    if (failed || RM) return;
    if (!loaded) { loaded = true; v.src = pickSrc(v.dataset.src, v); }
    const pr = v.play(); if (pr && pr.catch) pr.catch(usarImg);
    clearTimeout(chk); chk = setTimeout(() => { if (seen && !failed && (v.paused || v.readyState < 2)) usarImg(); }, 2500);
  };
  v.addEventListener('error', usarImg);
  if ('IntersectionObserver' in window) new IntersectionObserver(en => en.forEach(e => { seen = e.isIntersecting; if (seen) play(); else if (!failed) v.pause(); }), { rootMargin: '200px 0px' }).observe(art);
  else { seen = true; play(); }
});

/* ---------- Hoja de WhatsApp: sube desde abajo en el móvil, se arrastra con resorte ---------- */
if (!publico) return;
const waLink = () => document.querySelector('a[href*="wa.me"]:not([data-direct]), a[href*="whatsapp.com/send"]:not([data-direct])');
const esWA = a => { try { return /(^|\.)wa\.me$|(^|\.)whatsapp\.com$/.test(new URL(a.href, location.href).hostname); } catch (e) { return false; } };
const fab = document.createElement('a'); fab.className = 'fab'; fab.href = '#'; fab.setAttribute('data-wa', ''); fab.setAttribute('aria-label', 'Escribir por WhatsApp'); fab.innerHTML = IC.wa.replace('width="22" height="22"', 'width="28" height="28"');
document.body.appendChild(fab);

const dlg = document.createElement('dialog'); dlg.className = 'wa'; dlg.id = 'wa'; dlg.setAttribute('aria-labelledby', 'wa-t'); dlg.setAttribute('aria-describedby', 'wa-d');
dlg.innerHTML = `<div class="scrim" data-close></div><div class="sheet" id="wa-sheet">
  <button type="button" class="x" data-close aria-label="Cerrar ventana"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  <div class="drag"><div class="grab" aria-hidden="true"><span></span></div><div class="art">
    <video id="wa-video" class="art-video" muted loop playsinline webkit-playsinline preload="none" disablepictureinpicture role="img" aria-label="Una persona riega orquídeas, tulipanes y girasoles que van floreciendo" poster="img/riego-vivero.jpg" data-src="videos/riego-vivero.mp4|videos/riego-vivero.webm" data-anim="img/riego-vivero.webp"></video>
    <img class="art-anim" hidden alt="Una persona riega orquídeas, tulipanes y girasoles que van floreciendo" draggable="false"></div></div>
  <div class="wa-body"><h2 id="wa-t">Comunícate con nosotros</h2>
    <p class="d" id="wa-d">Cuéntanos qué planta o flor deseas comprar y te respondemos con disponibilidad y precio.</p>
    <label class="visualmente-oculto" for="wa-msg">¿Qué planta o flor buscas?</label>
    <textarea id="wa-msg" maxlength="300" rows="3" placeholder="Ej.: Una orquídea rosada para regalar"></textarea>
    <div class="wa-chips" role="group" aria-label="Ideas para empezar">${['Orquídeas', 'Tulipanes', 'Plantas de interior', 'Frutales', 'Materas y tierra'].map(c => `<button type="button" class="wa-chip">${c}</button>`).join('')}</div>
    <a class="boton wa-go" data-direct href="#" target="_blank" rel="noopener">${IC.wa}Escribir por WhatsApp<span class="visualmente-oculto"> (se abre en una pestaña nueva)</span></a>
    <p class="fine">Respondemos tan pronto podemos.</p></div></div>`;
document.body.appendChild(dlg);

const sheet = dlg.querySelector('.sheet'), scrim = dlg.querySelector('.scrim'), dragZone = dlg.querySelector('.drag');
const area = dlg.querySelector('#wa-msg'), go = dlg.querySelector('.wa-go'), vid = dlg.querySelector('#wa-video'), animImg = dlg.querySelector('.art-anim');
const mobileMQ = matchMedia('(max-width: 700px)');
let lastTrigger = null, cVal = 1, raf = 0, closing = false, shDrag = false, pending = false, startY = 0, startC = 0, hist = [], pid = null, useAnim = false, vidTimer = 0, num = '', inicial = '';
const sheetH = () => sheet.offsetHeight || 420, rubber = (o, d) => o * d * .55 / (d + .55 * o);

const armar = () => {
  const m = area.value.trim();
  const texto = m ? (m !== inicial.trim() && !/^hola/i.test(m) ? 'Hola, Vivero Las Acacias 👋 Quiero consultar por: ' + m : m) : (inicial || 'Hola, Vivero Las Acacias 👋 Me gustaría consultar por una planta o flor.');
  go.href = num ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}` : '#';
};
area.addEventListener('input', armar);
dlg.querySelectorAll('.wa-chip').forEach(b => b.addEventListener('click', () => {
  const v = area.value.trim(), c = b.textContent.toLowerCase();
  area.value = v ? `${v.replace(/[.,]$/, '')}, ${c}` : `Me interesan: ${c}`; armar(); area.focus({ preventScroll: true });
}));

const ensureVideo = () => { if (vid.dataset.ready) return; vid.dataset.ready = '1'; vid.src = pickSrc(vid.dataset.src, vid); };
const startAnim = () => { vid.pause(); vid.hidden = true; animImg.hidden = false; animImg.src = vid.dataset.anim; };
const stopAnim = () => { clearTimeout(vidTimer); if (!animImg.hidden) animImg.removeAttribute('src'); };
const fallToAnim = () => { if (RM) return; useAnim = true; if (dlg.open) startAnim(); };
animImg.addEventListener('error', () => { animImg.src = vid.poster; }, { once: true });
vid.addEventListener('error', fallToAnim);
vid.addEventListener('click', () => { if (vid.paused) { const p = vid.play(); if (p && p.catch) p.catch(() => {}); } });
const calentar = () => setTimeout(ensureVideo, 1200);
if (window.__ldDone) calentar(); else document.addEventListener('loader-done', calentar, { once: true });

const render = c => {
  cVal = c; const cc = Math.max(0, Math.min(1, c));
  scrim.style.opacity = String(1 - cc);
  if (mobileMQ.matches) { sheet.style.transform = `translate3d(0,${(c * sheetH()).toFixed(1)}px,0)`; sheet.style.opacity = '1'; }
  else { sheet.style.transform = `translate3d(0,${(cc * 18).toFixed(1)}px,0) scale(${(1 - cc * .06).toFixed(4)})`; sheet.style.opacity = String(1 - cc); }
};
const springTo = (target, v0, zeta, resp, done) => {   // resorte: parte de la posición y velocidad actuales
  cancelAnimationFrame(raf);
  if (RM) { render(target); if (done) done(); return; }
  const k = Math.pow(2 * Math.PI / resp, 2), cd = 2 * zeta * Math.sqrt(k); let x = cVal, v = v0, last = performance.now();
  const step = now => {
    const dt = Math.min(.032, (now - last) / 1000); last = now;
    v += (-k * (x - target) - cd * v) * dt; x += v * dt; render(x);
    if (Math.abs(x - target) < .002 && Math.abs(v) < .02) { render(target); if (done) done(); return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
};
const abrirWA = trigger => {
  lastTrigger = trigger; closing = false;
  const src = esWA(trigger) ? trigger : waLink();
  num = ''; inicial = '';
  if (src) { const u = new URL(src.href, location.href); num = (u.hostname.endsWith('wa.me') ? u.pathname : u.searchParams.get('phone') || '').replace(/\D/g, ''); inicial = u.searchParams.get('text') || ''; }
  area.value = inicial; armar();
  html.classList.add('sheet-open'); dlg.showModal(); render(1); ensureVideo();
  if (!RM) {
    if (useAnim) startAnim();
    else { try { vid.currentTime = 0; } catch (e) {} const p = vid.play(); if (p && p.catch) p.catch(fallToAnim); clearTimeout(vidTimer); vidTimer = setTimeout(() => { if (dlg.open && !useAnim && (vid.paused || vid.readyState < 2)) fallToAnim(); }, 1800); }
  }
  springTo(0, 0, mobileMQ.matches ? .86 : .95, .42); buzz(8);
};
const finishClose = () => { closing = false; if (dlg.open) dlg.close(); vid.pause(); stopAnim(); html.classList.remove('sheet-open'); if (lastTrigger && lastTrigger.focus) try { lastTrigger.focus({ preventScroll: true }); } catch (e) {} };
const closeWA = () => { if (closing || !dlg.open) return; closing = true; springTo(1, 0, 1, .32, finishClose); };
dlg.addEventListener('cancel', e => { e.preventDefault(); closeWA(); });
dlg.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeWA(); else if (e.target.closest('.wa-go') && num) setTimeout(closeWA, 400); });
document.addEventListener('click', e => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const t = e.target.closest && e.target.closest('[data-wa]'), a = e.target.closest && e.target.closest('a[href]');
  if (t) { e.preventDefault(); abrirWA(t); return; }
  if (a && !a.closest('dialog') && !a.hasAttribute('data-direct') && esWA(a)) { e.preventDefault(); abrirWA(a); }
});
dragZone.addEventListener('pointerdown', e => { if (!mobileMQ.matches) return; cancelAnimationFrame(raf); closing = false; pending = true; shDrag = false; startY = e.clientY; startC = cVal; pid = e.pointerId; hist = [{ y: e.clientY, t: e.timeStamp }]; });
dragZone.addEventListener('pointermove', e => {
  if (!pending && !shDrag) return;
  if (pending) { if (Math.abs(e.clientY - startY) < 6) return; pending = false; shDrag = true; startY = e.clientY; startC = cVal; try { dragZone.setPointerCapture(pid); } catch (x) {} }
  let c = startC + (e.clientY - startY) / sheetH();
  if (c < 0) c = -rubber(-c * sheetH(), sheetH()) / sheetH();
  render(c); hist.push({ y: e.clientY, t: e.timeStamp }); while (hist.length > 2 && e.timeStamp - hist[0].t > 100) hist.shift();
});
const endDrag = e => {
  if (pending) { pending = false; return; }
  if (!shDrag) return; shDrag = false;
  try { dragZone.releasePointerCapture(e.pointerId); } catch (x) {}
  let v = 0;
  if (hist.length > 1) { const a0 = hist[0], b0 = hist[hist.length - 1], dts = (b0.t - a0.t) / 1000; if (dts > 0 && e.timeStamp - b0.t < 80) v = ((b0.y - a0.y) / dts) / sheetH(); }
  if (cVal + v * .499 > .5) { closing = true; springTo(1, v, 1, .32, finishClose); } else springTo(0, v, .8, .35);
};
dragZone.addEventListener('pointerup', endDrag); dragZone.addEventListener('pointercancel', endDrag);
})();
