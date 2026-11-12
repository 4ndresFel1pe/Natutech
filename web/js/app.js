/* =========================================================================
   Natutech · Lógica de las pantallas (Entregas 3 y 4)

   Un solo archivo para las doce pantallas. Cada página dice cuál es en
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
  nombreNegocio: "Vivero",
  // Número de ejemplo. En el servidor se reemplaza por WHATSAPP_NUMERO del .env, que nginx
  // publica en /configuracion.json (decisión D17): el número real no va en el repositorio.
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

// Si la foto de un producto aún no existe, se muestra la ilustración genérica en su lugar.
function conRespaldo(imagen) {
  imagen.addEventListener("error", () => {
    imagen.src = "img/interior.svg";
  }, { once: true });
  return imagen;
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

// "313 293 6198", "+57 313 293 6198" o "573132936198" → "573132936198" (formato de wa.me).
function numeroWhatsApp(texto) {
  const digitos = String(texto || "").replace(/\D/g, "");
  return digitos.length === 10 ? `57${digitos}` : digitos;
}

// Con servidor, el número del vivero sale de /configuracion.json (nginx lo arma con el .env).
// Sin servidor (GitHub Pages) o sin número configurado, queda el número de ejemplo.
async function cargarConfiguracion() {
  if ((await Api.detectarModo()) !== "api") return;
  try {
    const respuesta = await fetch("configuracion.json", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(3000) });
    if (!respuesta.ok) return;
    const numero = numeroWhatsApp((await respuesta.json()).whatsapp);
    if (numero.length < 11) return;
    CONFIG.whatsapp = numero;
    // Enlaces que ya estén en la página (por ejemplo, el del pie) pasan al número real.
    for (const enlace of document.querySelectorAll('a[href*="wa.me/"]')) {
      enlace.href = enlace.href.replace(/wa\.me\/\d+/, `wa.me/${numero}`);
    }
  } catch {
    /* sin configuración: queda el número de ejemplo */
  }
}

function enlaceWhatsApp(mensaje, numero = CONFIG.whatsapp) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
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

/* ---------- Carrito de la tienda en línea (Entrega 4, decisión D18) ---------- */

// El carrito vive en este navegador (localStorage) y solo guarda ids y cantidades. Nombres,
// precios y existencias se leen siempre del catálogo, y el total final lo calcula el servidor.
const CLAVE_CARRITO = "natutech.carrito";
const MAXIMO_POR_PRODUCTO = 50; // el mismo límite del contrato (PedidoTiendaEntrada)

const Carrito = {
  leer() {
    try {
      const lista = JSON.parse(localStorage.getItem(CLAVE_CARRITO));
      return Array.isArray(lista)
        ? lista.filter((linea) => typeof linea?.producto_id === "string" && Number.isInteger(linea.cantidad) && linea.cantidad > 0)
        : [];
    } catch {
      return []; // navegador sin localStorage o dato dañado
    }
  },
  guardar(lista) {
    try {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify(lista));
    } catch {
      /* sin almacenamiento: el carrito dura lo que dure la página */
    }
    actualizarIndicadoresCarrito();
  },
  cantidadDe(id) {
    return this.leer().find((linea) => linea.producto_id === id)?.cantidad || 0;
  },
  // Devuelve la cantidad que quedó; nunca pasa de lo que hay en stock ni del máximo.
  poner(id, cantidad, stock) {
    const tope = Math.min(stock, MAXIMO_POR_PRODUCTO);
    const nueva = Math.max(0, Math.min(cantidad, tope));
    const lista = this.leer();
    const posicion = lista.findIndex((linea) => linea.producto_id === id);
    // Cada producto conserva su lugar en el carrito: cambiar la cantidad no lo mueve.
    if (posicion === -1 && nueva > 0) lista.push({ producto_id: id, cantidad: nueva });
    else if (posicion !== -1 && nueva > 0) lista[posicion] = { producto_id: id, cantidad: nueva };
    else if (posicion !== -1) lista.splice(posicion, 1);
    this.guardar(lista);
    return nueva;
  },
  vaciar() {
    this.guardar([]);
  },
  unidades() {
    return this.leer().reduce((suma, linea) => suma + linea.cantidad, 0);
  },
};

// Número de unidades en el enlace del encabezado y en la pestaña «Carrito» del celular.
function actualizarIndicadoresCarrito() {
  const unidades = Carrito.unidades();
  for (const cuenta of document.querySelectorAll("[data-carrito-cuenta]")) cuenta.textContent = String(unidades);
  const pestana = document.querySelector('.tabbar .tab[data-s="carrito"]');
  if (pestana) {
    let globo = pestana.querySelector(".tab__cuenta");
    if (!globo) {
      globo = crear("b", { clase: "tab__cuenta", "aria-hidden": "true" });
      pestana.append(globo);
    }
    globo.textContent = String(unidades);
    globo.hidden = unidades === 0;
    pestana.setAttribute("aria-label", `Carrito, ${plural(unidades, "producto", "productos")}`);
  }
}

// Región para que el lector de pantalla anuncie lo que se agrega al carrito.
function anunciar(texto) {
  let region = $("#anuncios");
  if (!region) {
    region = crear("p", { id: "anuncios", clase: "visualmente-oculto", "aria-live": "polite" });
    document.body.append(region);
  }
  region.textContent = texto;
}

