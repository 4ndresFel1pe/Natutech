/* Vivero Las Acacias · ventana "Comunícate con nosotros" antes de abrir WhatsApp */
(() => {
'use strict';
const esWA = a => { try { const u = new URL(a.href, location.href); return /(^|\.)wa\.me$|(^|\.)whatsapp\.com$/.test(u.hostname); } catch (e) { return false; } };
let dlg, area, error, trigger, destino, inicial = '';
const SUG = ['Orquídeas', 'Tulipanes', 'Plantas de interior', 'Frutales', 'Materas y tierra'];

function crear() {
  dlg = document.createElement('dialog');
  dlg.className = 'wa'; dlg.setAttribute('aria-labelledby', 'wa-titulo');
  dlg.innerHTML = `
    <form class="wa__caja" novalidate>
      <button type="button" class="wa__cerrar" data-cerrar aria-label="Cerrar la ventana">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>
      </button>
      <svg class="wa__flor" viewBox="-30 -30 60 60" width="56" height="56" aria-hidden="true">
        ${[0, 1, 2, 3, 4, 5].map(k => `<ellipse cx="0" cy="-13" rx="7" ry="13" transform="rotate(${k * 60})" fill="${k % 2 ? '#f08aaf' : '#f4a9c6'}"/>`).join('')}
        <circle r="6" fill="#f5c518"/>
      </svg>
      <h2 id="wa-titulo">Comunícate con nosotros</h2>
      <p>Cuéntanos qué planta o flor deseas comprar y te respondemos por WhatsApp con disponibilidad y precio.</p>
      <div class="campo">
        <label for="wa-msg">¿Qué planta o flor buscas?</label>
        <textarea id="wa-msg" maxlength="300" rows="3" placeholder="Ej.: Una orquídea rosada para regalar" aria-describedby="wa-error"></textarea>
        <p class="campo__error" id="wa-error" role="alert"></p>
      </div>
      <div class="wa__sugeridos" role="group" aria-label="Ideas para empezar">
        ${SUG.map(s => `<button type="button" class="wa__chip">${s}</button>`).join('')}
      </div>
      <div class="formulario__acciones">
        <button type="submit" class="boton">
          <svg class="boton__icono" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.300 1.200-1.800 1.200-.5.1-1 .2-3.300-.7-2.800-1.100-4.600-4-4.700-4.200-.1-.2-1.100-1.500-1.100-2.800s.7-2 1-2.300c.2-.3.500-.3.700-.3h.5c.2 0 .4 0 .6.500l.9 2.200c.1.200.1.400 0 .5l-.4.600-.4.400c-.1.200-.3.400-.1.700.2.300.8 1.300 1.700 2.100 1.100 1 2.100 1.300 2.400 1.400.3.200.5.100.7-.1l.9-1.100c.2-.3.400-.2.700-.1l2 1c.3.100.5.200.6.300.1.300.1.800-.1 1.400z"/></svg>
          Escribir por WhatsApp<span class="visualmente-oculto"> (se abre en una pestaña nueva)</span>
        </button>
        <button type="button" class="boton boton--secundario" data-cerrar>Ahora no</button>
      </div>
    </form>`;
  document.body.append(dlg);
  area = dlg.querySelector('#wa-msg'); error = dlg.querySelector('#wa-error');
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-cerrar]')) cerrar(); });   // fuera de la caja = cerrar
  dlg.addEventListener('cancel', e => { e.preventDefault(); cerrar(); });                                          // Esc con salida animada
  dlg.querySelectorAll('.wa__chip').forEach(b => b.addEventListener('click', () => {
    const v = area.value.trim();
    area.value = v ? `${v.replace(/[.,]$/, '')}, ${b.textContent.toLowerCase()}` : `Me interesan: ${b.textContent.toLowerCase()}`;
    area.focus(); error.textContent = '';
  }));
  dlg.querySelector('form').addEventListener('submit', enviar);
  area.addEventListener('input', () => { error.textContent = ''; area.removeAttribute('aria-invalid'); });
}

function abrir(a) {
  if (!dlg) crear();
  trigger = a;
  const u = new URL(a.href, location.href);
  const num = u.hostname.endsWith('wa.me') ? u.pathname.replace(/\D/g, '') : (u.searchParams.get('phone') || '').replace(/\D/g, '');
  destino = { u, num };
  inicial = u.searchParams.get('text') || '';
  area.value = inicial; error.textContent = '';
  dlg.showModal();
  const r = a.getBoundingClientRect(), d = dlg.getBoundingClientRect();   // la ventana nace desde el botón que la abrió
  dlg.style.transformOrigin = `${r.left + r.width / 2 - d.left}px ${r.top + r.height / 2 - d.top}px`;
  requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add('visible')));
  area.focus({ preventScroll: true });
}
function cerrar() {
  if (!dlg || !dlg.open) return;
  dlg.classList.remove('visible');
  setTimeout(() => { dlg.close(); if (trigger) trigger.focus({ preventScroll: true }); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240);
}
function enviar(e) {
  e.preventDefault();
  let msg = area.value.trim();
  if (!msg) { error.textContent = 'Cuéntanos qué planta o flor deseas comprar.'; area.setAttribute('aria-invalid', 'true'); area.focus(); return; }
  if (msg !== inicial.trim() && !/^hola/i.test(msg)) msg = 'Hola, quiero consultar por: ' + msg;
  let url;
  if (destino.num) url = `https://wa.me/${destino.num}?text=${encodeURIComponent(msg)}`;
  else { const u = new URL(destino.u); u.searchParams.set('text', msg); url = u.href; }
  window.open(url, '_blank', 'noopener');
  cerrar();
}

document.addEventListener('click', e => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a');
  if (!a || a.closest('dialog.wa') || !esWA(a)) return;
  e.preventDefault(); abrir(a);
}, true);
})();
