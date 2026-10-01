/* =========================================================================
   Natutech · Vivero Las Acacias · Lógica del prototipo (Entrega 2)

   Un solo archivo para las cuatro pantallas. Cada página dice cuál es en
   <body data-pagina="...">, y al final del archivo se llama la función que le toca.

   Los datos vienen de datos/ejemplo.json, que usa exactamente los mismos nombres
   de campo que api/openapi.yaml y docs/modelo-datos.md. En la Entrega 3 solo
   cambia cargarDatos(): leerá de la API en lugar del archivo.

   El HTML se construye con la función crear() y nunca con innerHTML, para que
   ningún texto (ni lo que alguien escriba en el buscador) se interprete como HTML.
   ========================================================================= */

"use strict";

const CONFIG = {
  rutaDatos: "datos/ejemplo.json",
  nombreNegocio: "Vivero Las Acacias",
  // Número de ejemplo. Se reemplaza por el del vivero cuando el dueño lo autorice.
  whatsapp: "573000000000",
  // En el catálogo público se avisa "Quedan N" desde este número hacia abajo.
  pocasUnidades: 3,
  // Milisegundos que dura la demostración de carga lenta (?estado=cargando).
  esperaCargaLenta: 3000,
  // La franja de temporada solo aparece si faltan estos días o menos.
  diasParaAnunciar: 60,
};

const NOMBRES_LUZ = { baja: "Poca luz", media: "Luz media o indirecta", alta: "Sol directo" };
const NOMBRES_CUIDADO = { facil: "Fácil", intermedio: "Intermedio", avanzado: "Avanzado" };

const formatoPrecio = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const formatoFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long" });

const parametros = new URLSearchParams(window.location.search);
// Para la sustentación: ?estado=cargando, ?estado=vacio o ?estado=error fuerzan cada estado.
const estadoForzado = parametros.get("estado");

/* ---------- Utilidades generales ---------- */

function $(selector) {
  return document.querySelector(selector);
}

// Crea un elemento con sus atributos y sus hijos. "clase" y "texto" son atajos.
function crear(etiqueta, atributos = {}, ...hijos) {
  const elemento = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === "clase") elemento.className = valor;
    else if (clave === "texto") elemento.textContent = valor;
    else elemento.setAttribute(clave, valor === true ? "" : String(valor));
  }
  for (const hijo of hijos) {
    if (hijo !== null && hijo !== undefined && hijo !== false) elemento.append(hijo);
  }
  return elemento;
}