function botonCarrito(producto, { ancho = false } = {}) {
  const boton = crear("button", { type: "button", clase: `boton boton--secundario${ancho ? " boton--ancho" : ""}` });
  const pintar = () => {
    const enCarrito = Carrito.cantidadDe(producto.id);
    boton.replaceChildren(
      enCarrito ? `En el carrito (${enCarrito})` : "Agregar al carrito",
      crear("span", { clase: "visualmente-oculto", texto: enCarrito ? `: ${producto.nombre}. Agregar otra unidad` : `: ${producto.nombre}` })
    );
  };
  boton.disabled = producto.stock === 0;
  boton.addEventListener("click", () => {
    const antes = Carrito.cantidadDe(producto.id);
    const ahora = Carrito.poner(producto.id, antes + 1, producto.stock);
    pintar();
    anunciar(
      ahora === antes
        ? `No hay más unidades de ${producto.nombre}: ya tiene ${ahora} en el carrito.`
        : `${producto.nombre} agregado al carrito. Lleva ${plural(Carrito.unidades(), "producto", "productos")}.`
    );
  });
  pintar();
  return boton;
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
      conRespaldo(crear("img", {
        clase: "tarjeta__imagen",
        src: producto.imagen_url || "img/interior.svg",
        alt: "",
        width: 320,
        height: 240,
        loading: "lazy",
      })),
      crear(
        "div",
        { clase: "tarjeta__cuerpo" },
        crear("h3", { id: idTitulo }, crear("a", { href: `detalle.html?id=${producto.id}`, texto: producto.nombre })),
        crear("p", { clase: "tarjeta__presentacion", texto: producto.presentacion }),
        crear("p", { clase: "tarjeta__precio", texto: formatoPrecio.format(producto.precio) }),
        crear("p", { clase: `disponibilidad ${disponibilidad.clase}`, texto: disponibilidad.texto }),
        crear(
          "div",
          { clase: "tarjeta__acciones" },
          producto.stock > 0 ? botonCarrito(producto, { ancho: true }) : null,
          botonWhatsApp(producto, { ancho: true })
        )
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
    document.title = "Producto no encontrado | Vivero";
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

  document.title = `${producto.nombre} | Vivero`;
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
          : "Agréguelo al carrito y pague en línea, o escríbanos por WhatsApp y se lo separamos.",
      }),
      crear(
        "div",
        { clase: "consulta__acciones" },
        agotado ? null : botonCarrito(producto),
        agotado ? null : crear("a", { clase: "boton boton--secundario", href: "carrito.html", texto: "Ver el carrito" }),
        botonWhatsApp(producto)
      )
    )
  );

  const contenido = [
    crear(
      "div",
      { clase: "detalle" },
      conRespaldo(crear("img", {
        clase: "detalle__imagen",
        src: producto.imagen_url || "img/interior.svg",
        alt: "",
        width: 640,
        height: 480,
      })),
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
      document.title = "Producto no encontrado | Panel del vivero";
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
    document.title = `Editar ${existente.nombre} | Panel del vivero`;
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
// Estado del último pago en línea con Wompi (Entrega 4): [texto, clase de la etiqueta].
const ESTADOS_PAGO = {
  pendiente: ["Enlace enviado", "disponibilidad--pocas"],
  aprobado: ["Pagado", ""],
  rechazado: ["Pago rechazado", "disponibilidad--agotado"],
  anulado: ["Pago anulado", "disponibilidad--agotado"],
  error: ["Error en el pago", "disponibilidad--agotado"],
  vencido: ["Enlace vencido", "disponibilidad--agotado"],
};
const NOMBRES_CANAL = { whatsapp: "WhatsApp", tienda: "En la tienda", web: "Tienda en línea" };
const formatoHora = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
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
      // Cobro en línea con Wompi: para cualquier pedido no cancelado que todavía no esté pagado.
      if (pedido.estado !== "cancelado" && pedido.estado_pago !== "aprobado") {
        const cobrar = crear(
          "button",
          { type: "button", clase: "boton boton--secundario" },
          pedido.estado_pago ? "Nuevo enlace de pago" : "Enlace de pago",
          crear("span", { clase: "visualmente-oculto", texto: ` para el pedido de ${pedido.cliente_nombre}` })
        );
        cobrar.addEventListener("click", () => generarEnlacePago(pedido, cobrar));
        acciones.push(cobrar);
      }
      const [textoPago, clasePago] = ESTADOS_PAGO[pedido.estado_pago] || [];
      return crear(
        "tr",
        {},
        crear(
          "th",
          { scope: "row", clase: "tabla__producto" },
          pedido.cliente_nombre,
          crear("span", {
            clase: "tabla__presentacion",
            texto: `${pedido.cliente_telefono} · ${NOMBRES_CANAL[pedido.canal] || pedido.canal}${
              pedido.reservado_hasta && pedido.estado === "pendiente" ? ` · apartado hasta las ${formatoHora.format(new Date(pedido.reservado_hasta))}` : ""
            }`,
          })
        ),
        crear("td", { "data-etiqueta": "Productos", texto: lineasTexto }),
        crear("td", { clase: "numero", "data-etiqueta": "Total", texto: formatoPrecio.format(pedido.total) }),
        crear("td", { "data-etiqueta": "Registrado", texto: formatoFechaHora.format(new Date(pedido.creado_en)) }),
        crear("td", { "data-etiqueta": "Entrega", texto: pedido.fecha_entrega ? formatoFecha.format(fechaLocal(pedido.fecha_entrega)) : "Sin fecha" }),
        crear("td", { "data-etiqueta": "Estado" }, crear("span", { clase: `disponibilidad ${CLASE_ESTADO[pedido.estado] || ""}`, texto: NOMBRES_ESTADO[pedido.estado] })),
        crear("td", { "data-etiqueta": "Pago en línea" }, textoPago ? crear("span", { clase: `disponibilidad ${clasePago}`, texto: textoPago }) : "Sin cobro en línea"),
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
            ...["Cliente", "Productos", "Total", "Registrado", "Entrega", "Estado", "Pago en línea", "Acciones"].map((columna) =>
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

  // POST /pedidos/{id}/pagos: la API crea el intento de pago y firma el enlace de Wompi con
  // el secreto de integridad (el secreto nunca llega al navegador). El vivero le manda el
  // enlace al cliente por WhatsApp, como ya cierra sus ventas (decisión D2).
  async function generarEnlacePago(pedido, boton) {
    boton.disabled = true;
    $("#error-lista").textContent = "";
    let pago;
    try {
      pago = await Api.pedir(`/pedidos/${pedido.id}/pagos`, { metodo: "POST", conSesion: true });
    } catch (error) {
      boton.disabled = false;
      $("#error-lista").textContent = `No se pudo generar el enlace de pago de ${pedido.cliente_nombre}. ${error.message}`;
      boton.focus();
      return;
    }
    const prueba = pago.enlace_pago.includes("pub_test_");
    const mensaje = `Hola, ${pedido.cliente_nombre}. Puede pagar su pedido del vivero por ${formatoPrecio.format(pago.monto)} en este enlace seguro de Wompi: ${pago.enlace_pago}`;
    const enviar = crear(
      "a",
      { clase: "boton", href: enlaceWhatsApp(mensaje, numeroWhatsApp(pedido.cliente_telefono)), target: "_blank", rel: "noopener" },
      "Enviar por WhatsApp",
      crear("span", { clase: "visualmente-oculto", texto: ` a ${pedido.cliente_nombre} (se abre en una pestaña nueva)` })
    );
    const abrir = crear(
      "a",
      { clase: "boton boton--secundario", href: pago.enlace_pago, target: "_blank", rel: "noopener" },
      "Abrir el pago",
      crear("span", { clase: "visualmente-oculto", texto: " (se abre en una pestaña nueva)" })
    );
    const copiar = crear("button", { type: "button", clase: "boton boton--secundario", texto: "Copiar el enlace" });
    const campo = crear("input", { type: "text", id: "enlace-pago", readonly: true, value: pago.enlace_pago });
    copiar.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pago.enlace_pago);
        copiar.textContent = "Enlace copiado";
        anuncios.textContent = "Enlace de pago copiado.";
      } catch {
        campo.select();
        anuncios.textContent = "El enlace quedó seleccionado: cópielo con Ctrl + C.";
      }
    });
    const panel = panelEstado("exito", {
      nivel: "h3",
      titulo: `Enlace de pago para ${pedido.cliente_nombre}`,
      texto: `${formatoPrecio.format(pago.monto)}, referencia ${pago.referencia}. Mándeselo al cliente por WhatsApp: cuando pague, Wompi le avisa al sistema y el pedido queda confirmado.${prueba ? " Es un pago de prueba (sandbox): no se cobra dinero real." : ""}`,
      acciones: [enviar, abrir, copiar],
    });
    panel.append(crear("div", { clase: "campo campo--enlace" }, crear("label", { for: "enlace-pago", texto: "Enlace de pago" }), campo));
    $("#resultado-cobro").replaceChildren(panel);
    await pintarLista();
    $("#resultado-cobro h3").focus();
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

/* ---------- Pantallas 7 a 9: categorías, proveedores y temporadas (Entrega 4) ---------- */

// Las tres pantallas siguen el mismo esquema que la de pedidos: un formulario para
// registrar o editar y una tabla con lo que hay. Cada recurso dice sus campos (con las
// mismas reglas de api/openapi.yaml), sus columnas y qué puede hacer cada rol. El
// servidor vuelve a revisar cada permiso: aquí solo se evita mostrar botones que
// terminarían en 403.

const formatoFechaLarga = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" });

function mayuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function cuandoTemporada(temporada) {
  const dias = diasHasta(temporada.fecha);
  if (dias < 0) return "Ya pasó";
  const texto = dias === 0 ? "Es hoy" : `En ${plural(dias, "día", "días")}`;
  // Dentro de la ventana de anticipación el sistema ya está revisando existencias.
  return dias <= temporada.dias_anticipacion ? crear("span", { clase: "disponibilidad disponibilidad--pocas", texto }) : texto;
}

const RECURSOS = {
  categorias: {
    ruta: "/categorias",
    leerConSesion: false,
    usaProductos: true,
    singular: "categoría",
    plural: "categorías",
    femenino: true,
    soloAdministrador: { crear: true, editar: true, eliminar: true },
    eliminable: true,
    campos: [
      { id: "nombre", etiqueta: "Nombre", tipo: "text", obligatorio: true, minimo: 2, maximo: 40, ayuda: "Así se ve en el catálogo y en los filtros. Por ejemplo: Plantas de interior." },
      { id: "descripcion", etiqueta: "Descripción", tipo: "textarea", maximo: 200, ayuda: "Opcional. Máximo 200 caracteres." },
    ],
    ordenar: porNombre,
    orden: "ordenadas por nombre",
    titulo: (categoria) => categoria.nombre,
    subtitulo: () => null,
    columnas: [
      ["Descripción", (categoria) => categoria.descripcion || "Sin descripción"],
      ["Productos", (categoria, contar) => String(contar("categoria_id", categoria.id)), "numero"],
    ],
    soloConsulta: "Solo la administración puede crear, cambiar o eliminar categorías. Usted puede consultarlas.",
    nota: "Una categoría que todavía tiene productos no se puede eliminar: primero hay que moverlos a otra.",
    vacio: "Cree la primera categoría para poder registrar productos.",
  },
  proveedores: {
    ruta: "/proveedores",
    leerConSesion: true,
    usaProductos: true,
    singular: "proveedor",
    plural: "proveedores",
    femenino: false,
    soloAdministrador: {},
    eliminable: false,
    activable: true,
    campos: [
      { id: "nombre", etiqueta: "Nombre", tipo: "text", obligatorio: true, minimo: 2, maximo: 80, ayuda: "Persona o empresa. Por ejemplo: Orquídeas del Llano." },
      { id: "telefono", etiqueta: "Celular", tipo: "tel", obligatorio: true, ayuda: "10 dígitos. Por ejemplo: 310 555 0101." },
      { id: "municipio", etiqueta: "Municipio", tipo: "text", obligatorio: true, minimo: 3, maximo: 60, ayuda: "Desde dónde despacha. Por ejemplo: Villavicencio." },
      { id: "suministra", etiqueta: "Qué le vende al vivero", tipo: "text", maximo: 120, ayuda: "Opcional. Por ejemplo: orquídeas y anturios." },
      { id: "dias_entrega", etiqueta: "Días de entrega", tipo: "number", obligatorio: true, minimo: 0, maximo: 60, porDefecto: 3, ayuda: "Cuántos días tarda en llegar un pedido a Yopal. Aparece en las alertas de reabastecimiento." },
    ],
    ordenar: (a, b) => Number(b.activo) - Number(a.activo) || porNombre(a, b),
    orden: "primero los activos, por nombre",
    titulo: (proveedor) => proveedor.nombre,
    subtitulo: (proveedor) => proveedor.telefono,
    columnas: [
      ["Municipio", (proveedor) => proveedor.municipio],
      ["Suministra", (proveedor) => proveedor.suministra || "Sin especificar"],
      ["Entrega", (proveedor) => plural(proveedor.dias_entrega, "día", "días")],
      ["Productos", (proveedor, contar) => String(contar("proveedor_id", proveedor.id)), "numero"],
      ["Estado", (proveedor) => crear("span", { clase: `disponibilidad${proveedor.activo ? "" : " disponibilidad--agotado"}`, texto: proveedor.activo ? "Activo" : "Inactivo" })],
    ],
    nota: "Los proveedores no se eliminan, porque cada producto guarda quién lo suministra. Si un proveedor deja de venderle al vivero, desactívelo: ya no aparecerá al registrar productos.",
    vacio: "Registre el primer proveedor para asociarlo a sus productos y verlo en las alertas.",
  },
  temporadas: {
    ruta: "/temporadas",
    leerConSesion: false,
    usaProductos: false,
    singular: "temporada",
    plural: "temporadas",
    femenino: true,
    soloAdministrador: { eliminar: true },
    eliminable: true,
    campos: [
      { id: "nombre", etiqueta: "Nombre", tipo: "text", obligatorio: true, minimo: 3, maximo: 60, ayuda: "Por ejemplo: Día de la Madre." },
      { id: "fecha", etiqueta: "Fecha", tipo: "date", obligatorio: true, ayuda: "Las fechas móviles, como el Día de la Madre, cambian cada año: registre la de cada año." },
      { id: "dias_anticipacion", etiqueta: "Días de anticipación", tipo: "number", obligatorio: true, minimo: 1, maximo: 90, porDefecto: 21, ayuda: "Cuántos días antes de la fecha se empiezan a revisar las existencias y a generar alertas." },
    ],
    ordenar: (a, b) => a.fecha.localeCompare(b.fecha),
    orden: "ordenadas por fecha",
    titulo: (temporada) => temporada.nombre,
    subtitulo: (temporada) => formatoFechaLarga.format(fechaLocal(temporada.fecha)),
    columnas: [
      ["Cuándo", cuandoTemporada],
      ["Alertas desde", (temporada) => `${plural(temporada.dias_anticipacion, "día", "días")} antes`],
    ],
    soloConsulta: null,
    nota: "Con la fecha y los días de anticipación, el sistema compara lo que se vendió en la misma temporada del año anterior con las existencias de hoy y avisa si no alcanzan.",
    vacio: "Registre las fechas especiales del vivero para recibir las alertas de reabastecimiento a tiempo.",
  },
};

async function iniciarGestion() {
  const clave = document.body.dataset.pagina;
  const recurso = RECURSOS[clave];
  const zona = $("#zona-gestion");
  const anuncios = $("#anuncios");
  const modo = await prepararPanel();
  if (!modo) return;

  const esAdministrador = modo === "api" && Api.sesion.leer()?.usuario.rol === "administrador";
  const puede = (accion) => modo === "api" && (!recurso.soloAdministrador[accion] || esAdministrador);
  const articulo = recurso.femenino ? "la" : "el";
  const un = recurso.femenino ? "una" : "un";
  const o = recurso.femenino ? "a" : "o";

  let registros = [];
  let productos = [];
  const contar = (campo, id) => productos.filter((producto) => producto[campo] === id).length;

  async function cargar() {
    if (modo === "demostracion") {
      const datos = await leerArchivoDeEjemplo();
      registros = datos[clave];
      productos = datos.productos;
      return;
    }
    [registros, productos] = await Promise.all([
      Api.pedir(recurso.ruta, { conSesion: recurso.leerConSesion }),
      recurso.usaProductos ? Api.todasLasPaginas("/productos", { conSesion: true }) : [],
    ]);
  }

  try {
    if (estadoForzado === "cargando") await esperar(CONFIG.esperaCargaLenta);
    if (estadoForzado === "error") throw new Error("Error de carga forzado con ?estado=error");
    await cargar();
    if (estadoForzado === "vacio") registros = [];
  } catch (error) {
    console.error(error);
    mostrarEn(zona, panelError("h2", error));
    return;
  }

  /* --- Tabla de lo registrado --- */

  const zonaLista = crear("div", { "aria-live": "polite" });
  const errorLista = crear("p", { clase: "campo__error", id: "error-lista", role: "alert" });
  const conAcciones = puede("editar") || (recurso.eliminable && puede("eliminar"));

  function pintarLista() {
    const lista = [...registros].sort(recurso.ordenar);
    if (lista.length === 0) {
      zonaLista.replaceChildren(panelEstado("vacio", { nivel: "h3", titulo: `Todavía no hay ${recurso.plural}`, texto: recurso.vacio }));
      return;
    }
    const filas = lista.map((registro) => {
      const nombre = recurso.titulo(registro);
      const acciones = [];
      if (puede("editar")) {
        const editar = crear("button", { type: "button", clase: "boton boton--secundario" }, "Editar", crear("span", { clase: "visualmente-oculto", texto: ` ${nombre}` }));
        editar.addEventListener("click", () => modoEditar(registro));
        acciones.push(editar);
      }
      if (recurso.activable && puede("editar")) {
        const cambiar = crear("button", { type: "button", clase: "boton boton--secundario" }, registro.activo ? "Desactivar" : "Activar", crear("span", { clase: "visualmente-oculto", texto: ` ${nombre}` }));
        cambiar.addEventListener("click", () => cambiarActivo(registro, cambiar));
        acciones.push(cambiar);
      }
      if (recurso.eliminable && puede("eliminar")) {
        const eliminar = crear("button", { type: "button", clase: "boton boton--secundario" }, "Eliminar", crear("span", { clase: "visualmente-oculto", texto: ` ${nombre}` }));
        eliminar.addEventListener("click", () => eliminarRegistro(registro, eliminar));
        acciones.push(eliminar);
      }
      const subtitulo = recurso.subtitulo(registro);
      return crear(
        "tr",
        {},
        crear("th", { scope: "row", clase: "tabla__producto" }, nombre, subtitulo ? crear("span", { clase: "tabla__presentacion", texto: subtitulo }) : null),
        ...recurso.columnas.map(([columna, valor, clase]) => crear("td", { clase, "data-etiqueta": columna }, valor(registro, contar))),
        conAcciones ? crear("td", { "data-etiqueta": "Acciones" }, crear("div", { clase: "acciones-fila" }, ...acciones)) : null
      );
    });
    const columnas = [mayuscula(recurso.singular), ...recurso.columnas.map(([columna]) => columna), ...(conAcciones ? ["Acciones"] : [])];
    const clases = [null, ...recurso.columnas.map(([, , clase]) => clase || null), null];
    zonaLista.replaceChildren(
      crear(
        "table",
        { clase: "tabla" },
        crear("caption", { texto: `${plural(lista.length, recurso.singular, recurso.plural)}, ${recurso.orden}` }),
        crear("thead", {}, crear("tr", {}, ...columnas.map((columna, indice) => crear("th", { scope: "col", clase: clases[indice], texto: columna })))),
        crear("tbody", {}, ...filas)
      )
    );
  }

  async function recargar() {
    await cargar();
    pintarLista();
  }

  // DELETE: el servidor responde 409 si la categoría todavía tiene productos.
  async function eliminarRegistro(registro, boton) {
    const nombre = recurso.titulo(registro);
    if (!window.confirm(`¿Eliminar ${articulo} ${recurso.singular} «${nombre}»? Esto no se puede deshacer.`)) return;
    boton.disabled = true;
    errorLista.textContent = "";
    try {
      await Api.pedir(`${recurso.ruta}/${registro.id}`, { metodo: "DELETE", conSesion: true });
      if (editando?.id === registro.id) modoCrear();
      await recargar();
      anuncios.textContent = `${mayuscula(recurso.singular)} «${nombre}» eliminad${o}.`;
      $("#lista-titulo").focus();
    } catch (error) {
      boton.disabled = false;
      errorLista.textContent = `No se pudo eliminar «${nombre}». ${error.message}`;
      boton.focus();
    }
  }

  async function cambiarActivo(registro, boton) {
    boton.disabled = true;
    errorLista.textContent = "";
    try {
      await Api.pedir(`${recurso.ruta}/${registro.id}`, { metodo: "PATCH", cuerpo: { activo: !registro.activo }, conSesion: true });
      await recargar();
      anuncios.textContent = `${mayuscula(recurso.singular)} «${registro.nombre}» ${registro.activo ? "desactivado" : "activado"}.`;
      $("#lista-titulo").focus();
    } catch (error) {
      boton.disabled = false;
      errorLista.textContent = `No se pudo cambiar «${registro.nombre}». ${error.message}`;
      boton.focus();
    }
  }

  const seccionLista = crear(
    "section",
    { "aria-labelledby": "lista-titulo" },
    crear("h2", { id: "lista-titulo", tabindex: "-1", texto: `${mayuscula(recurso.plural)} registrad${o}s` }),
    crear("p", { clase: "campo__ayuda", texto: recurso.nota }),
    errorLista,
    zonaLista
  );

  /* --- Formulario para registrar o editar --- */

  let editando = null;
  const tituloFormulario = crear("h2", { id: "formulario-titulo", tabindex: "-1" });
  const resumen = crear("div", { clase: "resumen-errores", role: "alert", tabindex: "-1", hidden: true }, crear("h2"), crear("ul"));
  const resultado = crear("div", { id: "resultado-gestion" });
  const botonGuardar = crear("button", { type: "submit", clase: "boton" });
  const botonCancelar = crear("button", { type: "button", clase: "boton boton--secundario", texto: "Cancelar la edición", hidden: true });

  function crearCampo(campo) {
    const idAyuda = `${campo.id}-ayuda`;
    const idError = `${campo.id}-error`;
    const atributos = {
      id: campo.id,
      name: campo.id,
      required: campo.obligatorio,
      autocomplete: "off",
      "aria-describedby": campo.ayuda ? `${idAyuda} ${idError}` : idError,
    };
    let control;
    if (campo.tipo === "textarea") control = crear("textarea", { ...atributos, maxlength: campo.maximo });
    else if (campo.tipo === "number") control = crear("input", { ...atributos, type: "number", min: campo.minimo, max: campo.maximo, step: 1, inputmode: "numeric", value: campo.porDefecto });
    else if (campo.tipo === "tel") control = crear("input", { ...atributos, type: "tel", maxlength: 17, inputmode: "tel" });
    else control = crear("input", { ...atributos, type: campo.tipo, maxlength: campo.maximo });
    if (campo.tipo === "tel") control.addEventListener("blur", () => (control.value = formatoTelefono(control.value)));
    return crear(
      "div",
      { clase: "campo" },
      crear("label", { for: campo.id }, campo.etiqueta, campo.obligatorio ? " " : null, campo.obligatorio ? crear("span", { clase: "obligatorio", "aria-hidden": "true", texto: "*" }) : null),
      campo.ayuda ? crear("p", { clase: "campo__ayuda", id: idAyuda, texto: campo.ayuda }) : null,
      control,
      crear("p", { clase: "campo__error", id: idError })
    );
  }

  const cortos = recurso.campos.filter((campo) => campo.tipo !== "textarea");
  const largos = recurso.campos.filter((campo) => campo.tipo === "textarea");
  const formulario = crear(
    "form",
    { clase: "formulario", novalidate: true },
    crear(
      "fieldset",
      {},
      crear("legend", { texto: `Datos de${recurso.femenino ? " la" : "l"} ${recurso.singular}` }),
      crear("div", { clase: "formulario__columnas" }, ...cortos.map(crearCampo)),
      ...largos.map(crearCampo)
    ),
    crear("div", { clase: "formulario__acciones" }, botonGuardar, botonCancelar)
  );

  function modoCrear() {
    editando = null;
    formulario.reset();
    limpiarErrores(formulario, resumen);
    tituloFormulario.textContent = `Registrar ${un} ${recurso.singular}`;
    botonGuardar.textContent = `Guardar ${articulo} ${recurso.singular}`;
    botonCancelar.hidden = true;
  }

  function modoEditar(registro) {
    editando = registro;
    limpiarErrores(formulario, resumen);
    resultado.replaceChildren();
    for (const campo of recurso.campos) {
      const valor = registro[campo.id];
      formulario.elements[campo.id].value = valor === null || valor === undefined ? "" : String(valor);
    }
    tituloFormulario.textContent = `Editar ${articulo} ${recurso.singular} «${recurso.titulo(registro)}»`;
    botonGuardar.textContent = "Guardar los cambios";
    botonCancelar.hidden = false;
    formulario.elements[recurso.campos[0].id].focus();
    anuncios.textContent = tituloFormulario.textContent;
  }

  botonCancelar.addEventListener("click", () => {
    modoCrear();
    tituloFormulario.focus();
  });

  formulario.addEventListener("input", (evento) => {
    evento.target.removeAttribute("aria-invalid");
    const mensaje = document.getElementById(`${evento.target.id}-error`);
    if (mensaje) mensaje.textContent = "";
  });

  // Mismas reglas que el esquema del recurso en api/openapi.yaml, revisadas antes de enviar.
  function validar() {
    const errores = [];
    for (const campo of recurso.campos) {
      const control = formulario.elements[campo.id];
      const valor = control.value.trim();
      const error = (mensaje) => errores.push({ campo: campo.id, mensaje: `${campo.etiqueta}: ${mensaje}` });
      if (campo.tipo === "number" && control.validity.badInput) {
        error(`escriba un número entero entre ${campo.minimo} y ${campo.maximo}.`);
      } else if (!valor) {
        if (campo.obligatorio) error("este dato es obligatorio.");
      } else if (campo.tipo === "number") {
        const numero = Number(valor);
        if (!Number.isInteger(numero) || numero < campo.minimo || numero > campo.maximo) error(`escriba un número entero entre ${campo.minimo} y ${campo.maximo}.`);
      } else if (campo.tipo === "tel") {
        if (!/^\+57 \d{3} \d{3} \d{4}$/.test(formatoTelefono(valor))) error("escriba un celular de 10 dígitos, por ejemplo: 310 555 0101.");
      } else if (campo.tipo === "date") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) error("elija una fecha válida.");
      } else if (campo.minimo && valor.length < campo.minimo) {
        error(`escriba al menos ${campo.minimo} caracteres.`);
      } else if (campo.maximo && valor.length > campo.maximo) {
        error(`escriba máximo ${campo.maximo} caracteres.`);
      }
    }
    return errores;
  }

  function leerValor(campo) {
    const valor = formulario.elements[campo.id].value.trim();
    if (!valor) return null;
    if (campo.tipo === "number") return Number(valor);
    if (campo.tipo === "tel") return formatoTelefono(valor);
    return valor;
  }

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErrores(formulario, resumen);
    resultado.replaceChildren();
    const errores = validar();
    if (errores.length) {
      mostrarErrores(resumen, errores);
      return;
    }

    // Al crear se mandan todos los campos; al editar, solo los que cambiaron (PATCH).
    const cuerpo = {};
    for (const campo of recurso.campos) {
      const valor = leerValor(campo);
      if (!editando || valor !== (editando[campo.id] ?? null)) cuerpo[campo.id] = valor;
    }
    if (editando && Object.keys(cuerpo).length === 0) {
      mostrarErrores(resumen, [{ campo: "", mensaje: "No cambió ningún dato. Modifique algo o cancele la edición." }], "No hay cambios para guardar");
      return;
    }

    const estabaEditando = Boolean(editando);
    botonGuardar.disabled = true;
    botonGuardar.textContent = "Guardando…";
    try {
      const guardado = estabaEditando
        ? await Api.pedir(`${recurso.ruta}/${editando.id}`, { metodo: "PATCH", cuerpo, conSesion: true })
        : await Api.pedir(recurso.ruta, { metodo: "POST", cuerpo, conSesion: true });
      modoCrear();
      await recargar();
      resultado.replaceChildren(
        panelEstado("exito", {
          nivel: "h3",
          titulo: `${mayuscula(recurso.singular)} ${estabaEditando ? "actualizad" : "registrad"}${o}`,
          texto: `«${recurso.titulo(guardado)}» ya quedó guardad${o}${estabaEditando ? " con los cambios" : ""}.`,
        })
      );
      resultado.querySelector("h3").focus();
    } catch (error) {
      if (!(error instanceof Api.ErrorApi)) console.error(error);
      const nombres = Object.fromEntries(recurso.campos.map((campo) => [campo.id, campo.etiqueta]));
      if (error instanceof Api.ErrorApi && (error.estado === 422 || error.estado === 409)) {
        mostrarErrores(resumen, erroresDeLaApi(error, nombres), error.estado === 409 ? "No se pudo guardar" : undefined);
      } else if (!(error instanceof Api.ErrorApi && error.estado === 401)) {
        mostrarErrores(resumen, [{ campo: "", mensaje: error.message }], "No se pudo guardar");
      }
    } finally {
      botonGuardar.disabled = false;
      botonGuardar.textContent = editando ? "Guardar los cambios" : `Guardar ${articulo} ${recurso.singular}`;
    }
  });

  modoCrear();
  pintarLista();

  const avisoRol =
    modo === "api" && !puede("crear") && recurso.soloConsulta
      ? crear("div", { clase: "aviso" }, crear("p", {}, crear("strong", { texto: "Solo consulta. " }), recurso.soloConsulta))
      : null;
  const seccionFormulario = puede("crear")
    ? crear("section", { "aria-labelledby": "formulario-titulo" }, tituloFormulario, resumen, formulario, resultado)
    : null;

  mostrarEn(zona, avisoDemostracion(modo), avisoRol, seccionFormulario, seccionLista);
}

