/* Detecta la lista de productos que dibuja el catálogo y la marca con .pv-2x2
   (el CSS la pone en 2 columnas solo en celular). No cambia nada en PC. */
(function () {
  var zona = document.getElementById('zona-resultados');
  if (!zona) return;
  var pendiente = false;

  function esTarjeta(el) {
    return !!el.querySelector('img,button,a,h2,h3,h4') && el.textContent.trim().length > 4;
  }
  function marcar() {
    pendiente = false;
    var previo = zona.querySelector('.pv-2x2');
    var mejor = null, max = 1;
    var todos = zona.querySelectorAll('*');
    for (var i = 0; i < todos.length; i++) {
      var el = todos[i], h = el.children;
      if (h.length < 2 || /^(SELECT|SCRIPT|STYLE|SVG|PICTURE|TABLE|TR|TBODY)$/i.test(el.tagName)) continue;
      var tag = h[0].tagName, ok = true;
      for (var j = 0; j < h.length; j++) {
        if (h[j].tagName !== tag || !esTarjeta(h[j])) { ok = false; break; }
      }
      if (ok && h.length > max) { max = h.length; mejor = el; }
    }
    if (mejor === previo) return;
    if (previo) previo.classList.remove('pv-2x2');
    if (mejor) mejor.classList.add('pv-2x2');
  }
  function pedir() { if (!pendiente) { pendiente = true; requestAnimationFrame(marcar); } }

  new MutationObserver(pedir).observe(zona, { childList: true, subtree: true });
  pedir();
})();