function esperar(milisegundos) {
  return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

// Quita tildes y pasa a minúsculas para que "palma" encuentre "Pálma" y "cuna" encuentre "Cuna".
function normalizar(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function porNombre(a, b) {
  return a.nombre.localeCompare(b.nombre, "es");
}

function plural(cantidad, singular, pluralTexto) {
  return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
}

// "2026-11-02" se interpreta como fecha local de Colombia, no como medianoche UTC.
function fechaLocal(iso) {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function diasHasta(iso) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((fechaLocal(iso) - hoy) / 86400000);
}

function proximaTemporada(temporadas) {
  return (
    temporadas
      .map((temporada) => ({ ...temporada, dias: diasHasta(temporada.fecha) }))
      .filter((temporada) => temporada.dias >= 0)
      .sort((a, b) => a.dias - b.dias)[0] || null
  );
}

/* ---------- Carga de datos y estados de la interfaz ---------- */

async function cargarDatos() {
  if (estadoForzado === "cargando") await esperar(CONFIG.esperaCargaLenta);
  const ruta = estadoForzado === "error" ? "datos/no-existe.json" : CONFIG.rutaDatos;
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) throw new Error(`No se pudo leer ${ruta}: respuesta ${respuesta.status}`);
  const datos = await respuesta.json();
  if (estadoForzado === "vacio") {
    datos.productos = [];
    datos.alertas = [];
  }
  return datos;
}

// Panel para los estados cargando, vacío, error y éxito. Siempre con título y texto.
function panelEstado(tipo, { titulo, texto, nivel = "h2", acciones = [] }) {
  const roles = { cargando: "status", vacio: "status", error: "alert", exito: "status" };
  return crear(
    "div",
    { clase: `estado estado--${tipo}`, role: roles[tipo] },
    tipo === "cargando" ? crear("div", { clase: "cargador", "aria-hidden": "true" }) : null,
    crear(nivel, { texto: titulo, tabindex: "-1" }),
    crear("p", { texto }),
    acciones.length ? crear("div", { clase: "estado__acciones" }, ...acciones) : null
  );
}

function panelError(nivel = "h2") {
  const abiertoComoArchivo = window.location.protocol === "file:";
  const reintentar = crear("button", { type: "button", clase: "boton", texto: "Intentar de nuevo" });
  reintentar.addEventListener("click", () => {
    parametros.delete("estado");
    window.location.search = parametros.toString();
  });
  return panelEstado("error", {
    nivel,
    titulo: "No se pudieron cargar los datos",
    texto: abiertoComoArchivo
      ? "El navegador no deja leer datos/ejemplo.json cuando la página se abre como archivo. Ábrala con un servidor local, como explica el README."
      : "Revise su conexión a internet e intente de nuevo. Si el problema sigue, escríbanos por WhatsApp.",
    acciones: [reintentar],
  });
}

function mostrarEn(zona, ...contenido) {
  zona.replaceChildren(...contenido);
  zona.setAttribute("aria-busy", "false");
}

/* ---------- WhatsApp y disponibilidad ---------- */

function enlaceWhatsApp(mensaje) {
  return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

function mensajeProducto(producto) {
  if (producto.stock === 0) {
    return `Hola, ${CONFIG.nombreNegocio}. ¿Cuándo les vuelve a llegar ${producto.nombre} (${producto.presentacion})?`;
  }
  return `Hola, ${CONFIG.nombreNegocio}. Me interesa: ${producto.nombre} (${producto.presentacion}), ${formatoPrecio.format(producto.precio)}. ¿Está disponible?`;
}

function botonWhatsApp(producto, { ancho = false } = {}) {
  return crear(
    "a",
    {
      clase: ancho ? "boton boton--ancho" : "boton",
      href: enlaceWhatsApp(mensajeProducto(producto)),
      target: "_blank",
      rel: "noopener",
    },
    producto.stock === 0 ? "Preguntar cuándo llega" : "Consultar por WhatsApp",
    crear("span", {
      clase: "visualmente-oculto",
      texto: ` sobre ${producto.nombre} (se abre en una pestaña nueva)`,
    })
  );
}

// Lo que ve el cliente: no se muestra el stock mínimo, solo si hay, si quedan pocas o si se acabó.
function disponibilidadPublica(producto) {
  if (producto.stock === 0) return { clase: "disponibilidad--agotado", texto: "Agotado" };
  if (producto.stock <= CONFIG.pocasUnidades) {
    return { clase: "disponibilidad--pocas", texto: `Quedan ${producto.stock}` };
  }
  return { clase: "", texto: "Disponible" };
}

// Lo que ve el vivero: se compara contra el stock mínimo de cada producto.
function estadoInventario(producto) {
  if (producto.stock === 0) return { clase: "disponibilidad--agotado", texto: "Agotado" };
  if (producto.stock < producto.stock_minimo) {
    return { clase: "disponibilidad--pocas", texto: "Bajo el mínimo" };
  }
  return { clase: "", texto: "Suficiente" };
}

function tarjetaProducto(producto) {
  const disponibilidad = disponibilidadPublica(producto);
  const idTitulo = `producto-${producto.id}`;
  return crear(
    "li",
    {},
    crear(
      "article",
      { clase: "tarjeta", "aria-labelledby": idTitulo },
      crear("img", {
        clase: "tarjeta__imagen",
        src: producto.imagen_url || "img/interior.svg",
        alt: "",
        width: 320,
        height: 240,
        loading: "lazy",
      }),
      crear(
        "div",
        { clase: "tarjeta__cuerpo" },
        crear("h3", { id: idTitulo }, crear("a", { href: `detalle.html?id=${producto.id}`, texto: producto.nombre })),
        crear("p", { clase: "tarjeta__presentacion", texto: producto.presentacion }),
        crear("p", { clase: "tarjeta__precio", texto: formatoPrecio.format(producto.precio) }),
        crear("p", { clase: `disponibilidad ${disponibilidad.clase}`, texto: disponibilidad.texto }),
        crear("div", { clase: "tarjeta__acciones" }, botonWhatsApp(producto, { ancho: true }))
      )
    )
  );
}

/* ---------- Franja de temporada ---------- */

// Devuelve true si la franja quedó visible. Si no hay temporada cercana, la oculta.
function pintarTemporada(seccion, temporada, texto, enlace) {
  if (!seccion) return false;
  if (!temporada || temporada.dias > CONFIG.diasParaAnunciar) {
    seccion.hidden = true;
    return false;
  }
  const numero = temporada.dias === 0 ? "Hoy" : String(temporada.dias);
  const unidad = temporada.dias === 0 ? "" : temporada.dias === 1 ? "día" : "días";
  const cuando = temporada.dias === 0 ? "Es hoy. " : `Faltan ${plural(temporada.dias, "día", "días")}. `;

  seccion.querySelector(".temporada__dias").replaceChildren(numero, unidad ? crear("small", { texto: unidad }) : "");
  seccion.querySelector(".temporada__dias").setAttribute("aria-hidden", "true");
  seccion.querySelector("h2").textContent = `${temporada.nombre}, ${formatoFecha.format(fechaLocal(temporada.fecha))}`;
  seccion
    .querySelector(".temporada__texto")
    .replaceChildren(crear("span", { clase: "visualmente-oculto", texto: cuando }), texto, enlace ? " " : "", enlace || "");
  seccion.hidden = false;
  return true;
}

/* ---------- Pantalla 1: catálogo público (index.html) ---------- */

async function iniciarCatalogo() {
  const zona = $("#zona-resultados");
  const conteo = $("#conteo");
  const formulario = $("#form-filtros");

  let datos;
  try {
    datos = await cargarDatos();
  } catch (error) {
    console.error(error);
    $("#temporada").hidden = true;
    mostrarEn(zona, panelError("h3"));
    return;
  }

  const enlaceEncargo = crear("a", {
    href: enlaceWhatsApp(`Hola, ${CONFIG.nombreNegocio}. Quiero hacer un encargo.`),
    target: "_blank",
    rel: "noopener",
    texto: "Hacer un encargo por WhatsApp",
  });
  enlaceEncargo.append(crear("span", { clase: "visualmente-oculto", texto: " (se abre en una pestaña nueva)" }));
  pintarTemporada(
    $("#temporada"),
    proximaTemporada(datos.temporadas),
    "Encargue con tiempo: en esa fecha las flores y plantas se agotan.",
    enlaceEncargo
  );

  const selectorCategoria = $("#filtro-categoria");
  for (const categoria of datos.categorias) {
    selectorCategoria.append(crear("option", { value: categoria.id, texto: categoria.nombre }));
  }
  // Desde el detalle se puede llegar con ?categoria_id=... ya seleccionada.
  if (parametros.get("categoria_id")) selectorCategoria.value = parametros.get("categoria_id");

  const visibles = datos.productos.filter((producto) => producto.visible_en_catalogo).sort(porNombre);

  if (visibles.length === 0) {
    conteo.textContent = "0 productos";
    formulario.querySelectorAll("input, select, button").forEach((control) => {
      control.disabled = true;
    });
    const consultar = crear("a", {
      clase: "boton",
      href: enlaceWhatsApp(`Hola, ${CONFIG.nombreNegocio}. ¿Qué plantas tienen hoy?`),
      target: "_blank",
      rel: "noopener",
      texto: "Preguntar por WhatsApp",
    });
    mostrarEn(
      zona,
      panelEstado("vacio", {
        nivel: "h3",
        titulo: "Todavía no hay productos publicados",
        texto: "El vivero está organizando su catálogo. Mientras tanto, pregúntenos qué tenemos hoy.",
        acciones: [consultar],
      })
    );
    return;
  }

  function aplicarFiltros() {
    const filtros = new FormData(formulario);
    const textoBuscado = (filtros.get("q") || "").trim();
    const busqueda = normalizar(textoBuscado);
    const categoria = filtros.get("categoria_id");
    const luz = filtros.get("luz");
    const soloDisponibles = filtros.get("solo_disponibles") === "on";

    const lista = visibles.filter(
      (producto) =>
        (!busqueda ||
          normalizar(producto.nombre).includes(busqueda) ||
          normalizar(producto.nombre_cientifico).includes(busqueda)) &&
        (!categoria || producto.categoria_id === categoria) &&
        (!luz || producto.luz === luz) &&
        (!soloDisponibles || producto.stock > 0)
    );

    conteo.textContent = plural(lista.length, "producto", "productos");

    if (lista.length > 0) {
      mostrarEn(zona, crear("ul", { clase: "rejilla" }, ...lista.map(tarjetaProducto)));
      return;
    }

    const quitarFiltros = crear("button", { type: "button", clase: "boton", texto: "Quitar filtros" });
    quitarFiltros.addEventListener("click", () => {
      formulario.reset(); // reset() vacía los campos de inmediato; luego se vuelve a filtrar
      aplicarFiltros();
      $("#buscar").focus();
    });
    mostrarEn(
      zona,
      panelEstado("vacio", {
        nivel: "h3",
        titulo: "No hay productos con esos filtros",
        texto: textoBuscado
          ? `No encontramos nada que coincida con «${textoBuscado}». Pruebe con otra palabra o quite los filtros.`
          : "Pruebe con otra categoría u otro tipo de luz.",
        acciones: [quitarFiltros],
      })
    );
  }

  formulario.addEventListener("input", aplicarFiltros);
  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    aplicarFiltros();
  });
  // El evento reset ocurre antes de que los campos se vacíen; se espera un instante.
  formulario.addEventListener("reset", () => setTimeout(aplicarFiltros, 0));
  aplicarFiltros();
}

