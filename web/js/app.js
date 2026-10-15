/* =========================================================================
   Natutech · Vivero Las Acacias · Lógica de las pantallas (Entrega 3)

   Un solo archivo para las seis pantallas. Cada página dice cuál es en
   <body data-pagina="...">, y al final del archivo se llama la función que le toca.

   Los datos llegan de la API (js/api.js) cuando el sitio corre con Docker Compose,
   o de datos/ejemplo.json en modo demostración (GitHub Pages). Los dos usan los
   mismos nombres de campo que api/openapi.yaml, así que las pantallas no cambian.

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

// alcance "publico": lo que ve cualquier cliente. "panel": lo que ve el vivero (pide sesión).
// Siempre devuelve { categorias, proveedores, productos, temporadas, alertas }.
async function cargarDatos(alcance = "publico") {
  if (estadoForzado === "cargando") await esperar(CONFIG.esperaCargaLenta);
  if (estadoForzado === "error") throw new Error("Error de carga forzado con ?estado=error");
  const modo = await Api.detectarModo();
  let datos;
  if (modo === "demostracion") datos = await leerArchivoDeEjemplo();
  else if (alcance === "panel") datos = await leerPanelDeLaApi();
  else datos = await leerCatalogoDeLaApi();
  if (estadoForzado === "vacio") {
    datos.productos = [];
    datos.alertas = [];
  }
  return datos;
}

async function leerArchivoDeEjemplo() {
  const respuesta = await fetch(CONFIG.rutaDatos);
  if (!respuesta.ok) throw new Error(`No se pudo leer ${CONFIG.rutaDatos}: respuesta ${respuesta.status}`);
  return respuesta.json();
}

// GET /categorias, GET /temporadas y GET /catalogo/productos: rutas públicas.
async function leerCatalogoDeLaApi() {
  const [categorias, temporadas, productos] = await Promise.all([
    Api.pedir("/categorias"),
    Api.pedir("/temporadas"),
    Api.todasLasPaginas("/catalogo/productos"),
  ]);
  // El catálogo público solo trae productos visibles; se marca para reutilizar los filtros.
  const visibles = productos.map((producto) => ({ ...producto, visible_en_catalogo: true }));
  return { categorias, temporadas, productos: visibles, proveedores: [], alertas: [] };
}

// Inventario completo, proveedores y alertas activas: rutas que piden sesión.
async function leerPanelDeLaApi() {
  const conSesion = { conSesion: true };
  const [categorias, temporadas, productos, proveedores, alertas] = await Promise.all([
    Api.pedir("/categorias"),
    Api.pedir("/temporadas"),
    Api.todasLasPaginas("/productos", conSesion),
    Api.pedir("/proveedores", conSesion),
    Api.pedir("/alertas?estado=activa", conSesion),
  ]);
  return { categorias, temporadas, productos, proveedores, alertas };
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

function panelError(nivel = "h2", error = null) {
  const abiertoComoArchivo = window.location.protocol === "file:";
  const reintentar = crear("button", { type: "button", clase: "boton", texto: "Intentar de nuevo" });
  reintentar.addEventListener("click", () => {
    parametros.delete("estado");
    window.location.search = parametros.toString();
  });
  if (error instanceof Api.ErrorApi && error.estado === 401) {
    return panelEstado("cargando", { nivel, titulo: "Su sesión terminó", texto: "Lo llevamos a la página de ingreso." });
  }
  let texto = "Revise su conexión a internet e intente de nuevo. Si el problema sigue, escríbanos por WhatsApp.";
  if (abiertoComoArchivo) {
    texto = "El navegador no deja leer datos/ejemplo.json cuando la página se abre como archivo. Ábrala con un servidor local, como explica el README.";
  } else if (error instanceof Api.ErrorApi) {
    texto = error.message;
  }
  return panelEstado("error", { nivel, titulo: "No se pudieron cargar los datos", texto, acciones: [reintentar] });
}

/* ---------- Panel del vivero: sesión y modo ---------- */

// En modo API el panel pide sesión; en modo demostración avisa que nada se guarda.
// Devuelve el modo, o null si la página se va a la pantalla de ingreso.
async function prepararPanel() {
  const modo = await Api.detectarModo();
  if (modo === "api") {
    const actual = Api.sesion.leer();
    if (!actual) {
      Api.irAIngresar();
      return null;
    }
    agregarSalida(actual.usuario);
  }
  return modo;
}

