/* =========================================================================
   Natutech · Conexión con la API (Entrega 3)

   Todas las páginas cargan este archivo antes de app.js. Aquí está todo lo que
   habla con el servidor; app.js solo pinta las pantallas.

   Dos modos:
   - "api": el prototipo se abre desde Docker Compose (http://localhost:8080). La
     API responde en la misma dirección, en /api, gracias a nginx (decisión D13).
   - "demostracion": no hay servidor (GitHub Pages, o la carpeta web servida sola).
     El prototipo lee datos/ejemplo.json como en la Entrega 2 y avisa que los
     cambios no se guardan.

   El token de la sesión se guarda en sessionStorage: dura lo que dure la pestaña
   y nunca se escribe en el código ni en el repositorio (decisión D11).
   ========================================================================= */

"use strict";

const Api = (() => {
  const BASE = "api"; // relativa a la página: /api con Docker Compose
  const CLAVE_SESION = "natutech.sesion";

  // Error con el formato del contrato: { codigo, mensaje, detalles: [{ campo, problema }] }
  class ErrorApi extends Error {
    constructor(estado, cuerpo) {
      super(cuerpo?.mensaje || mensajePorEstado(estado));
      this.name = "ErrorApi";
      this.estado = estado;
      this.codigo = cuerpo?.codigo || "ERROR_INTERNO";
      this.detalles = cuerpo?.detalles || [];
    }
  }

  function mensajePorEstado(estado) {
    if (estado === 0 || estado >= 500) return "El servidor del vivero no responde. Intente de nuevo en unos minutos.";
    return "La solicitud no se pudo completar.";
  }

  /* ---------- Sesión ---------- */

  const sesion = {
    // Devuelve { token, expira_en, usuario } o null si no hay sesión o ya venció.
    leer() {
      try {
        const guardada = JSON.parse(sessionStorage.getItem(CLAVE_SESION));
        if (!guardada?.token || Date.parse(guardada.expira_en) <= Date.now()) return null;
        return guardada;
      } catch {
        return null; // navegador sin sessionStorage o dato dañado
      }
    },
    guardar({ token, expira_en, usuario }) {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ token, expira_en, usuario }));
    },
    cerrar() {
      try {
        sessionStorage.removeItem(CLAVE_SESION);
      } catch {
        /* no hay nada que borrar */
      }
    },
  };

  // Lleva a la página de ingreso y recuerda a qué página volver después.
  function irAIngresar() {
    const actual = window.location.pathname.split("/").pop() + window.location.search;
    window.location.assign(`ingresar.html?volver=${encodeURIComponent(actual)}`);
  }

  // Solo se vuelve a páginas de este mismo sitio (evita redirecciones a otros sitios).
  function destinoSeguro(volver) {
    return /^[a-z-]+\.html(\?[\w=&%.-]*)?$/.test(volver || "") ? volver : "inventario.html";
  }

  /* ---------- Peticiones ---------- */

  // pedir("/productos", { metodo: "POST", cuerpo: {...}, conSesion: true })
  async function pedir(ruta, { metodo = "GET", cuerpo, conSesion = false } = {}) {
    const cabeceras = { accept: "application/json" };
    if (cuerpo !== undefined) cabeceras["content-type"] = "application/json";
    if (conSesion) {
      const actual = sesion.leer();
      if (actual) cabeceras.authorization = `Bearer ${actual.token}`;
    }

    let respuesta;
    try {
      respuesta = await fetch(`${BASE}${ruta}`, {
        method: metodo,
        headers: cabeceras,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      });
    } catch {
      throw new ErrorApi(0, null);
    }

    if (respuesta.status === 204) return null;
    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      // Sesión vencida o token inválido: se borra y se pide ingresar de nuevo.
      if (respuesta.status === 401 && conSesion) {
        sesion.cerrar();
        irAIngresar();
      }
      throw new ErrorApi(respuesta.status, datos);
    }
    return datos;
  }

  // Recorre todas las páginas de una lista paginada (máximo 50 por página, según el contrato).
  async function todasLasPaginas(ruta, opciones) {
    const separador = ruta.includes("?") ? "&" : "?";
    const lista = [];
    for (let pagina = 1; ; pagina += 1) {
      const { datos, paginacion } = await pedir(`${ruta}${separador}pagina=${pagina}&por_pagina=50`, opciones);
      lista.push(...datos);
      if (datos.length === 0 || lista.length >= paginacion.total) return lista;
    }
  }

  /* ---------- Modo ---------- */

  let modo = null;

  async function detectarModo() {
    if (modo) return modo;
    const sinServidor = window.location.protocol === "file:" || window.location.hostname.endsWith("github.io");
    if (sinServidor) return (modo = "demostracion");
    try {
      const respuesta = await fetch(`${BASE}/salud`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
      // 404: este servidor solo publica archivos y no tiene API.
      // Cualquier otra respuesta (200, 502, 503) significa que la API existe, aunque falle.
      modo = respuesta.status === 404 ? "demostracion" : "api";
    } catch {
      modo = "api"; // la API debía estar y no respondió: las pantallas mostrarán el error
    }
    return modo;
  }

  return { ErrorApi, sesion, irAIngresar, destinoSeguro, pedir, todasLasPaginas, detectarModo };
})();