/* ---------- Pantalla 2: detalle del producto (detalle.html?id=...) ---------- */

async function iniciarDetalle() {
  const zona = $("#zona-detalle");
  const id = parametros.get("id");

  let datos;
  try {
    datos = await cargarDatos();
  } catch (error) {
    console.error(error);
    mostrarEn(zona, crear("h1", { clase: "visualmente-oculto", texto: "Detalle del producto" }), panelError());
    return;
  }

  const producto = datos.productos.find((p) => p.id === id && p.visible_en_catalogo);

  if (!producto) {
    document.title = "Producto no encontrado | Vivero Las Acacias";
    $("#migas-actual").textContent = "No encontrado";
    mostrarEn(
      zona,
      crear("h1", { texto: "No encontramos ese producto" }),
      panelEstado("vacio", {
        titulo: "Puede que ya no esté en el catálogo",
        texto: "El enlace está incompleto o el vivero retiró ese producto. Búsquelo en el catálogo o pregúntenos por WhatsApp.",
        acciones: [crear("a", { clase: "boton", href: "index.html", texto: "Volver al catálogo" })],
      })
    );
    return;
  }

  const categoria = datos.categorias.find((c) => c.id === producto.categoria_id);
  const disponibilidad = disponibilidadPublica(producto);

  document.title = `${producto.nombre} | Vivero Las Acacias, Yopal`;
  $("#migas-categoria").replaceChildren(
    crear("a", { href: `index.html?categoria_id=${categoria.id}`, texto: categoria.nombre })
  );
  $("#migas-actual").textContent = producto.nombre;

  const ficha = crear("dl", { clase: "ficha" });
  const filas = [
    ["Categoría", categoria.nombre],
    ["Presentación", producto.presentacion],
    ["Luz", NOMBRES_LUZ[producto.luz]],
    ["Riego", producto.riego],
    ["Cuidado", NOMBRES_CUIDADO[producto.cuidado]],
  ];
  for (const [termino, valor] of filas) {
    if (valor) ficha.append(crear("dt", { texto: termino }), crear("dd", { texto: valor }));
  }

  const agotado = producto.stock === 0;
  const informacion = crear(
    "div",
    {},
    crear("h1", { texto: producto.nombre }),
    producto.nombre_cientifico
      ? crear("p", { clase: "detalle__cientifico", lang: "la", texto: producto.nombre_cientifico })
      : null,
    crear("p", { clase: "detalle__precio", texto: formatoPrecio.format(producto.precio) }),
    crear("p", { clase: `disponibilidad ${disponibilidad.clase}`, texto: disponibilidad.texto }),
    producto.descripcion ? crear("p", { texto: producto.descripcion }) : null,
    ficha,
    crear(
      "section",
      { clase: "consulta", "aria-labelledby": "consulta-titulo" },
      crear("h2", { id: "consulta-titulo", texto: agotado ? "Este producto está agotado" : "¿Le interesa?" }),
      crear("p", {
        texto: agotado
          ? "Escríbanos y le avisamos cuando vuelva a llegar."
          : "Escríbanos por WhatsApp: le confirmamos disponibilidad y se lo separamos.",
      }),
      botonWhatsApp(producto)
    )
  );

  const contenido = [
    crear(
      "div",
      { clase: "detalle" },
      crear("img", {
        clase: "detalle__imagen",
        src: producto.imagen_url || "img/interior.svg",
        alt: "",
        width: 640,
        height: 480,
      }),
      informacion
    ),
  ];

  const relacionados = datos.productos
    .filter((p) => p.categoria_id === producto.categoria_id && p.id !== producto.id && p.visible_en_catalogo)
    .slice(0, 4);
  if (relacionados.length > 0) {
    contenido.push(
      crear(
        "section",
        { clase: "relacionados", "aria-labelledby": "relacionados-titulo" },
        crear("h2", { id: "relacionados-titulo", texto: `Más productos de ${categoria.nombre.toLowerCase()}` }),
        crear("ul", { clase: "rejilla" }, ...relacionados.map(tarjetaProducto))
      )
    );
  }

  mostrarEn(zona, ...contenido);
}