// Aviso del modo demostración. Cada pantalla lo pinta junto con su contenido, en el
// mismo momento, para que nada de lo que ya se ve se corra hacia abajo (CLS).
function avisoDemostracion(modo) {
  if (modo === "api") return null;
  return crear(
    "div",
    { clase: "aviso" },
    crear(
      "p",
      {},
      crear("strong", { texto: "Modo demostración. " }),
      "Esta copia no tiene servidor: muestra datos de ejemplo y los cambios no se guardan. El sistema completo se levanta con docker compose up (vea el README)."
    )
  );
}

// Agrega a la barra del panel el nombre de quien ingresó y el botón para salir.
function agregarSalida(usuario) {
  const lista = $(".navegacion ul");
  if (!lista) return;
  const salir = crear("button", { type: "button", clase: "navegacion__salir", texto: "Cerrar sesión" });
  salir.addEventListener("click", () => {
    Api.sesion.cerrar();
    window.location.assign("ingresar.html?salida=1");
  });
  lista.append(
    crear("li", {}, crear("span", { clase: "navegacion__usuario", texto: `${usuario.nombre} (${usuario.rol})` })),
    crear("li", {}, salir)
  );
}

/* ---------- Errores de formulario (los del navegador y los de la API) ---------- */

// errores: [{ campo, mensaje }]. "campo" es el id del control en la página.
function mostrarErrores(resumen, errores, titulo) {
  resumen.querySelector("ul").replaceChildren(
    ...errores.map((error) =>
      crear("li", {}, document.getElementById(error.campo) ? crear("a", { href: `#${error.campo}`, texto: error.mensaje }) : error.mensaje)
    )
  );
  for (const error of errores) {
    const control = document.getElementById(error.campo);
    if (control) control.setAttribute("aria-invalid", "true");
    const mensaje = document.getElementById(`${error.campo}-error`);
    if (mensaje) mensaje.textContent = error.mensaje;
  }
  resumen.querySelector("h2").textContent =
    titulo || (errores.length === 1 ? "Revise 1 campo antes de guardar" : `Revise ${errores.length} campos antes de guardar`);
  resumen.hidden = false;
  resumen.focus();
}

function limpiarErrores(formulario, resumen) {
  for (const control of formulario.querySelectorAll("[aria-invalid]")) control.removeAttribute("aria-invalid");
  for (const mensaje of formulario.querySelectorAll(".campo__error")) mensaje.textContent = "";
  resumen.hidden = true;
}

// Convierte los "detalles" de un error 422 o 409 de la API en errores de formulario.
// nombres: { campo_de_la_api: "Nombre que ve la persona" }. idDe traduce el campo a un id.
function erroresDeLaApi(error, nombres, idDe = (campo) => campo) {
  if (!error.detalles.length) return [{ campo: "", mensaje: error.message }];
  return error.detalles.map((detalle) => ({
    campo: idDe(detalle.campo),
    mensaje:
      error.estado === 409
        ? error.message
        : `${(typeof nombres === "function" ? nombres(detalle.campo) : nombres[detalle.campo]) || detalle.campo}: ${detalle.problema}.`,
  }));
}