/* ---------- Pantalla 10: ajuste de precios por categoría (precios.html) ---------- */

// El mismo cálculo que hace el servidor (servidor/src/servicios/categorias.js): porcentaje
// entero, redondeo a la centena más cercana y precio entre 0 y 5.000.000.
function precioAjustado(precio, porcentaje) {
  return Math.min(5000000, Math.max(0, Math.round((precio * (100 + porcentaje)) / 10000) * 100));
}

function textoPorcentaje(porcentaje) {
  return `${porcentaje > 0 ? "+" : ""}${porcentaje} %`;
}

async function iniciarPrecios() {
  const zona = $("#zona-gestion");
  const anuncios = $("#anuncios");
  const modo = await prepararPanel();
  if (!modo) return;

  // Solo el rol administrador puede ajustar precios (el servidor responde 403 a los demás).
  if (modo === "api" && Api.sesion.leer()?.usuario.rol !== "administrador") {
    mostrarEn(
      zona,
      panelEstado("vacio", {
        titulo: "Solo la administración ajusta precios",
        texto: "Este cambio afecta los precios de toda una categoría a la vez. Pídale a la administración del vivero que lo haga; usted puede consultar los precios en el inventario.",
        acciones: [crear("a", { clase: "boton", href: "inventario.html", texto: "Ir al inventario" })],
      })
    );
    return;
  }

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
        titulo: "No hay productos para ajustar",
        texto: "Cuando registre productos podrá subir o bajar los precios de una categoría completa desde aquí.",
        acciones: [crear("a", { clase: "boton", href: "producto-form.html", texto: "Registrar un producto" })],
      })
    );
    return;
  }

  const contar = (id) => datos.productos.filter((producto) => producto.categoria_id === id).length;
  const resumen = crear("div", { clase: "resumen-errores", role: "alert", tabindex: "-1", hidden: true }, crear("h2"), crear("ul"));
  const resultado = crear("div", { id: "resultado-gestion" });
  const selector = crear(
    "select",
    { id: "categoria_id", name: "categoria_id", required: true, "aria-describedby": "categoria_id-error" },
    crear("option", { value: "", texto: "Elija una categoría" }),
    ...[...datos.categorias].sort(porNombre).map((categoria) => {
      const cantidad = contar(categoria.id);
      return crear("option", { value: categoria.id, disabled: cantidad === 0, texto: `${categoria.nombre} (${cantidad === 0 ? "sin productos" : plural(cantidad, "producto", "productos")})` });
    })
  );
  const campoPorcentaje = crear("input", {
    type: "number",
    id: "porcentaje",
    name: "porcentaje",
    required: true,
    min: -50,
    max: 100,
    step: 1,
    inputmode: "numeric",
    autocomplete: "off",
    "aria-describedby": "porcentaje-ayuda porcentaje-error",
  });
  const botonAplicar = crear("button", { type: "submit", clase: "boton", texto: "Aplicar el ajuste", disabled: modo !== "api" });
  const formulario = crear(
    "form",
    { clase: "formulario", novalidate: true },
    crear(
      "fieldset",
      {},
      crear("legend", { texto: "Ajuste" }),
      crear(
        "div",
        { clase: "formulario__columnas" },
        crear(
          "div",
          { clase: "campo" },
          crear("label", { for: "categoria_id" }, "Categoría ", crear("span", { clase: "obligatorio", "aria-hidden": "true", texto: "*" })),
          selector,
          crear("p", { clase: "campo__error", id: "categoria_id-error" })
        ),
        crear(
          "div",
          { clase: "campo" },
          crear("label", { for: "porcentaje" }, "Porcentaje ", crear("span", { clase: "obligatorio", "aria-hidden": "true", texto: "*" })),
          crear("p", { clase: "campo__ayuda", id: "porcentaje-ayuda", texto: "Número entero entre -50 y 100, sin el signo %. Por ejemplo: 10 sube los precios un 10 %; -15 los baja un 15 %." }),
          campoPorcentaje,
          crear("p", { clase: "campo__error", id: "porcentaje-error" })
        )
      )
    ),
    crear("div", { clase: "formulario__acciones" }, botonAplicar)
  );

  const zonaPrevia = crear("div", { "aria-live": "polite" });

  function porcentajeValido() {
    const numero = Number(campoPorcentaje.value);
    return campoPorcentaje.value.trim() !== "" && Number.isInteger(numero) && numero >= -50 && numero <= 100 && numero !== 0 ? numero : null;
  }

  function pintarVistaPrevia() {
    const categoria = datos.categorias.find((c) => c.id === selector.value);
    if (!categoria) {
      zonaPrevia.replaceChildren(panelEstado("vacio", { nivel: "h3", titulo: "Elija una categoría", texto: "Aquí verá cada producto con su precio actual y el que quedaría después del ajuste." }));
      return;
    }
    const porcentaje = porcentajeValido();
    const lista = datos.productos.filter((producto) => producto.categoria_id === categoria.id).sort(porNombre);
    const filas = lista.map((producto) => {
      const nuevo = porcentaje === null ? null : precioAjustado(producto.precio, porcentaje);
      const diferencia = nuevo === null ? null : nuevo - producto.precio;
      return crear(
        "tr",
        {},
        crear("th", { scope: "row", clase: "tabla__producto" }, producto.nombre, crear("span", { clase: "tabla__presentacion", texto: producto.presentacion })),
        crear("td", { clase: "numero", "data-etiqueta": "Precio actual", texto: formatoPrecio.format(producto.precio) }),
        crear("td", { clase: "numero", "data-etiqueta": "Precio nuevo", texto: nuevo === null ? "—" : formatoPrecio.format(nuevo) }),
        crear("td", { clase: "numero", "data-etiqueta": "Diferencia", texto: diferencia === null ? "—" : `${diferencia > 0 ? "+" : ""}${formatoPrecio.format(diferencia)}` })
      );
    });
    zonaPrevia.replaceChildren(
      crear(
        "table",
        { clase: "tabla" },
        crear(
          "caption",
          {
            texto:
              porcentaje === null
                ? `${plural(lista.length, "producto", "productos")} de «${categoria.nombre}». Escriba un porcentaje para ver los precios nuevos.`
                : `${plural(lista.length, "producto", "productos")} de «${categoria.nombre}» con un ajuste de ${textoPorcentaje(porcentaje)}. Los precios nuevos se redondean a la centena.`,
          }
        ),
        crear(
          "thead",
          {},
          crear("tr", {}, ...["Producto", "Precio actual", "Precio nuevo", "Diferencia"].map((columna, indice) => crear("th", { scope: "col", clase: indice ? "numero" : null, texto: columna })))
        ),
        crear("tbody", {}, ...filas)
      )
    );
  }

  formulario.addEventListener("input", (evento) => {
    evento.target.removeAttribute("aria-invalid");
    const mensaje = document.getElementById(`${evento.target.id}-error`);
    if (mensaje) mensaje.textContent = "";
    pintarVistaPrevia();
  });
  selector.addEventListener("change", pintarVistaPrevia);

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErrores(formulario, resumen);
    resultado.replaceChildren();
    const errores = [];
    const categoria = datos.categorias.find((c) => c.id === selector.value);
    if (!categoria) errores.push({ campo: "categoria_id", mensaje: "Categoría: elija la categoría que quiere ajustar." });
    const porcentaje = porcentajeValido();
    if (porcentaje === null) {
      errores.push({ campo: "porcentaje", mensaje: "Porcentaje: escriba un número entero entre -50 y 100, distinto de 0." });
    }
    if (errores.length) {
      mostrarErrores(resumen, errores, errores.length === 1 ? "Revise 1 dato del ajuste" : `Revise ${errores.length} datos del ajuste`);
      return;
    }
    const cantidad = contar(categoria.id);
    const confirmacion = `¿Cambiar en ${textoPorcentaje(porcentaje)} los precios de ${plural(cantidad, "producto", "productos")} de «${categoria.nombre}»? Los pedidos ya registrados conservan su precio.`;
    if (!window.confirm(confirmacion)) return;

    botonAplicar.disabled = true;
    botonAplicar.textContent = "Aplicando…";
    try {
      // POST /categorias/{id}/ajuste-precios: el servidor cambia todos los precios en una transacción.
      const respuesta = await Api.pedir(`/categorias/${categoria.id}/ajuste-precios`, { metodo: "POST", cuerpo: { porcentaje }, conSesion: true });
      datos.productos = await Api.todasLasPaginas("/productos", { conSesion: true });
      campoPorcentaje.value = "";
      pintarVistaPrevia();
      resultado.replaceChildren(
        panelEstado("exito", {
          nivel: "h3",
          titulo: "Precios actualizados",
          texto: `Se cambiaron los precios de ${plural(respuesta.productos_actualizados, "producto", "productos")} de «${categoria.nombre}» (${textoPorcentaje(porcentaje)}). Ya se ven en el catálogo y en el inventario.`,
        })
      );
      resultado.querySelector("h3").focus();
      anuncios.textContent = "";
    } catch (error) {
      if (!(error instanceof Api.ErrorApi)) console.error(error);
      if (error instanceof Api.ErrorApi && error.estado === 422) {
        mostrarErrores(resumen, erroresDeLaApi(error, { porcentaje: "Porcentaje" }), error.message);
      } else if (!(error instanceof Api.ErrorApi && error.estado === 401)) {
        mostrarErrores(resumen, [{ campo: "", mensaje: error.message }], "No se pudieron ajustar los precios");
      }
    } finally {
      botonAplicar.disabled = modo !== "api";
      botonAplicar.textContent = "Aplicar el ajuste";
    }
  });

  pintarVistaPrevia();
  mostrarEn(
    zona,
    avisoDemostracion(modo),
    crear(
      "section",
      { "aria-labelledby": "ajuste-titulo" },
      crear("h2", { id: "ajuste-titulo", texto: "Subir o bajar los precios de una categoría" }),
      crear("p", { texto: "Útil antes de una temporada o cuando sube el costo de un proveedor. Cambia todos los productos de la categoría a la vez; los pedidos ya registrados no cambian, porque cada uno guarda su precio." }),
      resumen,
      formulario,
      resultado
    ),
    crear("section", { "aria-labelledby": "previa-titulo" }, crear("h2", { id: "previa-titulo", texto: "Vista previa" }), zonaPrevia)
  );
}