/* ---------- Pantalla 3: inventario y alertas (inventario.html) ---------- */

async function iniciarInventario() {
  const zona = $("#zona-panel");
  const anuncios = $("#anuncios");

  let datos;
  try {
    datos = await cargarDatos();
  } catch (error) {
    console.error(error);
    mostrarEn(zona, panelError());
    return;
  }

  if (datos.productos.length === 0) {
    mostrarEn(
      zona,
      panelEstado("vacio", {
        titulo: "El inventario está vacío",
        texto: "Registre el primer producto para empezar a controlar existencias y recibir alertas de reabastecimiento.",
        acciones: [crear("a", { clase: "boton", href: "producto-form.html", texto: "Registrar el primer producto" })],
      })
    );
    return;
  }

  const productos = new Map(datos.productos.map((p) => [p.id, p]));
  const proveedores = new Map(datos.proveedores.map((p) => [p.id, p]));
  const categorias = new Map(datos.categorias.map((c) => [c.id, c]));
  const temporadas = new Map(datos.temporadas.map((t) => [t.id, { ...t, dias: diasHasta(t.fecha) }]));
  const alertasActivas = datos.alertas
    .filter((alerta) => alerta.estado === "activa")
    .sort((a, b) => (a.tipo === b.tipo ? b.creado_en.localeCompare(a.creado_en) : a.tipo === "temporada" ? -1 : 1));

  // Resumen
  const bajoMinimo = datos.productos.filter((p) => p.stock < p.stock_minimo).length;
  const agotados = datos.productos.filter((p) => p.stock === 0).length;
  const valorAlertas = crear("dd", { texto: String(alertasActivas.length) });
  const resumen = crear(
    "dl",
    { clase: "resumen" },
    crear("div", {}, crear("dt", { texto: "Productos" }), crear("dd", { texto: String(datos.productos.length) })),
    crear("div", {}, crear("dt", { texto: "Por debajo del mínimo" }), crear("dd", { texto: String(bajoMinimo) })),
    crear("div", {}, crear("dt", { texto: "Agotados" }), crear("dd", { texto: String(agotados) })),
    crear("div", {}, crear("dt", { texto: "Alertas activas" }), valorAlertas)
  );

  // Franja de la próxima temporada, con cuántos productos no alcanzan
  const proxima = proximaTemporada(datos.temporadas);
  const franja = crear(
    "section",
    { clase: "temporada temporada--panel", "aria-labelledby": "temporada-panel-titulo", hidden: true },
    crear(
      "div",
      { clase: "temporada__fila" },
      crear("p", { clase: "temporada__dias" }),
      crear("div", {}, crear("h2", { id: "temporada-panel-titulo" }), crear("p", { clase: "temporada__texto" }))
    )
  );
  if (proxima) {
    const enRiesgo = alertasActivas.filter((a) => a.tipo === "temporada" && a.temporada_id === proxima.id).length;
    pintarTemporada(
      franja,
      proxima,
      enRiesgo === 0
        ? "Ningún producto está en riesgo para esta fecha."
        : `${plural(enRiesgo, "producto no alcanza", "productos no alcanzan")} lo que se vendió en la misma fecha del año pasado.`,
      null
    );
  }

  // Alertas
  const listaAlertas = crear("ul", { clase: "alertas" });
  for (const alerta of alertasActivas) {
    listaAlertas.append(tarjetaAlerta(alerta));
  }

  function tarjetaAlerta(alerta) {
    const producto = productos.get(alerta.producto_id);
    const proveedor = proveedores.get(producto.proveedor_id);
    const idTitulo = `alerta-${alerta.id}`;
    let tipo;
    let detalle;
    if (alerta.tipo === "temporada") {
      const temporada = temporadas.get(alerta.temporada_id);
      const faltan = Math.max(0, alerta.demanda_estimada - alerta.stock_actual);
      tipo = "Temporada";
      detalle = `${temporada.nombre} en ${plural(temporada.dias, "día", "días")}. En la misma fecha del año pasado se vendieron ${alerta.demanda_estimada}; hay ${alerta.stock_actual}. Faltan ${faltan}.`;
    } else {
      tipo = "Existencia mínima";
      detalle =
        alerta.stock_actual === 0
          ? `Agotado. El mínimo es ${producto.stock_minimo}.`
          : `Quedan ${alerta.stock_actual}; el mínimo es ${producto.stock_minimo}.`;
    }
    const meta = proveedor
      ? `Proveedor: ${proveedor.nombre} (${proveedor.municipio}), entrega en ${plural(proveedor.dias_entrega, "día", "días")}. Aviso del ${formatoFecha.format(new Date(alerta.creado_en))}.`
      : `Sin proveedor fijo. Aviso del ${formatoFecha.format(new Date(alerta.creado_en))}.`;

    const etiquetaTipo = crear("p", { clase: "alerta__tipo", texto: tipo });
    const titulo = crear("h3", { id: idTitulo, tabindex: "-1", texto: producto.nombre });
    const atender = crear("button", { type: "button", clase: "boton boton--secundario" }, "Marcar como atendida", crear("span", { clase: "visualmente-oculto", texto: `: ${producto.nombre}` }));
    const elemento = crear(
      "li",
      { clase: `alerta${alerta.tipo === "temporada" ? " alerta--temporada" : ""}` },
      crear("div", {}, etiquetaTipo, titulo, crear("p", { texto: detalle }), crear("p", { clase: "alerta__meta", texto: meta })),
      crear("div", {}, atender)
    );

    // En el prototipo el cambio vive solo en memoria. En la Entrega 3 será PATCH /alertas/{id}.
    atender.addEventListener("click", () => {
      alerta.estado = "atendida";
      elemento.classList.add("alerta--atendida");
      etiquetaTipo.textContent = `${tipo}, atendida`;
      atender.parentElement.replaceChildren(crear("p", { clase: "alerta__meta", texto: "Atendida hoy" }));
      const activas = datos.alertas.filter((a) => a.estado === "activa").length;
      valorAlertas.textContent = String(activas);
      anuncios.textContent = `Alerta de ${producto.nombre} marcada como atendida. Quedan ${plural(activas, "alerta activa", "alertas activas")}.`;
      titulo.focus();
    });
    return elemento;
  }

  // Tabla de productos con su filtro
  const campoBuscar = crear("input", { type: "search", id: "buscar-inventario", autocomplete: "off" });
  const casillaBajo = crear("input", { type: "checkbox", id: "solo-bajo-minimo" });
  const filtros = crear(
    "div",
    { clase: "barra-filtros" },
    crear("div", { clase: "campo" }, crear("label", { for: "buscar-inventario", texto: "Buscar en el inventario" }), campoBuscar),
    crear("div", { clase: "casilla campo" }, casillaBajo, crear("label", { for: "solo-bajo-minimo", texto: "Solo los que están por debajo del mínimo" }))
  );
  const zonaTabla = crear("div", { "aria-live": "polite" });

  function pintarTabla() {
    const busqueda = normalizar(campoBuscar.value.trim());
    const lista = [...datos.productos]
      .sort(porNombre)
      .filter((p) => (!busqueda || normalizar(p.nombre).includes(busqueda)) && (!casillaBajo.checked || p.stock < p.stock_minimo));

    if (lista.length === 0) {
      zonaTabla.replaceChildren(
        panelEstado("vacio", {
          nivel: "h3",
          titulo: "Ningún producto coincide",
          texto: "Revise lo que escribió o desmarque la casilla de mínimo.",
        })
      );
      return;
    }

    const filas = lista.map((p) => {
      const estado = estadoInventario(p);
      return crear(
        "tr",
        {},
        crear("th", { scope: "row", clase: "tabla__producto" }, p.nombre, crear("span", { clase: "tabla__presentacion", texto: p.presentacion })),
        crear("td", { "data-etiqueta": "Categoría", texto: categorias.get(p.categoria_id).nombre }),
        crear("td", { clase: "numero", "data-etiqueta": "Precio", texto: formatoPrecio.format(p.precio) }),
        crear("td", { clase: "numero", "data-etiqueta": "Existencias", texto: String(p.stock) }),
        crear("td", { clase: "numero", "data-etiqueta": "Mínimo", texto: String(p.stock_minimo) }),
        crear("td", { "data-etiqueta": "Estado" }, crear("span", { clase: `disponibilidad ${estado.clase}`, texto: estado.texto })),
        crear(
          "td",
          { "data-etiqueta": "Acciones" },
          crear("a", { href: `producto-form.html?id=${p.id}` }, "Editar", crear("span", { clase: "visualmente-oculto", texto: ` ${p.nombre}` }))
        )
      );
    });

    zonaTabla.replaceChildren(
      crear(
        "table",
        { clase: "tabla" },
        crear("caption", { texto: `${plural(lista.length, "producto", "productos")}, ordenados por nombre` }),
        crear(
          "thead",
          {},
          crear(
            "tr",
            {},
            ...["Producto", "Categoría", "Precio", "Existencias", "Mínimo", "Estado", "Acciones"].map((columna, indice) =>
              crear("th", { scope: "col", clase: indice >= 2 && indice <= 4 ? "numero" : null, texto: columna })
            )
          )
        ),
        crear("tbody", {}, ...filas)
      )
    );
  }

  campoBuscar.addEventListener("input", pintarTabla);
  casillaBajo.addEventListener("change", pintarTabla);
  pintarTabla();

  mostrarEn(
    zona,
    resumen,
    franja,
    crear(
      "section",
      { "aria-labelledby": "alertas-titulo" },
      crear("h2", { id: "alertas-titulo", texto: "Alertas de reabastecimiento" }),
      alertasActivas.length
        ? listaAlertas
        : panelEstado("vacio", { nivel: "h3", titulo: "No hay alertas activas", texto: "Todas las existencias alcanzan por ahora." })
    ),
    crear(
      "section",
      { "aria-labelledby": "productos-titulo" },
      crear("h2", { id: "productos-titulo", texto: "Productos" }),
      filtros,
      zonaTabla
    )
  );
}