function mostrarEn(zona, ...contenido) {
  zona.replaceChildren(...contenido.filter((parte) => parte !== null && parte !== undefined));
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
    mostrarEn(zona, panelError("h3", error));
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
    mostrarEn(zona, crear("h1", { clase: "visualmente-oculto", texto: "Detalle del producto" }), panelError("h2", error));
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
  const modo = await prepararPanel();
  if (!modo) return;

  let datos;
  try {
    datos = await cargarDatos("panel");
  } catch (error) {
    console.error(error);
    mostrarEn(zona, panelError("h2", error));
    return;
  }

  if (datos.productos.length === 0) {
    mostrarEn(
      zona,
      avisoDemostracion(modo),
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
    const errorAlerta = crear("p", { clase: "campo__error", id: `${idTitulo}-error` });
    const elemento = crear(
      "li",
      { clase: `alerta${alerta.tipo === "temporada" ? " alerta--temporada" : ""}` },
      crear("div", {}, etiquetaTipo, titulo, crear("p", { texto: detalle }), crear("p", { clase: "alerta__meta", texto: meta })),
      crear("div", {}, atender, errorAlerta)
    );

    // Con la API: PATCH /alertas/{id}. En modo demostración el cambio vive solo en memoria.
    atender.addEventListener("click", async () => {
      errorAlerta.textContent = "";
      if (modo === "api") {
        atender.disabled = true;
        try {
          await Api.pedir(`/alertas/${alerta.id}`, { metodo: "PATCH", cuerpo: { estado: "atendida" }, conSesion: true });
        } catch (error) {
          atender.disabled = false;
          errorAlerta.textContent = `No se pudo marcar como atendida. ${error.message}`;
          anuncios.textContent = errorAlerta.textContent;
          atender.focus();
          return;
        }
      }
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
    avisoDemostracion(modo),
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

// Nombres que ve la persona para los campos del producto (mensajes de error de la API).
const CAMPOS_PRODUCTO = {
  nombre: "Nombre",
  nombre_cientifico: "Nombre científico",
  categoria_id: "Categoría",
  proveedor_id: "Proveedor",
  presentacion: "Presentación",
  descripcion: "Descripción",
  precio: "Precio",
  stock: "Unidades en existencia",
  stock_minimo: "Existencia mínima",
  luz: "Luz",
  riego: "Riego",
  cuidado: "Dificultad de cuidado",
  imagen_url: "Dirección de la foto",
  visible_en_catalogo: "Mostrar en el catálogo",
};

async function iniciarFormulario() {
  const zona = $("#zona-formulario");
  const formulario = $("#form-producto");
  const resumen = $("#resumen-errores");
  const zonaResultado = $("#zona-resultado");
  const botonGuardar = $("#boton-guardar");
  const id = parametros.get("id");
  const modo = await prepararPanel();
  if (!modo) return;

  let datos;
  try {
    datos = await cargarDatos("panel");
  } catch (error) {
    console.error(error);
    mostrarEn(zona, panelError("h2", error));
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
    botonGuardar.textContent = "Guardar cambios";
    for (const campo of ["nombre", "nombre_cientifico", "categoria_id", "proveedor_id", "presentacion", "descripcion", "precio", "stock", "stock_minimo", "luz", "riego", "imagen_url"]) {
      formulario.elements[campo].value = existente[campo] ?? "";
    }
    formulario.elements.cuidado.value = existente.cuidado ?? "";
    formulario.elements.visible_en_catalogo.checked = existente.visible_en_catalogo;
  } else {
    $("#nav-nuevo").setAttribute("aria-current", "page");
  }
  const textoBoton = botonGuardar.textContent;

  // Contador de caracteres de la descripción
  const descripcion = formulario.elements.descripcion;
  const contador = $("#descripcion-contador");
  const actualizarContador = () => {
    contador.textContent = `${descripcion.value.length} de 600 caracteres`;
  };
  descripcion.addEventListener("input", actualizarContador);
  actualizarContador();

  mostrarEn(zona, avisoDemostracion(modo));
  formulario.hidden = false;

  // Al corregir un campo, su error desaparece.
  formulario.addEventListener("input", (evento) => {
    const campo = evento.target.name;
    if (!campo) return;
    evento.target.removeAttribute("aria-invalid");
    const mensaje = document.getElementById(`${campo}-error`);
    if (mensaje) mensaje.textContent = "";
  });

  function mostrarExito(titulo, texto, ...extra) {
    formulario.hidden = true;
    zonaResultado.replaceChildren(
      panelEstado("exito", {
        titulo,
        texto,
        acciones: [
          crear("a", { clase: "boton", href: "inventario.html", texto: "Volver al inventario" }),
          crear("a", { clase: "boton boton--secundario", href: "producto-form.html", texto: "Registrar otro producto" }),
        ],
      }),
      ...extra
    );
    zonaResultado.querySelector("h2").focus();
  }

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErrores(formulario, resumen);
    zonaResultado.replaceChildren();

    // 1. Las reglas del contrato, revisadas en el navegador para avisar de inmediato.
    const errores = validarProducto(formulario, datos.productos, existente ? existente.id : null);
    if (errores.length > 0) {
      mostrarErrores(resumen, errores);
      return;
    }

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

    // 2a. Modo demostración: no hay servidor; se muestra lo que se enviaría.
    if (modo !== "api") {
      mostrarExito(
        existente ? "Cambios revisados" : "Producto revisado",
        `Modo demostración: no se guardó en ningún servidor. Con el sistema completo, este formulario hace ${operacion} con estos datos.`,
        crear(
          "details",
          {},
          crear("summary", { texto: "Ver lo que se enviaría a la API" }),
          crear("pre", { clase: "codigo" }, crear("code", { texto: `${operacion}\n\n${JSON.stringify(cuerpo, null, 2)}` }))
        )
      );
      return;
    }

    // 2b. Con la API: el servidor vuelve a validar todo y responde 201, 200, 409 o 422.
    botonGuardar.disabled = true;
    botonGuardar.textContent = "Guardando…";
    try {
      const guardado = existente
        ? await Api.pedir(`/productos/${existente.id}`, { metodo: "PATCH", cuerpo, conSesion: true })
        : await Api.pedir("/productos", { metodo: "POST", cuerpo, conSesion: true });
      mostrarExito(
        existente ? "Cambios guardados" : "Producto guardado",
        `${guardado.nombre} quedó en el inventario con ${plural(guardado.stock, "unidad", "unidades")}${guardado.visible_en_catalogo ? " y ya aparece en el catálogo público" : ""}.`
      );
    } catch (error) {
      if (!(error instanceof Api.ErrorApi)) console.error(error);
      if (error instanceof Api.ErrorApi && (error.estado === 409 || error.estado === 422)) {
        mostrarErrores(resumen, erroresDeLaApi(error, CAMPOS_PRODUCTO), "El servidor no aceptó el producto");
      } else if (!(error instanceof Api.ErrorApi && error.estado === 401)) {
        zonaResultado.replaceChildren(panelEstado("error", { titulo: "No se pudo guardar", texto: error.message }));
        zonaResultado.querySelector("h2").focus();
      }
    } finally {
      botonGuardar.disabled = false;
      botonGuardar.textContent = textoBoton;
    }
  });
}

/* ---------- Pantalla 5: ingreso al panel (ingresar.html) ---------- */

async function iniciarIngresar() {
  const formulario = $("#form-ingresar");
  const resumen = $("#resumen-errores");
  const zona = $("#zona-ingresar");
  const boton = $("#boton-ingresar");
  const volver = Api.destinoSeguro(parametros.get("volver"));
  // El envío se intercepta antes de cualquier espera: el formulario nunca se envía
  // por su cuenta (la contraseña no puede terminar en la dirección de la página).
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErrores(formulario, resumen);
    const correo = formulario.elements.correo.value.trim();
    const contrasena = formulario.elements.contrasena.value;

    const errores = [];
    if (!correo) errores.push({ campo: "correo", mensaje: "Escriba su correo." });
    else if (!formulario.elements.correo.validity.valid) errores.push({ campo: "correo", mensaje: "Escriba un correo válido, por ejemplo: nombre@vivero.co." });
    if (!contrasena) errores.push({ campo: "contrasena", mensaje: "Escriba su contraseña." });
    if (errores.length) {
      mostrarErrores(resumen, errores, "Revise los datos para ingresar");
      return;
    }

    boton.disabled = true;
    boton.textContent = "Ingresando…";
    try {
      // POST /sesiones: si el correo y la contraseña coinciden, la API entrega un token JWT.
      const nuevaSesion = await Api.pedir("/sesiones", { metodo: "POST", cuerpo: { correo, contrasena } });
      Api.sesion.guardar(nuevaSesion);
      window.location.replace(volver);
    } catch (error) {
      formulario.elements.contrasena.value = "";
      const mensaje =
        error instanceof Api.ErrorApi && error.estado === 422
          ? erroresDeLaApi(error, { correo: "Correo", contrasena: "Contraseña" })
          : [{ campo: error.estado === 401 ? "contrasena" : "", mensaje: error.message }];
      mostrarErrores(resumen, mensaje, "No pudimos iniciar la sesión");
      boton.disabled = false;
      boton.textContent = "Ingresar";
    }
  });

  const modo = await Api.detectarModo();

  if (modo !== "api") {
    formulario.hidden = true;
    mostrarEn(
      zona,
      panelEstado("vacio", {
        titulo: "Esta copia no tiene servidor",
        texto: "El ingreso funciona cuando el sistema corre con docker compose up (vea el README). Aquí puede recorrer el panel con datos de ejemplo.",
        acciones: [crear("a", { clase: "boton", href: "inventario.html", texto: "Ver el panel en modo demostración" })],
      })
    );
    return;
  }
  if (Api.sesion.leer()) {
    window.location.replace(volver);
    return;
  }

  if (parametros.get("salida")) $("#anuncios").textContent = "Cerró la sesión.";
  formulario.elements.correo.focus();
}

/* ---------- Pantalla 6: pedidos (pedidos.html) ---------- */

const NOMBRES_ESTADO = { pendiente: "Pendiente", confirmado: "Confirmado", entregado: "Entregado", cancelado: "Cancelado" };
const CLASE_ESTADO = { pendiente: "disponibilidad--pocas", cancelado: "disponibilidad--agotado" };
// Las mismas transiciones que valida el servidor: [estado nuevo, texto del botón].
const TRANSICIONES = {
  pendiente: [["confirmado", "Confirmar"], ["cancelado", "Cancelar"]],
  confirmado: [["entregado", "Marcar entregado"], ["cancelado", "Cancelar"]],
};
const CAMPOS_PEDIDO = {
  cliente_nombre: "Nombre del cliente",
  cliente_telefono: "Teléfono",
  canal: "Canal",
  fecha_entrega: "Fecha de entrega",
  nota: "Nota",
  detalles: "Productos",
};

// "3001234567" o "300 123 4567" → "+57 300 123 4567". Si no son 10 dígitos, lo deja igual.
function formatoTelefono(texto) {
  const digitos = texto.replace(/\D/g, "").replace(/^57(?=\d{10}$)/, "");
  return digitos.length === 10 ? `+57 ${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}` : texto.trim();
}

const formatoFechaHora = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

async function iniciarPedidos() {
  const zona = $("#zona-pedidos");
  const anuncios = $("#anuncios");
  const formulario = $("#form-pedido");
  const resumen = $("#resumen-errores");
  const lineas = $("#lineas");
  const totalPedido = $("#total-pedido");
  const filtroEstado = $("#filtro-estado");
  const modo = await prepararPanel();
  if (!modo) return;

  if (modo !== "api") {
    $("#seccion-lista").hidden = true;
    mostrarEn(
      $("#zona-formulario-pedido"),
      avisoDemostracion(modo),
      panelEstado("vacio", {
        nivel: "h3",
        titulo: "Los pedidos se guardan en el servidor",
        texto: "En modo demostración no hay pedidos. Levante el sistema con docker compose up (vea el README) para registrarlos y cambiar su estado.",
        acciones: [crear("a", { clase: "boton", href: "inventario.html", texto: "Volver al inventario" })],
      })
    );
    return;
  }

  let productos = [];
  const porId = new Map();
  async function cargarProductos() {
    productos = (await Api.todasLasPaginas("/productos", { conSesion: true })).sort(porNombre);
    porId.clear();
    for (const producto of productos) porId.set(producto.id, producto);
  }

  /* --- Lista de pedidos, con filtro por estado y paginación --- */

  let pagina = 1;
  async function pintarLista() {
    zona.setAttribute("aria-busy", "true");
    $("#error-lista").textContent = "";
    const estado = filtroEstado.value;
    let respuesta;
    try {
      respuesta = await Api.pedir(`/pedidos?pagina=${pagina}&por_pagina=10${estado ? `&estado=${estado}` : ""}`, { conSesion: true });
    } catch (error) {
      mostrarEn(zona, panelError("h3", error));
      return;
    }
    const { datos: pedidos, paginacion } = respuesta;
    if (pedidos.length === 0) {
      mostrarEn(
        zona,
        panelEstado("vacio", {
          nivel: "h3",
          titulo: estado ? `No hay pedidos en estado ${NOMBRES_ESTADO[estado].toLowerCase()}` : "Todavía no hay pedidos",
          texto: "Los pedidos que registre aparecerán aquí, del más reciente al más antiguo.",
        })
      );
      return;
    }

    const filas = pedidos.map((pedido) => {
      const lineasTexto = pedido.detalles
        .map((d) => `${d.cantidad} × ${porId.get(d.producto_id)?.nombre || "producto retirado"}`)
        .join(", ");
      const acciones = (TRANSICIONES[pedido.estado] || []).map(([nuevo, texto]) => {
        const boton = crear(
          "button",
          { type: "button", clase: nuevo === "cancelado" ? "boton boton--secundario" : "boton" },
          texto,
          crear("span", { clase: "visualmente-oculto", texto: ` el pedido de ${pedido.cliente_nombre}` })
        );
        boton.addEventListener("click", () => cambiarEstado(pedido, nuevo, boton));
        return boton;
      });
      return crear(
        "tr",
        {},
        crear(
          "th",
          { scope: "row", clase: "tabla__producto" },
          pedido.cliente_nombre,
          crear("span", { clase: "tabla__presentacion", texto: `${pedido.cliente_telefono} · ${pedido.canal === "tienda" ? "En la tienda" : "WhatsApp"}` })
        ),
        crear("td", { "data-etiqueta": "Productos", texto: lineasTexto }),
        crear("td", { clase: "numero", "data-etiqueta": "Total", texto: formatoPrecio.format(pedido.total) }),
        crear("td", { "data-etiqueta": "Registrado", texto: formatoFechaHora.format(new Date(pedido.creado_en)) }),
        crear("td", { "data-etiqueta": "Entrega", texto: pedido.fecha_entrega ? formatoFecha.format(fechaLocal(pedido.fecha_entrega)) : "Sin fecha" }),
        crear("td", { "data-etiqueta": "Estado" }, crear("span", { clase: `disponibilidad ${CLASE_ESTADO[pedido.estado] || ""}`, texto: NOMBRES_ESTADO[pedido.estado] })),
        crear("td", { "data-etiqueta": "Acciones" }, acciones.length ? crear("div", { clase: "acciones-fila" }, ...acciones) : "Cerrado")
      );
    });

    const paginas = Math.max(1, Math.ceil(paginacion.total / paginacion.por_pagina));
    const anterior = crear("button", { type: "button", clase: "boton boton--secundario", texto: "Más recientes", disabled: pagina <= 1 });
    const siguiente = crear("button", { type: "button", clase: "boton boton--secundario", texto: "Más antiguos", disabled: pagina >= paginas });
    anterior.addEventListener("click", () => irAPagina(pagina - 1));
    siguiente.addEventListener("click", () => irAPagina(pagina + 1));

    mostrarEn(
      zona,
      crear(
        "table",
        { clase: "tabla" },
        crear("caption", { texto: `${plural(paginacion.total, "pedido", "pedidos")}, del más reciente al más antiguo. Página ${pagina} de ${paginas}.` }),
        crear(
          "thead",
          {},
          crear(
            "tr",
            {},
            ...["Cliente", "Productos", "Total", "Registrado", "Entrega", "Estado", "Acciones"].map((columna) =>
              crear("th", { scope: "col", clase: columna === "Total" ? "numero" : null, texto: columna })
            )
          )
        ),
        crear("tbody", {}, ...filas)
      ),
      paginas > 1 ? crear("nav", { clase: "paginacion", "aria-label": "Páginas de pedidos" }, anterior, crear("p", { texto: `Página ${pagina} de ${paginas}` }), siguiente) : null
    );
  }

  async function irAPagina(numero) {
    pagina = numero;
    await pintarLista();
    $("#lista-titulo").focus();
  }

  // PATCH /pedidos/{id}: cancelar devuelve el stock; el servidor rechaza los saltos no permitidos.
  async function cambiarEstado(pedido, nuevo, boton) {
    if (nuevo === "cancelado" && !window.confirm(`¿Cancelar el pedido de ${pedido.cliente_nombre}? Las unidades vuelven al inventario.`)) return;
    boton.disabled = true;
    try {
      await Api.pedir(`/pedidos/${pedido.id}`, { metodo: "PATCH", cuerpo: { estado: nuevo }, conSesion: true });
      anuncios.textContent = `Pedido de ${pedido.cliente_nombre}: ${NOMBRES_ESTADO[nuevo].toLowerCase()}.`;
      if (nuevo === "cancelado") {
        await cargarProductos();
        actualizarOpciones();
      }
      await pintarLista();
      $("#lista-titulo").focus();
    } catch (error) {
      boton.disabled = false;
      $("#error-lista").textContent = `No se pudo cambiar el pedido de ${pedido.cliente_nombre}. ${error.message}`;
      boton.focus();
    }
  }

  filtroEstado.addEventListener("change", () => {
    pagina = 1;
    pintarLista();
  });

  /* --- Formulario de pedido nuevo --- */

  let contadorLineas = 0;

  function opcionesProducto(seleccionado) {
    return [
      crear("option", { value: "", texto: "Elija un producto" }),
      ...productos.map((p) =>
        crear("option", {
          value: p.id,
          selected: p.id === seleccionado,
          disabled: p.stock === 0 && p.id !== seleccionado,
          texto: `${p.nombre} · ${formatoPrecio.format(p.precio)} · ${p.stock === 0 ? "agotado" : `hay ${p.stock}`}`,
        })
      ),
    ];
  }

  function actualizarOpciones() {
    for (const selector of lineas.querySelectorAll("select")) selector.replaceChildren(...opcionesProducto(selector.value));
    actualizarTotal();
  }

  function agregarLinea() {
    contadorLineas += 1;
    const n = contadorLineas;
    const idProducto = `linea-${n}-producto`;
    const idCantidad = `linea-${n}-cantidad`;
    const quitar = crear("button", { type: "button", clase: "boton boton--secundario" }, "Quitar", crear("span", { clase: "visualmente-oculto", texto: " este producto del pedido" }));
    const linea = crear(
      "div",
      { clase: "linea-pedido", role: "group", "aria-label": "Producto del pedido" },
      crear(
        "div",
        { clase: "campo" },
        crear("label", { for: idProducto, texto: "Producto" }),
        crear("select", { id: idProducto, "aria-describedby": `${idProducto}-error` }, ...opcionesProducto(""))
      ),
      crear(
        "div",
        { clase: "campo" },
        crear("label", { for: idCantidad, texto: "Cantidad" }),
        crear("input", { type: "number", id: idCantidad, min: 1, max: 1000, step: 1, value: 1, inputmode: "numeric", "aria-describedby": `${idCantidad}-error` })
      ),
      quitar,
      // Los errores van debajo de toda la línea, a lo ancho, para que se lean completos.
      crear("p", { clase: "campo__error", id: `${idProducto}-error` }),
      crear("p", { clase: "campo__error", id: `${idCantidad}-error` })
    );
    quitar.addEventListener("click", () => {
      linea.remove();
      revisarBotonesQuitar();
      actualizarTotal();
      $("#agregar-linea").focus();
    });
    lineas.append(linea);
    revisarBotonesQuitar();
    return linea;
  }

  // Un pedido tiene al menos un producto: con una sola línea no se puede quitar.
  function revisarBotonesQuitar() {
    const botones = lineas.querySelectorAll(".linea-pedido > .boton");
    botones.forEach((boton) => {
      boton.hidden = botones.length === 1;
    });
  }

  function leerLineas() {
    return [...lineas.querySelectorAll(".linea-pedido")].map((linea) => {
      const [selector, cantidad] = linea.querySelectorAll("select, input");
      return { selector, cantidad, producto_id: selector.value, valor: cantidad.value.trim() };
    });
  }

  function actualizarTotal() {
    const total = leerLineas().reduce((suma, l) => suma + (porId.get(l.producto_id)?.precio || 0) * (Number.parseInt(l.valor, 10) || 0), 0);
    totalPedido.textContent = `Total: ${formatoPrecio.format(total)}`;
  }

  formulario.addEventListener("input", (evento) => {
    evento.target.removeAttribute("aria-invalid");
    const mensaje = document.getElementById(`${evento.target.id}-error`);
    if (mensaje) mensaje.textContent = "";
    actualizarTotal();
  });
  formulario.elements.cliente_telefono.addEventListener("blur", (evento) => {
    evento.target.value = formatoTelefono(evento.target.value);
  });
  $("#agregar-linea").addEventListener("click", () => {
    agregarLinea().querySelector("select").focus();
  });

  // Reglas de PedidoEntrada en api/openapi.yaml, revisadas antes de enviar.
  function validarPedido(lista) {
    const errores = [];
    const nombre = formulario.elements.cliente_nombre.value.trim();
    if (nombre.length < 2) errores.push({ campo: "cliente_nombre", mensaje: "Escriba el nombre del cliente (al menos 2 letras)." });
    const telefono = formatoTelefono(formulario.elements.cliente_telefono.value);
    if (!/^\+57 \d{3} \d{3} \d{4}$/.test(telefono)) {
      errores.push({ campo: "cliente_telefono", mensaje: "Escriba un celular de 10 dígitos, por ejemplo: 300 123 4567." });
    }
    const vistos = new Set();
    for (const linea of lista) {
      if (!linea.producto_id) errores.push({ campo: linea.selector.id, mensaje: "Elija el producto." });
      else if (vistos.has(linea.producto_id)) errores.push({ campo: linea.selector.id, mensaje: "Este producto ya está en otra línea: sume las cantidades en una sola." });
      vistos.add(linea.producto_id);
      const cantidad = Number(linea.valor);
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 1000) {
        errores.push({ campo: linea.cantidad.id, mensaje: "La cantidad debe ser un número entero entre 1 y 1000." });
      }
    }
    return errores;
  }

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErrores(formulario, resumen);
    const lista = leerLineas();
    const errores = validarPedido(lista);
    if (errores.length) {
      mostrarErrores(resumen, errores, errores.length === 1 ? "Revise 1 dato del pedido" : `Revise ${errores.length} datos del pedido`);
      return;
    }

    const cuerpo = {
      cliente_nombre: formulario.elements.cliente_nombre.value.trim(),
      cliente_telefono: formatoTelefono(formulario.elements.cliente_telefono.value),
      canal: formulario.elements.canal.value,
      fecha_entrega: formulario.elements.fecha_entrega.value || null,
      nota: formulario.elements.nota.value.trim() || null,
      detalles: lista.map((l) => ({ producto_id: l.producto_id, cantidad: Number(l.valor) })),
    };

    const boton = $("#boton-registrar");
    boton.disabled = true;
    boton.textContent = "Registrando…";
    try {
      // POST /pedidos: el servidor descuenta el stock en una transacción.
      const pedido = await Api.pedir("/pedidos", { metodo: "POST", cuerpo, conSesion: true });
      formulario.reset();
      lineas.replaceChildren();
      await cargarProductos();
      agregarLinea();
      actualizarTotal();
      filtroEstado.value = "";
      pagina = 1;
      await pintarLista();
      $("#resultado-pedido").replaceChildren(
        panelEstado("exito", {
          nivel: "h3",
          titulo: "Pedido registrado",
          texto: `Pedido de ${pedido.cliente_nombre} por ${formatoPrecio.format(pedido.total)}. Las unidades ya se descontaron del inventario.`,
        })
      );
      $("#resultado-pedido h3").focus();
    } catch (error) {
      if (!(error instanceof Api.ErrorApi)) console.error(error);
      if (error instanceof Api.ErrorApi && error.estado === 422) {
        // "detalles[1].cantidad" → el campo de la segunda línea que está en pantalla.
        const idDe = (campo) => {
          const linea = /^detalles\[(\d+)\]\.(producto_id|cantidad)$/.exec(campo);
          if (!linea) return campo;
          const elegida = lista[Number(linea[1])];
          return linea[2] === "cantidad" ? elegida.cantidad.id : elegida.selector.id;
        };
        const nombreDe = (campo) => (campo.startsWith("detalles[") ? `Producto ${Number(/\d+/.exec(campo)[0]) + 1}` : CAMPOS_PEDIDO[campo]);
        mostrarErrores(resumen, erroresDeLaApi(error, nombreDe, idDe), error.message);
      } else if (!(error instanceof Api.ErrorApi && error.estado === 401)) {
        mostrarErrores(resumen, [{ campo: "", mensaje: error.message }], "No se pudo registrar el pedido");
      }
    } finally {
      boton.disabled = false;
      boton.textContent = "Registrar pedido";
    }
  });

  try {
    await cargarProductos();
  } catch (error) {
    $("#seccion-nuevo").hidden = true;
    mostrarEn(zona, panelError("h3", error));
    return;
  }
  formulario.elements.fecha_entrega.min = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  agregarLinea();
  actualizarTotal();
  $("#zona-formulario-pedido").replaceChildren();
  $("#zona-formulario-pedido").setAttribute("aria-busy", "false");
  formulario.hidden = false;
  await pintarLista();
}

/* ---------- Arranque ---------- */

const PANTALLAS = {
  catalogo: iniciarCatalogo,
  detalle: iniciarDetalle,
  inventario: iniciarInventario,
  formulario: iniciarFormulario,
  ingresar: iniciarIngresar,
  pedidos: iniciarPedidos,
};

document.addEventListener("DOMContentLoaded", () => {
  const enlacePie = $("#whatsapp-pie");
  if (enlacePie) enlacePie.href = enlaceWhatsApp(`Hola, ${CONFIG.nombreNegocio}. Quiero hacer una consulta.`);
  const iniciar = PANTALLAS[document.body.dataset.pagina];
  if (iniciar) iniciar();
});