/* ---------- Pantalla 12: carrito de la tienda en línea (carrito.html) ---------- */

async function iniciarCarrito() {
  const zona = $("#zona-carrito");
  let datos;
  try {
    datos = await cargarDatos();
  } catch (error) {
    console.error(error);
    mostrarEn(zona, panelError("h2", error));
    return;
  }
  const modo = await Api.detectarModo();
  let porId = new Map(datos.productos.map((producto) => [producto.id, producto]));

  const resumen = crear("div", { clase: "resumen-errores", role: "alert", tabindex: "-1", hidden: true }, crear("h2"), crear("ul"));
  const zonaLista = crear("div");
  const totalTexto = crear("p", { clase: "total-pedido", "aria-live": "polite" });
  const botonPagar = crear("button", { type: "submit", clase: "boton", texto: "Pagar en línea", disabled: modo !== "api" });
  const enlaceWhatsAppPedido = crear(
    "a",
    { clase: "boton boton--secundario", href: "#", target: "_blank", rel: "noopener" },
    "Enviar el pedido por WhatsApp",
    crear("span", { clase: "visualmente-oculto", texto: " (se abre en una pestaña nueva)" })
  );

  const campo = (id, etiqueta, control, ayuda, obligatorio = true) =>
    crear(
      "div",
      { clase: "campo" },
      crear("label", { for: id }, etiqueta, obligatorio ? " " : null, obligatorio ? crear("span", { clase: "obligatorio", "aria-hidden": "true", texto: "*" }) : null),
      ayuda ? crear("p", { clase: "campo__ayuda", id: `${id}-ayuda`, texto: ayuda }) : null,
      control,
      crear("p", { clase: "campo__error", id: `${id}-error` })
    );
  const campoNombre = crear("input", { type: "text", id: "cliente_nombre", name: "cliente_nombre", required: true, maxlength: 80, autocomplete: "name", "aria-describedby": "cliente_nombre-error" });
  const campoTelefono = crear("input", { type: "tel", id: "cliente_telefono", name: "cliente_telefono", required: true, maxlength: 17, autocomplete: "tel-national", inputmode: "tel", "aria-describedby": "cliente_telefono-ayuda cliente_telefono-error" });
  const campoNota = crear("textarea", { id: "nota", name: "nota", maxlength: 300, "aria-describedby": "nota-ayuda nota-error" });
  campoTelefono.addEventListener("blur", () => (campoTelefono.value = formatoTelefono(campoTelefono.value)));

  const formulario = crear(
    "form",
    { clase: "formulario", novalidate: true },
    crear(
      "fieldset",
      {},
      crear("legend", { texto: "Sus datos" }),
      crear(
        "div",
        { clase: "formulario__columnas" },
        campo("cliente_nombre", "Nombre", campoNombre),
        campo("cliente_telefono", "Celular", campoTelefono, "10 dígitos. Por aquí le escribimos para coordinar la entrega.")
      ),
      campo("nota", "Nota", campoNota, "Opcional. Por ejemplo: es para regalo, o entregar en la tarde.", false)
    ),
    crear(
      "p",
      { clase: "campo__ayuda" },
      modo === "api"
        ? "Al pagar, apartamos estas unidades por 30 minutos. Si no completa el pago en ese tiempo, el pedido se cancela solo y no se cobra nada."
        : "En esta copia de demostración no se puede pagar en línea: envíe su pedido por WhatsApp."
    ),
    crear("div", { clase: "formulario__acciones" }, botonPagar, enlaceWhatsAppPedido)
  );

  // Líneas del carrito con su producto del catálogo (null si ya no está publicado).
  const lineas = () => Carrito.leer().map((linea) => ({ ...linea, producto: porId.get(linea.producto_id) || null }));
  const leyenda = crear("caption");
  const comprables = () => lineas().filter((linea) => linea.producto && linea.producto.stock > 0);

  function actualizarTotales() {
    const lista = comprables();
    const total = lista.reduce((suma, linea) => suma + linea.producto.precio * linea.cantidad, 0);
    totalTexto.textContent = `Total: ${formatoPrecio.format(total)}`;
    leyenda.textContent = `${plural(Carrito.unidades(), "unidad", "unidades")} en el carrito. Los precios son los de hoy en el catálogo.`;
    const nombre = campoNombre.value.trim();
    const mensaje = [
      `Hola, ${CONFIG.nombreNegocio}. Quiero hacer este pedido:`,
      ...lista.map((linea) => `- ${linea.cantidad} × ${linea.producto.nombre} (${linea.producto.presentacion}), ${formatoPrecio.format(linea.producto.precio)} c/u`),
      `Total: ${formatoPrecio.format(total)}`,
      nombre ? `A nombre de: ${nombre}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    enlaceWhatsAppPedido.href = enlaceWhatsApp(mensaje);
    botonPagar.disabled = modo !== "api" || lista.length === 0;
  }

  function pintar() {
    const lista = lineas();
    if (lista.length === 0) {
      mostrarEn(
        zona,
        panelEstado("vacio", {
          titulo: "Su carrito está vacío",
          texto: "Agregue plantas e insumos desde el catálogo y aquí podrá pagarlos en línea o enviarnos el pedido por WhatsApp.",
          acciones: [crear("a", { clase: "boton", href: "index.html#catalogo", texto: "Ver el catálogo" })],
        })
      );
      return false;
    }

    const filas = lista.map((linea, indice) => {
      const quitar = crear("button", { type: "button", clase: "boton boton--secundario" }, "Quitar", crear("span", { clase: "visualmente-oculto", texto: ` ${linea.producto?.nombre || "este producto"} del carrito` }));
      quitar.addEventListener("click", () => {
        Carrito.poner(linea.producto_id, 0, 0);
        anunciar(`${linea.producto?.nombre || "Producto"} quitado del carrito.`);
        if (pintar()) $("#carrito-titulo").focus();
      });
      if (!linea.producto || linea.producto.stock === 0) {
        return crear(
          "tr",
          {},
          crear("th", { scope: "row", clase: "tabla__producto" }, linea.producto?.nombre || "Producto retirado"),
          crear("td", { colspan: 3, "data-etiqueta": "Estado" }, crear("span", { clase: "disponibilidad disponibilidad--agotado", texto: linea.producto ? "Se agotó" : "Ya no está en el catálogo" })),
          crear("td", { "data-etiqueta": "Acciones" }, quitar)
        );
      }
      const producto = linea.producto;
      // Si el stock bajó desde que lo agregó, se ajusta la cantidad a lo que hay.
      const cantidad = Carrito.poner(producto.id, linea.cantidad, producto.stock);
      const tope = Math.min(producto.stock, MAXIMO_POR_PRODUCTO);
      const id = `cantidad-${indice}`;
      const control = crear("input", { type: "number", id, min: 1, max: tope, step: 1, value: cantidad, inputmode: "numeric", clase: "carrito__cantidad" });
      const subtotal = crear("td", { clase: "numero", "data-etiqueta": "Subtotal", texto: formatoPrecio.format(producto.precio * cantidad) });
      control.addEventListener("input", () => {
        const pedida = Number.parseInt(control.value, 10);
        if (!Number.isInteger(pedida) || pedida < 1) return; // se corrige al salir del campo
        const quedo = Carrito.poner(producto.id, pedida, producto.stock);
        subtotal.textContent = formatoPrecio.format(producto.precio * quedo);
        actualizarTotales();
      });
      control.addEventListener("change", () => {
        const quedo = Carrito.poner(producto.id, Math.max(1, Number.parseInt(control.value, 10) || 1), producto.stock);
        control.value = String(quedo);
        subtotal.textContent = formatoPrecio.format(producto.precio * quedo);
        actualizarTotales();
      });
      return crear(
        "tr",
        {},
        crear("th", { scope: "row", clase: "tabla__producto" }, crear("a", { href: `detalle.html?id=${producto.id}`, texto: producto.nombre }), crear("span", { clase: "tabla__presentacion", texto: producto.presentacion })),
        crear("td", { clase: "numero", "data-etiqueta": "Precio", texto: formatoPrecio.format(producto.precio) }),
        crear(
          "td",
          { "data-etiqueta": "Cantidad" },
          crear("label", { for: id, clase: "visualmente-oculto", texto: `Cantidad de ${producto.nombre}` }),
          control,
          crear("span", { clase: "tabla__presentacion", texto: producto.stock <= CONFIG.pocasUnidades ? `Quedan ${producto.stock}` : `Hasta ${tope}` })
        ),
        subtotal,
        crear("td", { "data-etiqueta": "Acciones" }, quitar)
      );
    });

    zonaLista.replaceChildren(
      crear(
        "table",
        { clase: "tabla" },
        leyenda,
        crear("thead", {}, crear("tr", {}, ...["Producto", "Precio", "Cantidad", "Subtotal", "Acciones"].map((columna) => crear("th", { scope: "col", clase: ["Precio", "Subtotal"].includes(columna) ? "numero" : null, texto: columna })))),
        crear("tbody", {}, ...filas)
      )
    );
    actualizarTotales();
    if (zona.getAttribute("aria-busy") !== "false" || !zona.contains(formulario)) {
      mostrarEn(
        zona,
        crear("section", { "aria-labelledby": "carrito-titulo" }, crear("h2", { id: "carrito-titulo", tabindex: "-1", texto: "Productos" }), zonaLista, totalTexto),
        crear("section", { "aria-labelledby": "pago-titulo" }, crear("h2", { id: "pago-titulo", texto: "Finalizar el pedido" }), resumen, formulario)
      );
    }
    return true;
  }

  campoNombre.addEventListener("input", actualizarTotales);
  formulario.addEventListener("input", (evento) => {
    evento.target.removeAttribute("aria-invalid");
    const mensaje = document.getElementById(`${evento.target.id}-error`);
    if (mensaje) mensaje.textContent = "";
  });

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErrores(formulario, resumen);
    const lista = comprables();
    const errores = [];
    if (campoNombre.value.trim().length < 2) errores.push({ campo: "cliente_nombre", mensaje: "Nombre: escríbalo (al menos 2 letras)." });
    const telefono = formatoTelefono(campoTelefono.value);
    if (!/^\+57 \d{3} \d{3} \d{4}$/.test(telefono)) errores.push({ campo: "cliente_telefono", mensaje: "Celular: escriba 10 dígitos, por ejemplo: 300 123 4567." });
    if (lista.length === 0) errores.push({ campo: "", mensaje: "El carrito no tiene productos disponibles." });
    if (errores.length) {
      mostrarErrores(resumen, errores, errores.length === 1 ? "Revise 1 dato" : `Revise ${errores.length} datos`);
      return;
    }

    botonPagar.disabled = true;
    botonPagar.textContent = "Preparando el pago…";
    try {
      // POST /catalogo/pedidos: solo ids y cantidades; el servidor pone los precios.
      const respuesta = await Api.pedir("/catalogo/pedidos", {
        metodo: "POST",
        cuerpo: {
          cliente_nombre: campoNombre.value.trim(),
          cliente_telefono: telefono,
          nota: campoNota.value.trim() || null,
          detalles: lista.map((linea) => ({ producto_id: linea.producto_id, cantidad: linea.cantidad })),
        },
      });
      try {
        sessionStorage.setItem("natutech.ultimoPedido", JSON.stringify({ referencia: respuesta.referencia }));
      } catch {
        /* sin sessionStorage: el carrito se vacía a mano */
      }
      window.location.assign(respuesta.enlace_pago);
      return;
    } catch (error) {
      if (!(error instanceof Api.ErrorApi)) console.error(error);
      if (error instanceof Api.ErrorApi && error.estado === 422 && error.detalles.length) {
        // "detalles[1].cantidad" → el nombre del segundo producto. Luego se refrescan existencias.
        const nombreDe = (campoApi) => {
          const posicion = /^detalles\[(\d+)\]/.exec(campoApi);
          return posicion ? lista[Number(posicion[1])]?.producto.nombre : { cliente_nombre: "Nombre", cliente_telefono: "Celular", nota: "Nota" }[campoApi] || campoApi;
        };
        mostrarErrores(resumen, error.detalles.map((detalle) => ({ campo: lista.length && /^detalles/.test(detalle.campo) ? "" : detalle.campo, mensaje: `${nombreDe(detalle.campo)}: ${detalle.problema}.` })), error.message);
        try {
          datos = await cargarDatos();
          porId = new Map(datos.productos.map((producto) => [producto.id, producto]));
          pintar();
        } catch {
          /* se queda con lo que había */
        }
      } else if (error instanceof Api.ErrorApi && error.estado === 503) {
        mostrarErrores(resumen, [{ campo: "", mensaje: "El pago en línea no está disponible en este momento. Puede enviarnos el pedido por WhatsApp con el botón de abajo." }], "No se pudo iniciar el pago");
      } else {
        mostrarErrores(resumen, [{ campo: "", mensaje: error.message }], "No se pudo iniciar el pago");
      }
    } finally {
      botonPagar.textContent = "Pagar en línea";
      actualizarTotales();
    }
  });

  pintar();
}

/* ---------- Pantalla 11: resultado del pago (pago-resultado.html?id=...) ---------- */

// Wompi devuelve al cliente a esta página con ?id=<transacción>. El resultado no se toma de
// la dirección (se podría falsificar): se le pregunta a la API, que lo confirma con Wompi.
const RESULTADOS_PAGO = {
  aprobado: {
    tipo: "exito",
    titulo: "Pago aprobado",
    texto: (r) => `Recibimos su pago de ${formatoPrecio.format(r.monto)} (referencia ${r.referencia}). El vivero le escribirá por WhatsApp para coordinar la entrega.`,
  },
  rechazado: { tipo: "error", titulo: "El pago fue rechazado", texto: () => "No se hizo ningún cobro. Puede intentarlo de nuevo con el mismo enlace o escribirnos por WhatsApp para pagar de otra forma." },
  anulado: { tipo: "error", titulo: "El pago fue anulado", texto: () => "La transacción se anuló y no quedó ningún cobro. Escríbanos por WhatsApp si necesita ayuda." },
  error: { tipo: "error", titulo: "No se pudo completar el pago", texto: () => "Hubo un problema al procesar el pago y no quedó ningún cobro. Intente de nuevo o escríbanos por WhatsApp." },
};

async function iniciarResultadoPago() {
  const zona = $("#zona-pago");
  const id = parametros.get("id");
  const escribir = () =>
    crear(
      "a",
      { clase: "boton", href: enlaceWhatsApp(`Hola, ${CONFIG.nombreNegocio}. Les escribo por mi pago en línea${id ? ` (transacción ${id})` : ""}.`), target: "_blank", rel: "noopener" },
      "Escribir por WhatsApp",
      crear("span", { clase: "visualmente-oculto", texto: " (se abre en una pestaña nueva)" })
    );
  const volver = () => crear("a", { clase: "boton boton--secundario", href: "index.html", texto: "Volver al catálogo" });

  const modo = await Api.detectarModo();
  if (modo !== "api" || !id || !/^[A-Za-z0-9-]{5,60}$/.test(id)) {
    mostrarEn(
      zona,
      panelEstado("vacio", {
        titulo: modo !== "api" ? "Esta copia no procesa pagos" : "No encontramos el pago",
        texto:
          modo !== "api"
            ? "Los pagos en línea funcionan en el sitio del vivero, no en esta copia de demostración."
            : "La dirección no trae el número de la transacción. Si acaba de pagar, escríbanos por WhatsApp y le confirmamos.",
        acciones: [escribir(), volver()],
      })
    );
    return;
  }

  // Wompi puede tardar unos segundos en dar el resultado: se pregunta hasta 10 veces, cada 3 s.
  for (let intento = 1; intento <= 10; intento += 1) {
    let resultado = null;
    try {
      resultado = await Api.pedir(`/pagos/transacciones/${encodeURIComponent(id)}`);
    } catch (error) {
      if (!(error instanceof Api.ErrorApi && error.estado === 404)) {
        mostrarEn(
          zona,
          panelEstado("error", {
            titulo: "No pudimos confirmar el pago",
            texto: `${error.message} Si ya pagó, escríbanos por WhatsApp con la referencia que le mostró Wompi.`,
            acciones: [escribir(), volver()],
          })
        );
        return;
      }
    }
    if (resultado && resultado.estado !== "pendiente") {
      const final = RESULTADOS_PAGO[resultado.estado];
      const aprobado = resultado.estado === "aprobado";
      // Si este pago es el del carrito de este navegador, el carrito ya se puede vaciar.
      try {
        const ultimo = JSON.parse(sessionStorage.getItem("natutech.ultimoPedido"));
        if (aprobado && ultimo?.referencia === resultado.referencia) {
          Carrito.vaciar();
          sessionStorage.removeItem("natutech.ultimoPedido");
        }
      } catch {
        /* sin sessionStorage: el carrito se vacía a mano */
      }
      const avisoPrueba =
        resultado.ambiente === "pruebas"
          ? crear("div", { clase: "aviso" }, crear("p", {}, crear("strong", { texto: "Pago de prueba. " }), "Este sitio usa el ambiente de pruebas de Wompi: no se cobró dinero real."))
          : null;
      // La zona es aria-live: el lector de pantalla anuncia el resultado sin mover el foco.
      mostrarEn(zona, avisoPrueba, panelEstado(final.tipo, { titulo: final.titulo, texto: final.texto(resultado), acciones: aprobado ? [volver(), escribir()] : [escribir(), volver()] }));
      return;
    }
    await esperar(3000);
  }
  mostrarEn(
    zona,
    panelEstado("vacio", {
      titulo: "Su pago está en proceso",
      texto: "Wompi todavía no confirma el resultado. Puede cerrar esta página: cuando se confirme, el vivero le escribirá por WhatsApp.",
      acciones: [escribir(), volver()],
    })
  );
}

/* ---------- Arranque ---------- */

const PANTALLAS = {
  catalogo: iniciarCatalogo,
  detalle: iniciarDetalle,
  inventario: iniciarInventario,
  formulario: iniciarFormulario,
  ingresar: iniciarIngresar,
  pedidos: iniciarPedidos,
  categorias: iniciarGestion,
  proveedores: iniciarGestion,
  temporadas: iniciarGestion,
  precios: iniciarPrecios,
  pago: iniciarResultadoPago,
  carrito: iniciarCarrito,
};

document.addEventListener("DOMContentLoaded", async () => {
  await cargarConfiguracion();
  actualizarIndicadoresCarrito();
  const enlacePie = $("#whatsapp-pie");
  if (enlacePie) enlacePie.href = enlaceWhatsApp(`Hola, ${CONFIG.nombreNegocio}. Quiero hacer una consulta.`);
  // En el celular las pestañas de gestión se desplazan de lado: la de esta página queda a la vista.
  const pestanaActual = $(".subnavegacion [aria-current='page']");
  if (pestanaActual) {
    const lista = pestanaActual.closest("ul");
    lista.scrollLeft += pestanaActual.getBoundingClientRect().left - lista.getBoundingClientRect().left - 4;
  }
  const iniciar = PANTALLAS[document.body.dataset.pagina];
  if (iniciar) iniciar();
});