/* ---------- Pantalla 4: formulario de producto (producto-form.html) ---------- */

// Mismas reglas que el esquema ProductoEntrada de api/openapi.yaml.
function validarProducto(formulario, productos, idActual) {
  const errores = [];
  const texto = (campo) => formulario.elements[campo].value.trim();
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });

  const nombre = texto("nombre");
  if (!nombre) agregar("nombre", "Escriba el nombre del producto.");
  else if (nombre.length < 2) agregar("nombre", "El nombre debe tener al menos 2 caracteres.");
  else if (productos.some((p) => p.id !== idActual && normalizar(p.nombre) === normalizar(nombre))) {
    agregar("nombre", `Ya existe un producto llamado «${nombre}». Edite ese producto en lugar de crear otro.`);
  }

  if (!texto("categoria_id")) agregar("categoria_id", "Elija una categoría.");

  const presentacion = texto("presentacion");
  if (!presentacion) agregar("presentacion", "Escriba la presentación, por ejemplo: Matera de 20 cm.");
  else if (presentacion.length < 2) agregar("presentacion", "La presentación debe tener al menos 2 caracteres.");

  const numeros = [
    { campo: "precio", nombre: "el precio", ejemplo: "45000", maximo: 5000000,
      negativo: "El precio no puede ser negativo.", excede: "El precio no puede pasar de $ 5.000.000." },
    { campo: "stock", nombre: "las unidades en existencia", ejemplo: "12", maximo: 100000,
      negativo: "Las unidades en existencia no pueden ser negativas.", excede: "Las unidades en existencia no pueden pasar de 100.000." },
    { campo: "stock_minimo", nombre: "la existencia mínima", ejemplo: "5", maximo: 10000,
      negativo: "La existencia mínima no puede ser negativa.", excede: "La existencia mínima no puede pasar de 10.000." },
  ];
  for (const regla of numeros) {
    const control = formulario.elements[regla.campo];
    const valor = control.value.trim();
    if (control.validity.badInput) {
      agregar(regla.campo, `Escriba ${regla.nombre} solo con números, sin puntos ni signo $. Por ejemplo: ${regla.ejemplo}.`);
    } else if (valor === "") {
      agregar(regla.campo, `Escriba ${regla.nombre}.`);
    } else if (!Number.isInteger(Number(valor))) {
      agregar(regla.campo, `Escriba ${regla.nombre} como número entero, sin decimales.`);
    } else if (Number(valor) < 0) {
      agregar(regla.campo, regla.negativo);
    } else if (Number(valor) > regla.maximo) {
      agregar(regla.campo, regla.excede);
    }
  }

  const imagen = texto("imagen_url");
  if (imagen && !/^https:\/\/\S+$/.test(imagen) && !/^[\w\-./]+$/.test(imagen)) {
    agregar("imagen_url", "Use una dirección que empiece por https:// o una ruta sin espacios, como img/interior.svg.");
  }

  return errores;
}

// Convierte el formulario en el JSON que espera la API: números como números y vacíos como null.
function leerProducto(formulario) {
  const texto = (campo) => formulario.elements[campo].value.trim();
  const opcional = (campo) => texto(campo) || null;
  return {
    categoria_id: texto("categoria_id"),
    proveedor_id: opcional("proveedor_id"),
    nombre: texto("nombre"),
    nombre_cientifico: opcional("nombre_cientifico"),
    descripcion: opcional("descripcion"),
    presentacion: texto("presentacion"),
    precio: Number(texto("precio")),
    stock: Number(texto("stock")),
    stock_minimo: Number(texto("stock_minimo")),
    luz: opcional("luz"),
    riego: opcional("riego"),
    cuidado: formulario.elements.cuidado.value || null,
    imagen_url: opcional("imagen_url"),
    visible_en_catalogo: formulario.elements.visible_en_catalogo.checked,
  };
}

async function iniciarFormulario() {
  const zona = $("#zona-formulario");
  const formulario = $("#form-producto");
  const resumen = $("#resumen-errores");
  const listaErrores = $("#resumen-errores-lista");
  const zonaResultado = $("#zona-resultado");
  const id = parametros.get("id");

  let datos;
  try {
    datos = await cargarDatos();
  } catch (error) {
    console.error(error);
    mostrarEn(zona, panelError());
    return;
  }

  for (const categoria of datos.categorias) {
    formulario.elements.categoria_id.append(crear("option", { value: categoria.id, texto: categoria.nombre }));
  }
  for (const proveedor of datos.proveedores.filter((p) => p.activo)) {
    formulario.elements.proveedor_id.append(
      crear("option", { value: proveedor.id, texto: `${proveedor.nombre} (${proveedor.municipio})` })
    );
  }

  let existente = null;
  if (id) {
    existente = datos.productos.find((p) => p.id === id);
    if (!existente) {
      $("#titulo-formulario").textContent = "No encontramos ese producto";
      $("#migas-actual").textContent = "Producto no encontrado";
      document.title = "Producto no encontrado | Panel del Vivero Las Acacias";
      mostrarEn(
        zona,
        panelEstado("error", {
          titulo: "No se puede editar un producto que no existe",
          texto: "Puede que lo hayan eliminado o que el enlace esté incompleto. Vuelva al inventario y elíjalo de la lista.",
          acciones: [
            crear("a", { clase: "boton", href: "inventario.html", texto: "Volver al inventario" }),
            crear("a", { clase: "boton boton--secundario", href: "producto-form.html", texto: "Registrar un producto nuevo" }),
          ],
        })
      );
      return;
    }
    $("#titulo-formulario").textContent = `Editar ${existente.nombre}`;
    $("#migas-actual").textContent = `Editar ${existente.nombre}`;
    document.title = `Editar ${existente.nombre} | Panel del Vivero Las Acacias`;
    $("#boton-guardar").textContent = "Guardar cambios";
    for (const campo of ["nombre", "nombre_cientifico", "categoria_id", "proveedor_id", "presentacion", "descripcion", "precio", "stock", "stock_minimo", "luz", "riego", "imagen_url"]) {
      formulario.elements[campo].value = existente[campo] ?? "";
    }
    formulario.elements.cuidado.value = existente.cuidado ?? "";
    formulario.elements.visible_en_catalogo.checked = existente.visible_en_catalogo;
  } else {
    $("#nav-nuevo").setAttribute("aria-current", "page");
  }

  // Contador de caracteres de la descripción
  const descripcion = formulario.elements.descripcion;
  const contador = $("#descripcion-contador");
  const actualizarContador = () => {
    contador.textContent = `${descripcion.value.length} de 600 caracteres`;
  };
  descripcion.addEventListener("input", actualizarContador);
  actualizarContador();

  zona.replaceChildren();
  zona.setAttribute("aria-busy", "false");
  formulario.hidden = false;

  function limpiarError(campo) {
    const control = formulario.elements[campo];
    if (control && control.removeAttribute) control.removeAttribute("aria-invalid");
    const mensaje = document.getElementById(`${campo}-error`);
    if (mensaje) mensaje.textContent = "";
  }

  // Al corregir un campo, su error desaparece.
  formulario.addEventListener("input", (evento) => {
    if (evento.target.name) limpiarError(evento.target.name);
  });

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    for (const control of formulario.elements) if (control.name) limpiarError(control.name);
    zonaResultado.replaceChildren();

    const errores = validarProducto(formulario, datos.productos, existente ? existente.id : null);
    if (errores.length > 0) {
      listaErrores.replaceChildren(
        ...errores.map((error) => crear("li", {}, crear("a", { href: `#${error.campo}`, texto: error.mensaje })))
      );
      for (const error of errores) {
        formulario.elements[error.campo].setAttribute("aria-invalid", "true");
        document.getElementById(`${error.campo}-error`).textContent = error.mensaje;
      }
      $("#resumen-errores-titulo").textContent =
        errores.length === 1 ? "Revise 1 campo antes de guardar" : `Revise ${errores.length} campos antes de guardar`;
      resumen.hidden = false;
      resumen.focus();
      return;
    }

    resumen.hidden = true;
    const producto = leerProducto(formulario);

    // Al editar solo se envían los campos que cambiaron (esquema ProductoCambios).
    let cuerpo = producto;
    if (existente) {
      cuerpo = Object.fromEntries(Object.entries(producto).filter(([campo, valor]) => existente[campo] !== valor));
      if (Object.keys(cuerpo).length === 0) {
        zonaResultado.replaceChildren(
          panelEstado("vacio", { titulo: "No hay cambios para guardar", texto: "Ningún campo es distinto de lo que ya estaba registrado." })
        );
        zonaResultado.querySelector("h2").focus();
        return;
      }
    }

    const operacion = existente ? `PATCH /productos/${existente.id}` : "POST /productos";
    const vistaPrevia = crear(
      "details",
      {},
      crear("summary", { texto: "Ver lo que se enviaría a la API" }),
      crear("pre", { clase: "codigo" }, crear("code", { texto: `${operacion}\n\n${JSON.stringify(cuerpo, null, 2)}` }))
    );
    formulario.hidden = true;
    zonaResultado.replaceChildren(
      panelEstado("exito", {
        titulo: existente ? "Cambios guardados" : "Producto guardado",
        texto: `Este prototipo no guarda en ningún servidor. Desde la Entrega 3, este formulario hará ${operacion} con estos datos.`,
        acciones: [
          crear("a", { clase: "boton", href: "inventario.html", texto: "Volver al inventario" }),
          crear("a", { clase: "boton boton--secundario", href: "producto-form.html", texto: "Registrar otro producto" }),
        ],
      }),
      vistaPrevia
    );
    zonaResultado.querySelector("h2").focus();
  });
}

/* ---------- Arranque ---------- */

const PANTALLAS = {
  catalogo: iniciarCatalogo,
  detalle: iniciarDetalle,
  inventario: iniciarInventario,
  formulario: iniciarFormulario,
};

document.addEventListener("DOMContentLoaded", () => {
  const enlacePie = $("#whatsapp-pie");
  if (enlacePie) enlacePie.href = enlaceWhatsApp(`Hola, ${CONFIG.nombreNegocio}. Quiero hacer una consulta.`);
  const iniciar = PANTALLAS[document.body.dataset.pagina];
  if (iniciar) iniciar();
});
